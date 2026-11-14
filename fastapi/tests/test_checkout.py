import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest
import inttegro
from inttegro.money import Currency
from inttegro.product import Type as ProductType

from app.checkout import (
    CatalogSelection,
    CheckoutInput,
    DemoError,
    build_order_request,
    create_hosted_checkout,
    parse_checkout_input,
)


def test_rejects_invalid_email():
    with pytest.raises(DemoError):
        parse_checkout_input("Akua", "bad", "+233", "attempt_123")


def test_static_assets_resolve_from_the_application_root():
    from app.main import STATIC_ROOT, render_home, render_result

    assert STATIC_ROOT == Path(__file__).resolve().parents[1] / "public" / "static"
    assert (STATIC_ROOT / "checkout-presentations.js").is_file()
    home = render_home("attempt_123", "validation_error", r"\g<0><invalid>")
    assert 'value="attempt_123"' in home
    assert r"\g&lt;0&gt;&lt;invalid&gt;" in home
    assert "{%" not in render_result(True)
    assert "Reservation received" in render_result(True)
    assert "Reservation paused" in render_result(False)


def test_builds_shared_order_request():
    product = CatalogSelection(
        type=ProductType.DIGITAL,
        name="Afterglow Sessions — Courtyard Admission",
        about="An evening of music and conversation.",
        reference="DEMO-AFTERGLOW-COURTYARD",
        price=inttegro.price.InlineParams(currency=Currency.GHS, value=5000),
    )
    request = build_order_request(
        CheckoutInput("Akua", "akua@example.com", "+233", "attempt_123"),
        "https://demo.example",
        product,
    )
    assert request.request_meta.idempotency_key == "demo-attempt_123"
    assert request.number == "AFTERGLOW-ATTEMPT-123"
    assert request.finalize is True
    assert request.checkout_settings.redirect_url == "https://demo.example/complete"
    assert request.line_items[0].product.name == "Afterglow Sessions — Courtyard Admission"
    assert request.line_items[0].product.type.value == "digital"
    assert request.line_items[0].product.price.value == 5000


def test_async_checkout_awaits_catalog_and_order_resources():
    calls = []

    class Products:
        async def lookup(self, product_id):
            calls.append(("products.lookup", product_id))
            return SimpleNamespace(
                active=True,
                type=ProductType.DIGITAL,
                name="Afterglow Sessions — Courtyard Admission",
                about="An evening of music and conversation.",
                reference="DEMO-AFTERGLOW-COURTYARD",
                prices=[
                    SimpleNamespace(
                        id="pr_demo123",
                        active=True,
                        fixed_amount=SimpleNamespace(currency=Currency.GHS, value=5000),
                    )
                ],
            )

    class Orders:
        async def create(self, request):
            calls.append(("orders.create", request.number))
            return SimpleNamespace(
                id="or_demo123",
                invoice=SimpleNamespace(
                    format=SimpleNamespace(web=SimpleNamespace(url="https://pages.inttegro.com/invoices/or_demo123"))
                ),
            )

    client = SimpleNamespace(products=Products(), orders=Orders())
    result = asyncio.run(
        create_hosted_checkout(
            CheckoutInput("Akua", "akua@example.com", "+233", "attempt_123"),
            "https://demo.example",
            client,
            "prod_demo123",
            "pr_demo123",
        )
    )

    assert result == ("or_demo123", "https://pages.inttegro.com/invoices/or_demo123")
    assert calls == [
        ("products.lookup", "prod_demo123"),
        ("orders.create", "AFTERGLOW-ATTEMPT-123"),
    ]
