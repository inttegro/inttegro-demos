# Inttegro SwiftUI demo

**Kora Market** is an iPhone-first product experience with category browsing,
product imagery, finish selection, fulfillment context, and a persistent native
checkout bar. It imports **Inttegro SDK** through Swift Package Manager and
presents the SDK's SwiftUI payment sheet without embedding a merchant API key.

The app asks the Kora Market backend for a finalized mobile-money-only order,
then uses the SDK's native Checkout transport. Payment-sheet telemetry is sent
to the host app's unified logging category without installing an exporter.

## Run

Requirements: Xcode 16 or newer and XcodeGen 2.44 or newer.

```sh
xcodegen generate
open InttegroSwiftUIDemo.xcodeproj
```

Set `INTTEGRO_DEMO_BACKEND_URL` in the scheme environment to the reachable
Next.js demo origin, then choose an iPhone simulator and run the
`InttegroSwiftUIDemo` scheme. For the simulator, `http://127.0.0.1:3000` is a
typical local value.

## Check

```sh
xcodegen generate
xcodebuild build \
  -project InttegroSwiftUIDemo.xcodeproj \
  -scheme InttegroSwiftUIDemo \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  CODE_SIGNING_ALLOWED=NO
```

A production app receives only a finalized `orderID` from its merchant backend.
Payment completion must still be verified on the server.

## Capture the native payment sheet

For documentation screenshots, launch a Debug build with
`INTTEGRO_STUDIO_SCREENSHOTS=1`. This opens the real SDK payment sheet with a
deterministic, local checkout fixture; it does not call the Inttegro API or
create a payment.

```sh
SIMCTL_CHILD_INTTEGRO_STUDIO_SCREENSHOTS=1 \
  xcrun simctl launch --terminate-running-process booted \
  com.inttegro.demo.swiftui

xcrun simctl io booted screenshot --mask alpha payment-sheet.png
```

Before capturing the one-time-code screen, turn off **I/O → Keyboard → Connect
Hardware Keyboard** in Simulator. The SDK focuses the first empty digit when the
screen opens; disconnecting the Mac keyboard lets Simulator show the same
numeric keyboard that appears automatically on a physical iPhone.

The switch is compiled only in Debug builds. Release builds always use the
SDK's live Checkout adapter.

The standard fixture opens without an attached payment method, so the first
screenshot documents the experience a new payer sees. The SDK begins at a
compact account-entry detent that keeps **Save for next time** and the disabled
Pay action visible. A complete account number reveals the provider choices and
moves to a taller review detent so none of those choices are clipped. The sheet
uses its full-height detent only for the keyboard, saved-details form, or another
longer task. Enable **Save for next time** to capture the complete native contact
and billing-address form. Values entered for a screenshot remain local to that
simulator run.

The screenshot fixture follows the complete native flow. Choose **Pay** to
capture the one-time-code screen, enter any six digits and choose **Continue**
to capture the approval screen, then choose **Check again** to capture
`Payment complete`. No payment is created.

Use `INTTEGRO_STUDIO_SCREENSHOTS=features` to capture the optional-feature
story. The opening sheet offers a collapsed Order summary and keeps the attached
payment method fixed. Opening the summary expands the sheet to the large detent
as the Checkout-provided line items are revealed. Its completed state offers
both invoice and receipt downloads. These links use inert documentation URLs
and should not be opened during capture.

## Deploy the companion backend

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/zebodotdev/inttegro-demos/tree/deploy-nextjs-v1.8.3)
[![Run backend with Docker](../assets/providers/docker-button.svg)](../nextjs/README.md#run-with-docker)
[![Deploy with Vercel](../assets/providers/vercel-button.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fzebodotdev%2Finttegro-demos%2Ftree%2Fdeploy-nextjs-v1.8.3&project-name=inttegro-demo-nextjs&repository-name=inttegro-demo-nextjs&env=INTTEGRO_API_KEY%2CINTTEGRO_DEMO_PRODUCT_ID%2CINTTEGRO_DEMO_PRICE_ID%2CINTTEGRO_DEMO_CUSTOMER_ID%2CINTTEGRO_DEMO_PUBLIC_URL&envDescription=Add%20a%20dedicated%20Inttegro%20API%20key%2C%20active%20Product%20and%20Price%20IDs%2C%20demo%20Customer%20ID%2C%20and%20the%20public%20origin.&envLink=https%3A%2F%2Fstudio.inttegro.com%2Fkeys)

These buttons create the Next.js companion service in your own account. Put its
public origin in `INTTEGRO_DEMO_BACKEND_URL`; the native app never receives the
server-held Inttegro API key. The buttons use release `v1.8.3`.

## Understand the integration

Start with [`DemoBackend.swift`](./InttegroSwiftUIDemo/DemoBackend.swift) for the
merchant-backend trust boundary, then read
[`CheckoutView.swift`](./InttegroSwiftUIDemo/CheckoutView.swift) for payment
sheet configuration, presentation, telemetry, and result semantics. The
`INTTEGRO:*` comments map choices and alternatives to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
