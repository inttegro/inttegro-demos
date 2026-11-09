require "inttegro"
require "uri"

# Inttegro integration map
#
# INTTEGRO:FLOW [hosted-checkout] This server-only service validates the Kora
# checkout, creates and finalizes an Order, and returns its hosted invoice URL.
# INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY belongs only in the trusted
# Rails process. Never expose it through credentials rendered to a browser,
# asset builds, client-side environment values, logs, or error responses.
# INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment provides more UI
# control but requires the merchant to own more payment states, recovery,
# method-specific behavior, testing, and compliance analysis.
# INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
# INTTEGRO:DOCS https://studio.inttegro.com/orders
# INTTEGRO:DOCS https://studio.inttegro.com/keys
# See ../../../INTEGRATION_GUIDE.md and ../../../integration-decisions.json for the
# shared rationale and machine-readable alternatives.

class CheckoutService
  Checkout = Data.define(:name, :email, :phone, :attempt_id)

  class DemoError < StandardError
    attr_reader :code

    def initialize(code, message)
      @code = code
      super(message)
    end
  end

  class << self
    def parse(values)
      checkout = Checkout.new(
        name: values.fetch("name", "").strip,
        email: values.fetch("email", "").strip,
        phone: values.fetch("phone", "").strip,
        attempt_id: values.fetch("attempt_id", "").strip
      )
      unless checkout.name.present? && checkout.phone.present? && checkout.email.match?(/\A[^\s@]+@[^\s@]+\.[^\s@]+\z/)
        raise DemoError.new("validation_error", "Enter a name, valid email, and phone number.")
      end
      unless checkout.attempt_id.match?(/\A[A-Za-z0-9_-]{8,100}\z/)
        raise DemoError.new("validation_error", "Start a fresh checkout and try again.")
      end
      checkout
    end

    def catalog_selection(product, price_id)
      # INTTEGRO:SECURITY [catalog-authority] Product and price never come from
      # the submitted Rails params. Resolve them with the server credential and
      # verify their relationship before building the Order.
      raise DemoError.new("configuration_error", "The configured demo product is not active.") unless product.active

      price = product.prices&.find { |candidate| candidate.id == price_id && candidate.active }
      unless price&.fixed_amount&.value&.positive?
        raise DemoError.new("configuration_error", "The configured demo price is not active for this product.")
      end

      {
        type: product.type,
        name: product.name,
        about: product.about,
        reference: product.reference,
        price: Inttegro::Price::PriceParams.new(
          currency: price.fixed_amount.currency,
          value: price.fixed_amount.value
        )
      }.compact
    end

    def order_params(checkout, origin, product)
      {
        # INTTEGRO:DECISION [stable-idempotency-key] Reuse this key for a retry of
        # the same logical checkout. Production systems should persist a stable
        # cart/invoice-derived value; a new key after a timeout allows duplicates.
        # https://studio.inttegro.com/idempotency
        request_meta: { idempotency_key: "demo-#{checkout.attempt_id}" },
        # INTTEGRO:DECISION [merchant-order-number] Supply a recognizable
        # merchant reference instead of letting Inttegro fall back to its or_ ID.
        # This demo derives a retry-stable value from the validated attempt. A
        # production store should use its persisted sales-order number, without
        # embedding customer PII.
        number: "KORA-#{checkout.attempt_id.tr("_", "-").upcase[0, 48]}",
        # INTTEGRO:DECISION [inline-customer] customer_data fits this guest flow.
        # Account-based apps should resolve customer_id on the server; Inttegro
        # accepts exactly one of the two customer representations.
        customer_data: { name: checkout.name, email_address: checkout.email, phone_number: checkout.phone },
        # INTTEGRO:DECISION [finalize-on-create] This cart is already complete,
        # so one request freezes the order and creates invoice formats. Use a
        # draft, updates, then explicit finalization when tax, shipping,
        # inventory, approval, or line items can still change.
        finalize: true,
        checkout_settings: { redirect_url: "#{origin}/complete", cancel_url: "#{origin}/cancel" },
        line_items: [{
          type: "product",
          product: {
            # INTTEGRO:DECISION [catalog-snapshot] The service looks up the
            # configured Inttegro Product and Price, validates their relationship,
            # and snapshots the authoritative fields into this Order. That shape
            # remains compatible across maintained SDK versions.
            # INTTEGRO:ALTERNATIVE [catalog-snapshot] When the selected SDK
            # exposes the typed catalogue union, send product_id + price_id +
            # quantity instead and do not mix in inline product fields.
            **product,
            quantity: 1,
          }
        }]
      }
    end

    def create(checkout, origin)
      # INTTEGRO:SECURITY [configured-public-origin] Prefer an allow-listed
      # configured origin in production. A request-derived fallback is safe only
      # behind a precisely configured trusted proxy chain. Return URLs must be
      # absolute HTTP(S); Inttegro appends order_id on return.
      uri = URI.parse(origin)
      unless %w[http https].include?(uri.scheme) && uri.host
        raise DemoError.new("configuration_error", "The demo public URL is invalid.")
      end
      # INTTEGRO:SECURITY [server-api-key] Load this from the deployment secret
      # store and rotate it there; never serialize it to the browser.
      api_key = ENV.fetch("INTTEGRO_API_KEY", "").strip
      raise DemoError.new("configuration_error", "Set INTTEGRO_API_KEY on the server.") if api_key.empty?
      product_id = ENV.fetch("INTTEGRO_DEMO_PRODUCT_ID", "").strip
      price_id = ENV.fetch("INTTEGRO_DEMO_PRICE_ID", "").strip
      unless product_id.match?(/\Aprod_[A-Za-z0-9]+\z/) && price_id.match?(/\Apr_[A-Za-z0-9]+\z/)
        raise DemoError.new("configuration_error", "Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.")
      end

      public_origin = "#{uri.scheme}://#{uri.host}"
      public_origin += ":#{uri.port}" unless [80, 443].include?(uri.port)
      # INTTEGRO:ALTERNATIVE [server-api-key] A production container can inject a
      # startup-configured client for transport reuse and application-owned
      # OpenTelemetry. Per-operation construction keeps this demo easy to trace.
      # https://studio.inttegro.com/sdk-observability
      client = Inttegro::Client.new(api_key: api_key)
      # INTTEGRO:FLOW [catalog-lookup] Fetch at checkout time so publication and
      # price changes are observed. A high-volume service can add a short cache
      # with explicit invalidation. https://studio.inttegro.com/products
      product = catalog_selection(client.products.lookup(product_id: product_id), price_id)
      order = client.orders.create(order_params(checkout, public_origin, product))
      # INTTEGRO:DECISION [returned-checkout-url] Use the response URL rather
      # than deriving one from order.id and undocumented routing conventions.
      checkout_url = order.invoice&.format_value&.web&.url
      raise DemoError.new("api_error", "Inttegro did not return a hosted checkout URL.") if checkout_url.blank?
      { order_id: order.id, checkout_url: checkout_url }
    rescue DemoError
      raise
    rescue Inttegro::APIError
      # INTTEGRO:SECURITY [safe-error-boundary] Raw SDK payloads, authorization
      # data, and stack traces stay in protected diagnostics. Public errors use
      # a stable vocabulary; log only bounded metadata and request IDs.
      raise DemoError.new("api_error", "Inttegro rejected the checkout request.")
    rescue StandardError
      raise DemoError.new("api_error", "Checkout is temporarily unavailable.")
    end
  end
end
