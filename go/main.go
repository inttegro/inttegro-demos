package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	inttegro "github.com/zebodotdev/inttegro-sdk-go/v4"
	"github.com/zebodotdev/inttegro-sdk-go/v4/money"
)

// Inttegro integration map
//
// INTTEGRO:FLOW [checkout-presentation] This trusted server validates an
// invoice payment and creates the same finalized Order for hosted-page,
// embedded, and modal Checkout.
// INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY stays in this server
// process. Never emit it into HTML, client JavaScript, logs, or error responses.
// INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment is available to
// products prepared to own more payment state, recovery UI, method-specific
// behavior, testing, and compliance analysis.
// INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
// INTTEGRO:DOCS https://studio.inttegro.com/orders
// INTTEGRO:DOCS https://studio.inttegro.com/keys
// See ../INTEGRATION_GUIDE.md and ../integration-decisions.json for the shared
// rationale and machine-readable alternatives.

type demoError struct {
	Code    string
	Message string
}

func (e *demoError) Error() string { return e.Message }

type checkoutInput struct {
	Name      string
	Email     string
	Phone     string
	AttemptID string
}

type catalogSelection struct {
	Type      inttegro.ProductType
	Name      string
	About     string
	Reference string
	Price     inttegro.PriceParams
}

type pageData struct {
	AttemptID    string
	ErrorCode    string
	ErrorMessage string
}

var (
	emailPattern   = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	attemptPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{8,100}$`)
	productPattern = regexp.MustCompile(`^prod_[A-Za-z0-9]+$`)
	pricePattern   = regexp.MustCompile(`^pr_[A-Za-z0-9]+$`)
	templates      = template.Must(template.ParseGlob("templates/*.html"))
)

func parseCheckoutInput(request *http.Request) (checkoutInput, error) {
	if err := request.ParseForm(); err != nil {
		return checkoutInput{}, &demoError{Code: "validation_error", Message: "The submitted form is invalid."}
	}
	input := checkoutInput{
		Name: strings.TrimSpace(request.FormValue("name")), Email: strings.TrimSpace(request.FormValue("email")),
		Phone: strings.TrimSpace(request.FormValue("phone")), AttemptID: strings.TrimSpace(request.FormValue("attempt_id")),
	}
	if input.Name == "" || input.Phone == "" || !emailPattern.MatchString(input.Email) {
		return checkoutInput{}, &demoError{Code: "validation_error", Message: "Enter a name, valid email, and phone number."}
	}
	if !attemptPattern.MatchString(input.AttemptID) {
		return checkoutInput{}, &demoError{Code: "validation_error", Message: "Start a fresh checkout and try again."}
	}
	return input, nil
}

func publicOrigin(request *http.Request) (string, error) {
	// INTTEGRO:SECURITY [configured-public-origin] Prefer an allow-listed
	// configured origin in production. A request-derived fallback is safe only
	// behind a precisely configured trusted proxy chain. Return URLs must be
	// HTTP(S); Inttegro appends order_id after checkout.
	value := strings.TrimSpace(os.Getenv("INTTEGRO_DEMO_PUBLIC_URL"))
	if value == "" {
		scheme := "http"
		if request.TLS != nil {
			scheme = "https"
		}
		value = scheme + "://" + request.Host
	}
	parsed, err := url.ParseRequestURI(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", &demoError{Code: "configuration_error", Message: "The demo public URL is invalid."}
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func selectCatalogProduct(product *inttegro.Product, priceID string) (catalogSelection, error) {
	// INTTEGRO:SECURITY [catalog-authority] Product, Price, and amount are
	// deployment configuration resolved with the trusted API key. The browser
	// supplies none of them.
	if product == nil || !product.Active {
		return catalogSelection{}, &demoError{Code: "configuration_error", Message: "The configured demo product is not active."}
	}
	for _, price := range product.Prices {
		if price.ID != priceID {
			continue
		}
		if !price.Active || price.Nominal == nil || price.Nominal.Value <= 0 {
			break
		}
		return catalogSelection{
			Type: product.Type, Name: product.Name, About: product.About, Reference: product.Reference,
			Price: inttegro.PriceParams{AmountParams: money.AmountParams{Currency: price.Nominal.Currency, Value: price.Nominal.Value}},
		}, nil
	}
	return catalogSelection{}, &demoError{Code: "configuration_error", Message: "The configured demo price is not available for this product."}
}

func buildOrderRequest(input checkoutInput, origin string, product catalogSelection) inttegro.OrderCreateParams {
	orderSuffix := strings.ToUpper(strings.ReplaceAll(input.AttemptID, "_", "-"))
	if len(orderSuffix) > 48 {
		orderSuffix = orderSuffix[:48]
	}
	return inttegro.OrderCreateParams{
		// INTTEGRO:DECISION [stable-idempotency-key] Reuse this key for retries of
		// one logical invoice payment. Production systems should persist a key
		// derived from the merchant invoice; a fresh retry key permits duplicates.
		// https://studio.inttegro.com/idempotency
		RequestMeta: &inttegro.RequestMeta{IdempotencyKey: "demo-" + input.AttemptID},
		// INTTEGRO:DECISION [merchant-order-number] Ledgerline supplies a merchant
		// reference instead of accepting the generated or_ ID as the order number.
		// The demo suffix is retry-stable. A production portal should use its durable
		// invoice or receivables number and must not encode customer PII.
		Number: "INV-2048-" + orderSuffix,
		// INTTEGRO:DECISION [inline-customer] customer_data fits this guest flow.
		// Account-based apps should resolve customer_id on the server; Inttegro
		// accepts exactly one of the two customer representations.
		CustomerData: &inttegro.CustomerData{Name: input.Name, Email: input.Email, PhoneNumber: input.Phone},
		// INTTEGRO:DECISION [finalize-on-create] This invoice is already settled,
		// so finalization freezes it and creates checkout formats in one operation.
		// Use draft -> update -> finalize for mutable lines, tax, or approval.
		Finalize:         inttegro.Bool(true),
		CheckoutSettings: &inttegro.CheckoutSettings{RedirectURL: origin + "/complete", CancelURL: origin + "/cancel"},
		LineItems: []inttegro.OrderLineItemParams{{
			Type: inttegro.LineItemTypeProduct,
			Product: &inttegro.ProductLineItemParams{
				// INTTEGRO:DECISION [catalog-snapshot] The service resolves the
				// configured Product and Price and snapshots the verified fields into
				// the Order for compatibility across SDK versions.
				// INTTEGRO:ALTERNATIVE [catalog-snapshot] When the SDK exposes the
				// typed catalogue union, send product_id + price_id + quantity and
				// omit the inline fields.
				Type: product.Type, Name: product.Name, About: product.About, Reference: product.Reference,
				Quantity: 1, Price: product.Price,
			},
		}},
	}
}

func createHostedCheckout(ctx context.Context, input checkoutInput, origin string) (string, string, error) {
	// INTTEGRO:SECURITY [server-api-key] Source this from a deployment secret
	// manager and rotate it there; never serialize it into a public response.
	apiKey := strings.TrimSpace(os.Getenv("INTTEGRO_API_KEY"))
	if apiKey == "" {
		return "", "", &demoError{Code: "configuration_error", Message: "Set INTTEGRO_API_KEY on the server."}
	}
	productID := strings.TrimSpace(os.Getenv("INTTEGRO_DEMO_PRODUCT_ID"))
	priceID := strings.TrimSpace(os.Getenv("INTTEGRO_DEMO_PRICE_ID"))
	if !productPattern.MatchString(productID) || !pricePattern.MatchString(priceID) {
		return "", "", &demoError{Code: "configuration_error", Message: "Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server."}
	}
	// INTTEGRO:ALTERNATIVE [server-api-key] A production service can inject one
	// startup-configured client for transport reuse and application-owned
	// OpenTelemetry. The SDK chooses no exporter or vendor.
	// https://studio.inttegro.com/sdk-observability
	client := inttegro.NewClient(apiKey)
	// INTTEGRO:FLOW [catalog-lookup] Resolve at checkout so publication and
	// price changes take effect. High-volume services can use a short cache with
	// explicit invalidation. https://studio.inttegro.com/products
	resolvedProduct, err := client.Products.Lookup(ctx, productID)
	var product catalogSelection
	if err == nil {
		product, err = selectCatalogProduct(resolvedProduct, priceID)
	}
	if err == nil {
		var order *inttegro.Order
		order, err = client.Orders.Create(ctx, buildOrderRequest(input, origin, product))
		if err == nil {
			// INTTEGRO:DECISION [returned-checkout-url] Use the URL in the response;
			// constructing one from order.ID depends on undocumented routing details.
			if order.Invoice == nil || order.Invoice.Format == nil || order.Invoice.Format.Web == nil || order.Invoice.Format.Web.URL == "" {
				return "", "", &demoError{Code: "api_error", Message: "Inttegro did not return a hosted checkout URL."}
			}
			return order.ID, order.Invoice.Format.Web.URL, nil
		}
	}
	if err != nil {
		// INTTEGRO:SECURITY [safe-error-boundary] Keep raw upstream payloads,
		// credentials, and traces private. Public messages stay stable; record
		// only bounded metadata and request IDs in protected telemetry.
		var configurationError *demoError
		if errors.As(err, &configurationError) {
			return "", "", configurationError
		}
		var apiError *inttegro.APIError
		if errors.As(err, &apiError) {
			return "", "", &demoError{Code: "api_error", Message: "Inttegro rejected the checkout request."}
		}
		return "", "", &demoError{Code: "api_error", Message: "Checkout is temporarily unavailable."}
	}
	return "", "", &demoError{Code: "api_error", Message: "Checkout is temporarily unavailable."}
}

func newAttemptID() string {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return fmt.Sprintf("attempt_%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(value)
}

func render(response http.ResponseWriter, name string, data any) {
	response.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := templates.ExecuteTemplate(response, name, data); err != nil {
		http.Error(response, "Page unavailable", http.StatusInternalServerError)
	}
}

func home(response http.ResponseWriter, request *http.Request) {
	if request.URL.Path != "/" {
		http.NotFound(response, request)
		return
	}
	render(response, "home.html", pageData{AttemptID: newAttemptID(), ErrorCode: request.URL.Query().Get("code"), ErrorMessage: request.URL.Query().Get("message")})
}

func checkout(response http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		response.Header().Set("Allow", http.MethodPost)
		http.Error(response, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	input, err := parseCheckoutInput(request)
	wantsJSON := strings.Contains(request.Header.Get("Accept"), "application/json")
	if wantsJSON {
		response.Header().Set("Cache-Control", "no-store")
	}
	if err == nil {
		var origin string
		origin, err = publicOrigin(request)
		if err == nil {
			var orderID, checkoutURL string
			orderID, checkoutURL, err = createHostedCheckout(request.Context(), input, origin)
			if err == nil {
				// INTTEGRO:DECISION [durable-order-correlation] This short-lived
				// HttpOnly cookie is only a demo aid. Production code persists an
				// owner-scoped merchant invoice -> Inttegro order mapping.
				http.SetCookie(response, &http.Cookie{Name: "inttegro_demo_order", Value: orderID, Path: "/", MaxAge: 1800, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: request.TLS != nil})
				// INTTEGRO:DECISION [see-other-redirect] 303 follows the hosted
				// URL with GET. A 307/308 would preserve and replay this POST.
				if wantsJSON {
					// INTTEGRO:SECURITY [client-order-reference] Return only the
					// finalized Order ID needed by browser Checkout.
					response.Header().Set("Content-Type", "application/json")
					response.WriteHeader(http.StatusCreated)
					_ = json.NewEncoder(response).Encode(map[string]string{"orderId": orderID})
					return
				}
				http.Redirect(response, request, checkoutURL, http.StatusSeeOther)
				return
			}
		}
	}
	safe := &demoError{Code: "api_error", Message: "Checkout is temporarily unavailable."}
	var mapped *demoError
	if errors.As(err, &mapped) {
		safe = mapped
	}
	// INTTEGRO:SECURITY [safe-error-boundary] Only our bounded error vocabulary
	// enters the query string; detailed API diagnostics remain server-side.
	if wantsJSON {
		status := http.StatusServiceUnavailable
		if safe.Code == "validation_error" {
			status = http.StatusBadRequest
		}
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(status)
		_ = json.NewEncoder(response).Encode(map[string]string{"code": safe.Code, "message": safe.Message})
		return
	}
	query := url.Values{"code": {safe.Code}, "message": {safe.Message}}
	http.Redirect(response, request, "/?"+query.Encode(), http.StatusSeeOther)
}

func main() {
	// INTTEGRO:VERIFY [server-side-verification] /complete is a UX return, not
	// proof of payment. Resolve and look up the owner-scoped order before
	// fulfillment. Merchant webhooks are not currently available, so use bounded
	// polling plus a background reconciliation job:
	// https://studio.inttegro.com/webhooks
	mux := http.NewServeMux()
	mux.HandleFunc("/", home)
	mux.HandleFunc("/checkout", checkout)
	mux.HandleFunc("/complete", func(w http.ResponseWriter, _ *http.Request) {
		render(w, "result.html", map[string]any{"Complete": true})
	})
	mux.HandleFunc("/cancel", func(w http.ResponseWriter, _ *http.Request) {
		render(w, "result.html", map[string]any{"Complete": false})
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"status":"ok","demo":"go"}`)
	})
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("static"))))

	port := os.Getenv("PORT")
	if port == "" {
		port = "3003"
	}
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("Inttegro Go demo listening on http://localhost:%s", port)
	log.Fatal(server.ListenAndServe())
}
