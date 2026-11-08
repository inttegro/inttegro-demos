import asyncio
from types import SimpleNamespace

from django.test import Client, SimpleTestCase, override_settings
import inttegro
from inttegro import Currency, ProductType

from checkout.service import (
    CatalogSelection,
    CheckoutInput,
    DemoError,
    build_order_request,
    create_hosted_checkout,
    parse_checkout_input,
)
from worker_compat import _inline_sync_to_async


class CheckoutServiceTests(SimpleTestCase):
    def test_worker_sync_hook_adapter_stays_on_the_event_loop(self):
        thread_calls = []

        def framework_hook(value):
            thread_calls.append(value)
            return value.upper()

        result = asyncio.run(_inline_sync_to_async(framework_hook)("closed"))

        self.assertEqual(result, "CLOSED")
        self.assertEqual(thread_calls, ["closed"])

    def test_rejects_invalid_email(self):
        with self.assertRaises(DemoError):
            parse_checkout_input({"name": "Akua", "email": "bad", "phone": "+233", "attempt_id": "attempt_123"})

    def test_builds_shared_order_request(self):
        product = CatalogSelection(
            type=ProductType.DIGITAL,
            name="Afterglow Sessions — Courtyard Admission",
            about="An evening of music and conversation.",
            reference="DEMO-AFTERGLOW-COURTYARD",
            price=inttegro.PriceParams(currency=Currency.GHS, value=5000),
        )
        request = build_order_request(
            CheckoutInput("Akua", "akua@example.com", "+233", "attempt_123"),
            "https://demo.example",
            product,
        )
        self.assertEqual(request.request_meta.idempotency_key, "demo-attempt_123")
        self.assertEqual(request.number, "AFTERGLOW-ATTEMPT-123")
        self.assertTrue(request.finalize)
        self.assertEqual(request.checkout_settings.redirect_url, "https://demo.example/complete")
        self.assertEqual(request.line_items[0].product.name, "Afterglow Sessions — Courtyard Admission")
        self.assertEqual(request.line_items[0].product.type.value, "digital")
        self.assertEqual(request.line_items[0].product.price.value, 5000)

    def test_async_checkout_awaits_catalog_and_order_resources(self):
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

        self.assertEqual(result, ("or_demo123", "https://pages.inttegro.com/invoices/or_demo123"))
        self.assertEqual(
            calls,
            [
                ("products.lookup", "prod_demo123"),
                ("orders.create", "AFTERGLOW-ATTEMPT-123"),
            ],
        )

    @override_settings(
        CSRF_TRUSTED_ORIGINS=["https://django-demo.inttegro.dev"],
        INTTEGRO_DEMO_PUBLIC_URL="https://django-demo.inttegro.dev",
        STORAGES={
            "staticfiles": {
                "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
            }
        },
    )
    def test_trusted_https_proxy_accepts_public_origin(self):
        client = Client(enforce_csrf_checks=True)
        page = client.get("/", HTTP_X_FORWARDED_PROTO="https")
        csrf_token = page.cookies["csrftoken"].value

        response = client.post(
            "/checkout",
            {
                "csrfmiddlewaretoken": csrf_token,
                "attempt_id": "attempt_123",
                "name": "Akua Mensah",
                "email": "invalid",
                "phone": "+233544998605",
            },
            HTTP_ORIGIN="https://django-demo.inttegro.dev",
            HTTP_X_FORWARDED_PROTO="https",
        )

        # Invalid input reaches the view and follows its bounded error redirect;
        # a proxy/CSRF regression would return 403 before the view runs.
        self.assertEqual(response.status_code, 303)
        self.assertIn("code=validation_error", response.headers["Location"])
