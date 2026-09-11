package com.inttegro.demo.compose

import com.inttegro.payments.PaymentSheetAdapter
import com.inttegro.payments.PaymentSheetConfiguration
import com.inttegro.payments.PaymentSheetConfirmationChallenge
import com.inttegro.payments.PaymentSheetExternalAction
import com.inttegro.payments.PaymentSheetPaymentOutcome
import com.inttegro.payments.PaymentSheetPaymentSelection
import com.inttegro.payments.PaymentSheetSession
import java.time.Instant

/** Deterministic, non-networked checkout data used only for documentation capture builds. */
object DemoPaymentSheetAdapter : PaymentSheetAdapter {
    override suspend fun retrieve(
        configuration: PaymentSheetConfiguration,
    ): PaymentSheetSession = PaymentSheetSession(
        id = "or_android_documentation",
        merchant = PaymentSheetSession.Merchant(displayName = "Kora Market"),
        amount = PaymentSheetSession.Money(value = 5_000, currency = "GHS"),
        paymentMethods = buildList {
            if (BuildConfig.INTTEGRO_SCREENSHOT_FEATURES) {
                add(
                    PaymentSheetSession.PaymentMethod(
                        id = "pm_demo_mtn",
                        kind = PaymentSheetSession.PaymentMethod.Kind.MOBILE_MONEY,
                        source = PaymentSheetSession.PaymentMethod.Source.SAVED,
                        label = "MTN Mobile Money",
                        detail = "••• ••• 0042",
                    ),
                )
            }
            add(
                PaymentSheetSession.PaymentMethod(
                id = "new_mobile_money",
                kind = PaymentSheetSession.PaymentMethod.Kind.MOBILE_MONEY,
                source = PaymentSheetSession.PaymentMethod.Source.NEW,
                    label = "Mobile Money",
                ),
            )
        },
        expiresAt = Instant.now().plusSeconds(60 * 60),
        lineItems = listOf(
            PaymentSheetSession.LineItem(
                id = "line_dawn_brew_set",
                name = "Dawn Brew Set",
                quantity = 1,
                total = PaymentSheetSession.Money(value = 5_000, currency = "GHS"),
            ),
        ),
        documents = PaymentSheetSession.Documents(
            invoiceUrl = "https://example.com/invoice.pdf",
            receiptUrl = "https://example.com/receipt.pdf",
        ),
    )

    override suspend fun pay(
        configuration: PaymentSheetConfiguration,
        session: PaymentSheetSession,
        selection: PaymentSheetPaymentSelection,
    ): PaymentSheetPaymentOutcome =
        PaymentSheetPaymentOutcome.RequiresConfirmation(confirmationChallenge())

    override suspend fun requestConfirmation(
        configuration: PaymentSheetConfiguration,
        session: PaymentSheetSession,
        challenge: PaymentSheetConfirmationChallenge,
    ): PaymentSheetPaymentOutcome =
        PaymentSheetPaymentOutcome.RequiresConfirmation(confirmationChallenge())

    override suspend fun confirmPayment(
        configuration: PaymentSheetConfiguration,
        session: PaymentSheetSession,
        challenge: PaymentSheetConfirmationChallenge,
        token: String,
    ): PaymentSheetPaymentOutcome =
        PaymentSheetPaymentOutcome.Pending(
            PaymentSheetExternalAction.Authorize(
                scheme = "mtn",
                expiresAt = Instant.now().plusSeconds(5 * 60),
            ),
        )

    override suspend fun refreshPayment(
        configuration: PaymentSheetConfiguration,
        session: PaymentSheetSession,
    ): PaymentSheetPaymentOutcome =
        PaymentSheetPaymentOutcome.Completed("pay_android_documentation")

    private fun confirmationChallenge() = PaymentSheetConfirmationChallenge(
        paymentId = "pay_android_documentation",
        confirmationId = "cnf_android_documentation",
        recipient = "••• ••• 0042",
        sentVia = "SMS",
        tokenSize = 6,
        expiresAt = Instant.now().plusSeconds(5 * 60),
        requestAfter = Instant.now().plusSeconds(30),
    )
}
