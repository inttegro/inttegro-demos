package com.inttegro.demo;

import com.inttegro.ApiException;
import com.inttegro.Client;
import com.inttegro.RequestMeta;
import com.inttegro.customers.CustomerData;
import com.inttegro.orders.CheckoutSettings;
import com.inttegro.orders.Order;
import com.inttegro.orders.OrderCreateParams;
import com.inttegro.orders.OrderLineItemParams;
import com.inttegro.prices.PriceParams;
import com.inttegro.products.Product;
import com.inttegro.products.ProductType;
import java.net.URI;
import java.util.Locale;

import org.springframework.stereotype.Service;

@Service
public class CheckoutService {
    /*
     * Inttegro integration map
     *
     * INTTEGRO:FLOW [hosted-checkout] This trusted service creates and finalizes
     * the Ledgerline Order and returns the hosted invoice URL.
     * INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY stays in the server
     * process. Never expose it through templates, static assets, client
     * configuration, logs, or exception responses.
     * INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment offers more UI
     * control but shifts more payment states, recovery, method-specific behavior,
     * testing, and compliance analysis to the merchant.
     * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
     * INTTEGRO:DOCS https://studio.inttegro.com/orders
     * INTTEGRO:DOCS https://studio.inttegro.com/keys
     * See the repository INTEGRATION_GUIDE.md and integration-decisions.json
     * for the shared rationale and machine-readable alternatives.
     */
    public record CheckoutResult(String orderId, String checkoutUrl) {}
    public record CatalogSelection(ProductType type, String name, String about, String reference, PriceParams price) {}

    public static final class DemoException extends RuntimeException {
        private final String code;

        DemoException(String code, String message) {
            super(message);
            this.code = code;
        }

        public String code() { return code; }
    }

    static CatalogSelection selectCatalogProduct(Product product, String priceId) {
        // INTTEGRO:SECURITY [catalog-authority] The browser supplies no product,
        // price, or amount. Resolve them with the server credential and verify
        // the explicit Price belongs to the configured active Product.
        if (product == null || !Boolean.TRUE.equals(product.active)) {
            throw new DemoException("configuration_error", "The configured demo product is not active.");
        }
        var price = product.prices == null ? null : product.prices.stream()
                .filter(candidate -> priceId.equals(candidate.id))
                .findFirst()
                .orElse(null);
        // This SDK version does not expose the price's active flag in a Product
        // summary. Require an explicit ID match and positive fixed amount; newer SDKs
        // should also require the returned Price to be active.
        if (price == null || price.fixedAmount == null || price.fixedAmount.value == null || price.fixedAmount.value <= 0) {
            throw new DemoException("configuration_error", "The configured demo price is not available for this product.");
        }
        return new CatalogSelection(
                product.type,
                product.name,
                product.about,
                product.reference,
                PriceParams.of(price.fixedAmount.currency, price.fixedAmount.value));
    }

    static OrderCreateParams buildOrderRequest(CheckoutForm form, String origin, CatalogSelection product) {
        return OrderCreateParams.builder()
                // INTTEGRO:DECISION [stable-idempotency-key] Reuse this key for
                // retries of one logical invoice payment. Production systems
                // should persist an invoice-derived key; a new key after a
                // timeout permits duplicates.
                // https://studio.inttegro.com/idempotency
                .requestMeta(RequestMeta.withIdempotencyKey("demo-" + form.attemptId()))
                // INTTEGRO:DECISION [merchant-order-number] Supply Ledgerline's
                // reference instead of using Inttegro's generated or_ ID as the
                // order number. The validated attempt keeps this demo reference
                // stable across retries. Production should use its persisted
                // invoice number and must not encode customer PII.
                .number("INV-2048-" + form.attemptId().replace('_', '-').toUpperCase(Locale.ROOT).substring(0, Math.min(48, form.attemptId().length())))
                // INTTEGRO:DECISION [inline-customer] customerData fits this
                // guest flow. Account-based apps should resolve customerId on
                // the server; Inttegro accepts exactly one representation.
                .customerData(CustomerData.builder().name(form.name().trim()).email(form.email().trim()).phoneNumber(form.phone().trim()).build())
                // INTTEGRO:DECISION [finalize-on-create] This invoice is settled,
                // so finalization freezes the Order and creates invoice formats.
                // Use draft -> update -> finalize when lines, tax, or approval
                // can still change.
                .finalizeOrder(true)
                .checkoutSettings(CheckoutSettings.builder().redirectUrl(origin + "/complete").cancelUrl(origin + "/cancel").build())
                .lineItem(OrderLineItemParams.product(item -> item
                        // INTTEGRO:DECISION [catalog-snapshot] Resolve the Product
                        // and Price, then snapshot the verified fields into the
                        // Order for compatibility across SDK versions.
                        // INTTEGRO:ALTERNATIVE [catalog-snapshot] When the SDK
                        // exposes the typed catalogue union, send product_id +
                        // price_id + quantity and omit the inline fields.
                        .type(product.type())
                        .name(product.name())
                        .about(product.about())
                        .reference(product.reference())
                        .quantity(1)
                        .price(product.price())))
                .build();
    }

    CheckoutResult create(CheckoutForm form, String origin) {
        // INTTEGRO:SECURITY [server-api-key] Use the deployment secret manager
        // in production and rotate the key there; never serialize it to clients.
        String apiKey = System.getenv().getOrDefault("INTTEGRO_API_KEY", "").trim();
        if (apiKey.isEmpty()) {
            throw new DemoException("configuration_error", "Set INTTEGRO_API_KEY on the server.");
        }
        String productId = System.getenv().getOrDefault("INTTEGRO_DEMO_PRODUCT_ID", "").trim();
        String priceId = System.getenv().getOrDefault("INTTEGRO_DEMO_PRICE_ID", "").trim();
        if (!productId.matches("^prod_[A-Za-z0-9]+$") || !priceId.matches("^pr_[A-Za-z0-9]+$")) {
            throw new DemoException("configuration_error", "Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.");
        }
        String publicOrigin = validatedOrigin(origin);
        try {
            // INTTEGRO:ALTERNATIVE [server-api-key] A production Spring app can
            // inject a singleton Client for transport reuse, fail-fast config,
            // and application-owned OpenTelemetry. Per-call creation is concise
            // here. https://studio.inttegro.com/sdk-observability
            Client client = new Client(apiKey);
            // INTTEGRO:FLOW [catalog-lookup] Resolve at checkout time so product
            // publication and price changes take effect. High-volume services
            // can use a short cache with explicit invalidation.
            // https://studio.inttegro.com/products
            CatalogSelection product = selectCatalogProduct(client.products().lookup(productId), priceId);
            Order order = client.orders().create(buildOrderRequest(form, publicOrigin, product));
            // INTTEGRO:DECISION [returned-checkout-url] Use the response field.
            // Constructing a URL from order.id relies on undocumented routing.
            if (order.invoice == null || order.invoice.format == null || order.invoice.format.web == null || order.invoice.format.web.url == null) {
                throw new DemoException("api_error", "Inttegro did not return a hosted checkout URL.");
            }
            return new CheckoutResult(order.id, order.invoice.format.web.url);
        } catch (DemoException error) {
            throw error;
        } catch (ApiException error) {
            // INTTEGRO:SECURITY [safe-error-boundary] Keep raw responses,
            // credentials, and stack traces in protected diagnostics. Expose a
            // stable message and record only bounded metadata/request IDs.
            throw new DemoException("api_error", "Inttegro rejected the checkout request.");
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new DemoException("api_error", "Checkout was interrupted. Try again.");
        } catch (Exception error) {
            throw new DemoException("api_error", "Checkout is temporarily unavailable.");
        }
    }

    private static String validatedOrigin(String value) {
        // INTTEGRO:SECURITY [configured-public-origin] Prefer an allow-listed
        // origin in production. A request-derived fallback is safe only behind
        // a precise trusted-proxy configuration. Return URLs must be HTTP(S),
        // and Inttegro appends order_id after checkout.
        try {
            URI uri = URI.create(value);
            if (!("http".equals(uri.getScheme()) || "https".equals(uri.getScheme())) || uri.getHost() == null) throw new IllegalArgumentException();
            return uri.getScheme() + "://" + uri.getAuthority();
        } catch (IllegalArgumentException error) {
            throw new DemoException("configuration_error", "The demo public URL is invalid.");
        }
    }
}
