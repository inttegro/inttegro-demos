import Inttegro
import OSLog
import SwiftUI

/*
 Inttegro payment-sheet integration map

 INTTEGRO:FLOW [native-payment-sheet] Create a finalized Order through the
 merchant backend, configure the Inttegro SDK with its ID and this app's return
 URL, then present InttegroPaymentSheet.
 INTTEGRO:SECURITY [server-api-key] The native app receives an order ID, never a
 merchant API key. See https://studio.inttegro.com/keys.
 INTTEGRO:ALTERNATIVE [native-payment-sheet] A product that intentionally
 prefers browser checkout can open the hosted invoice URL in a secure browser
 surface, while preserving the same server-side verification boundary.
 INTTEGRO:DOCS https://studio.inttegro.com/sdks
 INTTEGRO:DOCS https://studio.inttegro.com/payment-methods
 See ../../INTEGRATION_GUIDE.md and ../../integration-decisions.json for the
 shared rationale and machine-readable alternatives.
 */

private let paymentSheetLogger = Logger(
    subsystem: "com.inttegro.demo.swiftui",
    category: "PaymentSheet"
)

struct CheckoutView: View {
    private let finishes = ["Sunrise", "Night earth", "River sand"]

    @State private var configuration: PaymentSheetConfiguration?
    @State private var isCreatingOrder = false
    @State private var isFavorite = false
    @State private var isPaymentSheetPresented = false
    @State private var outcome: String?
    @State private var selectedCategory = "New in"
    @State private var selectedFinish = "Sunrise"

    init() {
#if DEBUG
        let screenshotMode = ProcessInfo.processInfo.environment["INTTEGRO_STUDIO_SCREENSHOTS"]
        if screenshotMode == "1" || screenshotMode == "features" {
            _configuration = State(
                initialValue: try? PaymentSheetConfiguration(
                    orderID: "or_studio_screenshot",
                    returnURL: URL(string: "inttegro-demo://inttegro-return"),
                    appearance: .init(primaryColor: "#173D33", cornerRadius: 30),
                    features: .init(
                        showLineItems: screenshotMode == "features",
                        showInvoiceDownload: screenshotMode == "features",
                        showReceiptDownload: screenshotMode == "features",
                        allowPaymentMethodChange: screenshotMode != "features"
                    )
                )
            )
            _isPaymentSheetPresented = State(initialValue: true)
        }
#endif
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    editorialIntro
                    productArtwork
                    productDetails
                }
            }
            .background(Color(.systemGroupedBackground))
            .scrollIndicators(.hidden)
            .navigationTitle("Kora Market")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { toolbarContent }
            .safeAreaInset(edge: .bottom) { checkoutBar }
            .sheet(isPresented: $isPaymentSheetPresented) { paymentSheet }
        }
        .tint(.koraForest)
    }

    private var editorialIntro: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("VOLTA STUDIO")
                Spacer()
                Text("OBJECT 01—03")
            }
            .font(.caption2.weight(.bold))
            .tracking(1.5)
            .foregroundStyle(.secondary)
            .padding(.top, 10)
            .overlay(alignment: .top) { Divider() }

            Text("A slower,\nwarmer morning.")
                .font(.system(size: 58, weight: .regular, design: .serif))
                .tracking(-3)
                .lineSpacing(-7)
                .foregroundStyle(Color.koraInk)
                .padding(.top, 46)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 32)
    }

    private var productArtwork: some View {
        ZStack(alignment: .top) {
            Image("KoraProduct")
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity)
                .aspectRatio(4 / 5, contentMode: .fill)
                .clipped()
                .accessibilityLabel("Terracotta Dawn Brew Set with a pour-over and cup")

            HStack {
                Label("Small batch", systemImage: "hand.raised.fill")
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .background(.regularMaterial, in: Rectangle())
                Spacer()
                Button {
                    withAnimation(.spring(response: 0.28, dampingFraction: 1)) { isFavorite.toggle() }
                } label: {
                    Image(systemName: isFavorite ? "heart.fill" : "heart")
                        .frame(width: 42, height: 42)
                        .background(.regularMaterial, in: Circle())
                }
                .accessibilityLabel(isFavorite ? "Remove from favorites" : "Add to favorites")
            }
            .padding(18)
        }
    }

    private var productDetails: some View {
        VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 9) {
                Text("HAND-THROWN STONEWARE · HO, GHANA")
                    .font(.caption2.weight(.bold))
                    .tracking(1.35)
                    .foregroundStyle(Color.koraClay)
                HStack(alignment: .firstTextBaseline) {
                    Text("Dawn Brew Set")
                        .font(.system(.largeTitle, design: .serif, weight: .medium))
                        .tracking(-1.4)
                    Spacer()
                    Text("GHS 50")
                        .font(.system(.title2, design: .serif, weight: .medium))
                }
                HStack(spacing: 7) {
                    Label("4.9", systemImage: "star.fill").foregroundStyle(.orange)
                    Text("240 reviews").foregroundStyle(.secondary)
                    Spacer()
                    Label("Ready to ship", systemImage: "checkmark.circle.fill").foregroundStyle(.green)
                }
                .font(.subheadline.weight(.medium))
            }

            Text("A sculptural pour-over and cup, shaped by hand in Ho for slower mornings and more considered rituals.")
                .font(.body)
                .foregroundStyle(.secondary)
                .lineSpacing(5)

            VStack(alignment: .leading, spacing: 12) {
                HStack { Text("Finish").font(.headline); Spacer(); Text(selectedFinish).font(.subheadline).foregroundStyle(.secondary) }
                HStack(spacing: 10) {
                    ForEach(finishes, id: \.self) { finish in
                        Button { selectedFinish = finish } label: {
                            Circle()
                                .fill(finishColor(finish))
                                .frame(width: 34, height: 34)
                                .padding(4)
                                .overlay(Circle().stroke(selectedFinish == finish ? Color.primary : .clear, lineWidth: 2))
                        }
                        .accessibilityLabel(finish)
                        .accessibilityAddTraits(selectedFinish == finish ? .isSelected : [])
                    }
                }
            }

            VStack(alignment: .leading, spacing: 16) {
                Label("Made by Ama Ofori", systemImage: "person.crop.circle")
                    .font(.system(.title3, design: .serif, weight: .medium))
                Text("Every piece keeps the subtle marks of its making. Local clay is fired to a food-safe finish, then packed without plastic for delivery across Ghana.")
                    .foregroundStyle(Color.white.opacity(0.72))
                    .lineSpacing(4)
                Divider()
                HStack {
                    Label("Delivery in 2–4 days", systemImage: "shippingbox")
                    Spacer()
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.white)
            }
            .padding(20)
            .background(Color.koraMoss)

            if let outcome {
                Label(outcome, systemImage: "checkmark.shield.fill")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .accessibilityLabel("Latest payment result: \(outcome)")
            }
        }
        .padding(20)
        .padding(.bottom, 26)
    }

    private var checkoutBar: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Total").font(.caption).foregroundStyle(.secondary)
                Text("GHS 50.00").font(.headline)
            }
            Button(action: beginCheckout) {
                HStack(spacing: 10) {
                    if isCreatingOrder { ProgressView().tint(.white) }
                    Text(isCreatingOrder ? "Preparing checkout" : "Pay with Inttegro")
                        .font(.headline)
                }
                .frame(maxWidth: .infinity)
                .frame(height: 52)
            }
            .buttonStyle(.borderedProminent)
            .buttonBorderShape(.capsule)
            .disabled(isCreatingOrder)
            .accessibilityHint("Opens the secure Inttegro payment sheet")
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }

    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItem(placement: .navigationBarLeading) {
            Menu {
                Button("New in") { selectedCategory = "New in" }
                Button("Table") { selectedCategory = "Table" }
                Button("Textiles") { selectedCategory = "Textiles" }
                Button("Objects") { selectedCategory = "Objects" }
            } label: {
                Image(systemName: "line.3.horizontal")
            }
            .accessibilityLabel("Open menu")
        }
        ToolbarItem(placement: .navigationBarTrailing) {
            Button(action: beginCheckout) { Image(systemName: "bag").symbolVariant(.fill) }
                .accessibilityLabel("Shopping bag, one item")
                .disabled(isCreatingOrder)
        }
    }

    @ViewBuilder
    private var paymentSheet: some View {
        if let configuration {
            // INTTEGRO:DECISION [native-payment-sheet] Inttegro owns the native
            // payment-method UI and provider transitions. Kora Market retains
            // its product, cart, loading, cancellation, and result experience.
#if DEBUG
            if isStudioScreenshotMode {
                InttegroPaymentSheet(
                    configuration: configuration,
                    adapter: StudioScreenshotPaymentSheetAdapter(
                        includeAttachedMethod: isStudioFeatureScreenshotMode
                    ),
                    onCompletion: handle
                )
            } else {
                livePaymentSheet(configuration)
            }
#else
            livePaymentSheet(configuration)
#endif
        }
    }

    private func livePaymentSheet(_ configuration: PaymentSheetConfiguration) -> some View {
        InttegroPaymentSheet(
            configuration: configuration,
            // INTTEGRO:OBSERVABILITY [application-owned-observability] These
            // privacy-safe lifecycle events go to the app's own logger. They
            // are diagnostics, not payment state; do not add customer data,
            // secrets, or raw provider payloads.
            telemetryEventHandler: logPaymentSheetEvent,
            onCompletion: handle
        )
    }

    private var isStudioScreenshotMode: Bool {
#if DEBUG
        let mode = ProcessInfo.processInfo.environment["INTTEGRO_STUDIO_SCREENSHOTS"]
        return mode == "1" || mode == "features"
#else
        false
#endif
    }

    private var isStudioFeatureScreenshotMode: Bool {
#if DEBUG
        ProcessInfo.processInfo.environment["INTTEGRO_STUDIO_SCREENSHOTS"] == "features"
#else
        false
#endif
    }

    private func finishColor(_ finish: String) -> Color {
        switch finish {
        case "Night earth": Color(red: 0.18, green: 0.16, blue: 0.15)
        case "River sand": Color(red: 0.76, green: 0.66, blue: 0.52)
        default: Color(red: 0.72, green: 0.27, blue: 0.16)
        }
    }

    private func beginCheckout() {
        guard !isCreatingOrder else { return }
        isCreatingOrder = true
        outcome = nil
        Task { @MainActor in
            defer { isCreatingOrder = false }
            do {
                // INTTEGRO:FLOW [mobile-backend-boundary] The merchant backend
                // authenticates and constructs the order. The app never creates
                // an order with an Inttegro API key.
                let orderID = try await DemoBackend.configured().createCheckoutOrder()
                // INTTEGRO:DECISION [native-payment-sheet] The order must already
                // be finalized and checkout-ready. Register this return URL in
                // the application; it resumes UX after external authorization
                // but does not prove payment.
                configuration = try PaymentSheetConfiguration(
                    orderID: orderID,
                    returnURL: URL(string: "inttegro-demo://payment-return")
                )
                isPaymentSheetPresented = true
            } catch {
                outcome = (error as? LocalizedError)?.errorDescription
                    ?? "Payment is temporarily unavailable."
            }
        }
    }

    private func handle(_ result: PaymentSheetResult) {
        // INTTEGRO:VERIFY [server-side-verification] This callback controls
        // immediate UI only. A completed sheet is not fulfillment authority.
        // The merchant backend must look up the owner-scoped Order and use
        // bounded polling plus reconciliation because merchant-facing webhooks
        // are not currently available: https://studio.inttegro.com/webhooks.
        isPaymentSheetPresented = false
        switch result {
        case .completed: outcome = "Payment submitted. We’ll verify it before fulfillment."
        case .canceled: outcome = "Checkout paused. Your Dawn Brew Set is still in the bag."
        case let .failed(failure): outcome = "Payment unavailable (\(failure.code))."
        }
    }
}

private func logPaymentSheetEvent(_ event: PaymentSheetTelemetryEvent) {
    // INTTEGRO:OBSERVABILITY [application-owned-observability] Bounded IDs,
    // operation, status, sequence, and error type are useful for correlation.
    // Keep customer details, credentials, and request/response bodies out of
    // logs. Telemetry is not a substitute for authoritative order lookup.
    // https://studio.inttegro.com/sdk-observability
    paymentSheetLogger.info(
        "flow=\(event.flowID, privacy: .public) event=\(event.name.rawValue, privacy: .public) sequence=\(event.sequence) operation=\(event.operation ?? "none", privacy: .public) status=\(event.httpStatusCode ?? 0) request=\(event.requestID ?? "none", privacy: .public) error=\(event.errorType ?? "none", privacy: .public)"
    )
}

private extension Color {
    static let koraForest = Color(red: 0.09, green: 0.24, blue: 0.20)
    static let koraInk = Color(red: 0.11, green: 0.13, blue: 0.11)
    static let koraClay = Color(red: 0.66, green: 0.30, blue: 0.20)
    static let koraMoss = Color(red: 0.22, green: 0.29, blue: 0.24)
}

#if DEBUG
private struct StudioScreenshotPaymentSheetAdapter: PaymentSheetAdapter {
    let includeAttachedMethod: Bool

    func retrieveCheckout(orderID _: String) async throws -> PaymentSheetSession {
        try await Task.sleep(for: .milliseconds(250))
        let newMobileMoneyMethod = PaymentSheetSession.PaymentMethod(
            id: "mobile_money",
            kind: .mobileMoney,
            source: .new,
            label: "Mobile Money",
            detail: "MTN MoMo, Telecel Cash, or AirtelTigo Money"
        )
        let paymentMethods: [PaymentSheetSession.PaymentMethod] = if includeAttachedMethod {
            [
                .init(
                    id: "momo_saved",
                    kind: .mobileMoney,
                    label: "MTN Mobile Money",
                    detail: "••• ••• 0042"
                ),
                newMobileMoneyMethod,
            ]
        } else {
            [newMobileMoneyMethod]
        }
        return PaymentSheetSession(
            id: "or_studio_screenshot",
            merchant: .init(
                displayName: "Kora Market",
                supportText: nil
            ),
            amount: .init(value: 5_000, currency: "GHS"),
            paymentMethods: paymentMethods,
            expiresAt: Date().addingTimeInterval(15 * 60),
            lineItems: [
                .init(
                    id: "line_dawn_brew_set",
                    name: "Dawn Brew Set",
                    quantity: 1,
                    total: .init(value: 5_000, currency: "GHS")
                ),
            ],
            documents: .init(
                invoiceURL: URL(string: "https://example.com/invoice.pdf"),
                receiptURL: URL(string: "https://example.com/receipt.pdf")
            )
        )
    }

    func pay(
        session _: PaymentSheetSession,
        selection _: PaymentSheetPaymentSelection
    ) async throws -> PaymentSheetPaymentOutcome {
        try await Task.sleep(for: .milliseconds(500))
        return .requiresConfirmation(Self.confirmationChallenge())
    }

    func requestConfirmation(
        session _: PaymentSheetSession,
        challenge _: PaymentSheetConfirmationChallenge
    ) async throws -> PaymentSheetPaymentOutcome {
        .requiresConfirmation(Self.confirmationChallenge())
    }

    func confirmPayment(
        session _: PaymentSheetSession,
        challenge _: PaymentSheetConfirmationChallenge,
        token _: String
    ) async throws -> PaymentSheetPaymentOutcome {
        .pending(
            .authorize(
                scheme: "mtn",
                expiresAt: Date().addingTimeInterval(5 * 60)
            )
        )
    }

    func refreshPayment(
        session _: PaymentSheetSession
    ) async throws -> PaymentSheetPaymentOutcome {
        try await Task.sleep(for: .seconds(30))
        return .completed(paymentID: "py_studio_screenshot")
    }

    private static func confirmationChallenge() -> PaymentSheetConfirmationChallenge {
        PaymentSheetConfirmationChallenge(
            paymentID: "py_studio_screenshot",
            confirmationID: "cnf_studio_screenshot",
            recipient: "••• ••• 0042",
            sentVia: "SMS",
            tokenSize: 6,
            expiresAt: Date().addingTimeInterval(5 * 60),
            requestAfter: Date().addingTimeInterval(30)
        )
    }
}
#endif

#Preview { CheckoutView() }
