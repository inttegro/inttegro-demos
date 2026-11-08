<?php

namespace App\Services;

use Inttegro\APIError;
use Inttegro\Client;
use Inttegro\PriceParams;
use Inttegro\Product;
use Inttegro\ProductType;
use RuntimeException;

/*
 * Inttegro integration map
 *
 * INTTEGRO:FLOW [hosted-checkout] This server-only service creates and
 * finalizes the Kora Market Order and returns its hosted invoice URL.
 * INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY belongs only in the
 * trusted PHP process. Never expose it through VITE_ variables, Blade, public
 * assets, logs, or error responses.
 * INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment offers more UI
 * control but makes the merchant own more payment state, recovery,
 * method-specific behavior, testing, and compliance analysis.
 * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
 * INTTEGRO:DOCS https://studio.inttegro.com/orders
 * INTTEGRO:DOCS https://studio.inttegro.com/keys
 * See ../../../INTEGRATION_GUIDE.md and ../../../integration-decisions.json for the shared
 * rationale and machine-readable alternatives.
 */

final class DemoError extends RuntimeException
{
    public function __construct(public readonly string $errorCode, string $message, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}

final class CheckoutService
{
    /**
     * @return array{type: ProductType, name: string, about: ?string, reference: ?string, price: PriceParams}
     */
    public static function catalogSelection(Product $product, string $priceId): array
    {
        // INTTEGRO:SECURITY [catalog-authority] Product, Price, and amount are
        // deployment configuration resolved with the server credential. The
        // public form cannot choose any of them.
        if (!$product->active) {
            throw new DemoError('configuration_error', 'The configured demo product is not active.');
        }

        $selected = null;
        foreach ($product->prices ?? [] as $price) {
            if ($price->id === $priceId && $price->active) {
                $selected = $price;
                break;
            }
        }
        if ($selected === null || $selected->fixedAmount === null || $selected->fixedAmount->value <= 0) {
            throw new DemoError('configuration_error', 'The configured demo price is not active for this product.');
        }

        return [
            'type' => ProductType::from($product->type),
            'name' => $product->name,
            'about' => $product->about,
            'reference' => $product->reference,
            'price' => new PriceParams($selected->fixedAmount->currency, $selected->fixedAmount->value),
        ];
    }

    /**
     * @param array{name: string, email: string, phone: string, attempt_id: string} $checkout
     * @param array{type: ProductType, name: string, about: ?string, reference: ?string, price: PriceParams} $product
     */
    public static function orderPayload(array $checkout, string $origin, array $product): array
    {
        return [
            // INTTEGRO:DECISION [stable-idempotency-key] Reuse the key for a
            // retry of this logical checkout. Production code should persist a
            // cart/invoice-derived key; creating a new key after a timeout can
            // create a duplicate. https://studio.inttegro.com/idempotency
            'request_meta' => ['idempotency_key' => 'demo-'.$checkout['attempt_id']],
            // INTTEGRO:DECISION [merchant-order-number] Supply a recognizable
            // merchant reference instead of accepting Inttegro's generated or_
            // ID fallback. The validated attempt makes this demo value stable
            // across retries. Production should use its persisted sales-order
            // number and never include customer PII.
            'number' => 'KORA-'.strtoupper(substr(str_replace('_', '-', $checkout['attempt_id']), 0, 48)),
            // INTTEGRO:DECISION [inline-customer] customer_data suits this guest
            // flow. Account-based apps should resolve customer_id server-side;
            // the Orders API accepts exactly one customer representation.
            'customer_data' => ['name' => $checkout['name'], 'email_address' => $checkout['email'], 'phone_number' => $checkout['phone']],
            // INTTEGRO:DECISION [finalize-on-create] The cart is settled, so one
            // operation freezes the Order and produces invoice formats. Use a
            // draft, updates, then finalization when tax, shipping, inventory,
            // approval, or line items can still change.
            'finalize' => true,
            'checkout_settings' => ['redirect_url' => $origin.'/complete', 'cancel_url' => $origin.'/cancel'],
            'line_items' => [[
                'type' => 'product',
                'product' => [
                    // INTTEGRO:DECISION [catalog-snapshot] The service looks up
                    // the configured Product and Price, verifies their
                    // relationship, and snapshots those authoritative fields
                    // into the Order for compatibility across SDK versions.
                    // INTTEGRO:ALTERNATIVE [catalog-snapshot] When the SDK
                    // exposes the typed catalogue union, send product_id +
                    // price_id + quantity instead and omit the inline fields.
                    'type' => $product['type'],
                    'name' => $product['name'],
                    'about' => $product['about'],
                    'reference' => $product['reference'],
                    'quantity' => 1,
                    'price' => $product['price'],
                ],
            ]],
        ];
    }

    /** @param array{name: string, email: string, phone: string, attempt_id: string} $checkout
     *  @return array{order_id: string, checkout_url: string}
     */
    public static function create(array $checkout, string $origin): array
    {
        // INTTEGRO:SECURITY [server-api-key] Load the key from a deployment
        // secret store in production and rotate it there. Do not serialize it.
        $apiKey = trim((string) getenv('INTTEGRO_API_KEY'));
        if ($apiKey === '') {
            throw new DemoError('configuration_error', 'Set INTTEGRO_API_KEY on the server.');
        }
        $productId = trim((string) getenv('INTTEGRO_DEMO_PRODUCT_ID'));
        $priceId = trim((string) getenv('INTTEGRO_DEMO_PRICE_ID'));
        if (!preg_match('/^prod_[A-Za-z0-9]+$/', $productId) || !preg_match('/^pr_[A-Za-z0-9]+$/', $priceId)) {
            throw new DemoError('configuration_error', 'Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.');
        }
        // INTTEGRO:SECURITY [configured-public-origin] Prefer an allow-listed
        // origin in production. Request-derived values are safe only behind a
        // precise trusted-proxy configuration. Return URLs must be HTTP(S), and
        // Inttegro appends order_id after checkout.
        $parts = parse_url($origin);
        if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], true) || empty($parts['host'])) {
            throw new DemoError('configuration_error', 'The demo public URL is invalid.');
        }
        $publicOrigin = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');

        try {
            // INTTEGRO:ALTERNATIVE [server-api-key] A production container may
            // inject one startup-configured Client for transport reuse and
            // application-owned OpenTelemetry. Per-call construction is concise
            // for the demo. https://studio.inttegro.com/sdk-observability
            $client = new Client($apiKey);
            // INTTEGRO:FLOW [catalog-lookup] Resolve the Product at checkout so
            // publication and price changes take effect. High-volume services
            // can use a short cache with explicit invalidation.
            // https://studio.inttegro.com/products
            $product = self::catalogSelection($client->products->lookup($productId), $priceId);
            $order = $client->orders->create(self::orderPayload($checkout, $publicOrigin, $product));
            // INTTEGRO:DECISION [returned-checkout-url] Use the URL in the
            // response. Constructing one from the order ID relies on
            // undocumented routing conventions.
            $checkoutUrl = $order->invoice?->format?->web?->url;
            if (!$checkoutUrl) {
                throw new DemoError('api_error', 'Inttegro did not return a hosted checkout URL.');
            }
            return ['order_id' => $order->id, 'checkout_url' => $checkoutUrl];
        } catch (DemoError $error) {
            throw $error;
        } catch (APIError $error) {
            // INTTEGRO:SECURITY [safe-error-boundary] Keep raw API bodies,
            // credentials, and traces in protected diagnostics. Public messages
            // remain stable; log only bounded metadata and request IDs.
            throw new DemoError('api_error', 'Inttegro rejected the checkout request.', previous: $error);
        } catch (\Throwable $error) {
            throw new DemoError('api_error', 'Checkout is temporarily unavailable.', previous: $error);
        }
    }
}
