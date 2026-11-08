require "test_helper"

class CheckoutServiceTest < ActiveSupport::TestCase
  test "rejects invalid email" do
    error = assert_raises(CheckoutService::DemoError) do
      CheckoutService.parse("name" => "Akua", "email" => "bad", "phone" => "+233", "attempt_id" => "attempt_123")
    end
    assert_equal "validation_error", error.code
  end

  test "builds the shared order request" do
    checkout = CheckoutService::Checkout.new(name: "Akua", email: "akua@example.com", phone: "+233", attempt_id: "attempt_123")
    product = {
      type: Inttegro::ProductType::PHYSICAL,
      name: "Dawn Brew Set",
      reference: "DEMO-KORA-DAWN-BREW",
      price: Inttegro::PriceParams.new(currency: Inttegro::Currency::GHS, value: 5000)
    }
    request = CheckoutService.order_params(checkout, "https://demo.example", product)
    assert_equal "demo-attempt_123", request.dig(:request_meta, :idempotency_key)
    assert_equal "KORA-ATTEMPT-123", request[:number]
    assert_equal true, request[:finalize]
    assert_equal "https://demo.example/complete", request.dig(:checkout_settings, :redirect_url)
    assert_equal "Dawn Brew Set", request.dig(:line_items, 0, :product, :name)
    assert_equal Inttegro::ProductType::PHYSICAL, request.dig(:line_items, 0, :product, :type)
    assert_equal 5000, request.dig(:line_items, 0, :product, :price).value
  end

  test "selects only the configured active catalog price" do
    product = Inttegro::Product.new(
      id: "prod_demo",
      type: Inttegro::ProductType::PHYSICAL,
      name: "Dawn Brew Set",
      active: true,
      created_at: "2026-09-06T00:00:00Z",
      prices: [Inttegro::ProductPriceSummary.new(
        id: "pr_demo",
        active: true,
        type: Inttegro::Price::Type::FIXED_AMOUNT,
        fixed_amount: Inttegro::Amount.new(currency: Inttegro::Currency::GHS, value: 5000)
      )]
    )

    selected = CheckoutService.catalog_selection(product, "pr_demo")
    assert_equal "Dawn Brew Set", selected[:name]
    assert_equal 5000, selected[:price].value
    assert_raises(CheckoutService::DemoError) { CheckoutService.catalog_selection(product, "pr_missing") }
  end
end
