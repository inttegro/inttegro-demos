import {
  addPaymentSheetTelemetryListener,
  initializePaymentSheet,
  presentPaymentSheet,
  type PaymentSheetResult,
} from "@inttegro/react-native";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createCheckoutOrder } from "./src/demoBackend";

/**
 * Inttegro payment-sheet integration map
 *
 * INTTEGRO:FLOW [native-payment-sheet] Ask the merchant backend for a finalized
 * Order, initialize the Inttegro SDK with its ID and this app's return URL, then
 * present the payment sheet.
 * INTTEGRO:SECURITY [server-api-key] The React Native app receives an order ID,
 * never a merchant API key. See https://studio.inttegro.com/keys.
 * INTTEGRO:ALTERNATIVE [native-payment-sheet] A product that deliberately uses
 * browser checkout can open the returned hosted URL in a secure browser surface
 * while preserving the same server-side verification boundary.
 * INTTEGRO:DOCS https://studio.inttegro.com/sdks
 * INTTEGRO:DOCS https://studio.inttegro.com/payment-methods
 * See ../INTEGRATION_GUIDE.md and ../integration-decisions.json for the complete
 * rationale and machine-readable alternatives.
 */

const finishes = [
  { name: "Sunrise clay", color: "#b84831" },
  { name: "Night earth", color: "#302a28" },
  { name: "River sand", color: "#c2a77d" },
];

export default function App() {
  const [busy, setBusy] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [finish, setFinish] = useState(finishes[0]!.name);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    // INTTEGRO:OBSERVABILITY [application-owned-observability] The SDK emits
    // privacy-safe diagnostic fields to the app. Forward them to an application-
    // owned telemetry pipeline if useful, but never add customer data, secrets,
    // or raw provider payloads. These events are not authoritative payment state.
    // https://studio.inttegro.com/sdk-observability
    const subscription = addPaymentSheetTelemetryListener((event) => {
      console.info("Inttegro payment sheet", {
        flowId: event.flowId,
        name: event.name,
        sequence: event.sequence,
        operation: event.operation,
        httpStatusCode: event.httpStatusCode,
        requestId: event.requestId,
        errorType: event.errorType,
      });
    });
    return () => subscription.remove();
  }, []);

  async function checkout() {
    if (busy) return;
    setBusy(true);
    try {
      // INTTEGRO:DECISION [stable-idempotency-key] This ID represents one
      // logical checkout. Network retries for that attempt must reuse it;
      // production apps persist it with the authenticated cart.
      // https://studio.inttegro.com/idempotency
      const order = await createCheckoutOrder(newAttemptId());
      // INTTEGRO:DECISION [native-payment-sheet] The backend returns a finalized,
      // checkout-ready Order. Register the return URL in both native hosts. It
      // resumes UX after an external step, but does not prove payment.
      await initializePaymentSheet({
        orderId: order.orderId,
        returnURL: "inttegro-demo://payment-return",
      });
      // Inttegro owns payment-method presentation and provider transitions;
      // Kora owns the surrounding product, loading, cancellation, and result UI.
      setStatus(describe(await presentPaymentSheet()));
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Payment is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Text style={styles.brandLetter}>K</Text>
          </View>
          <Text style={styles.brand}>Kora Market</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shopping bag, one item"
          accessibilityHint="Creates a finalized order and opens Inttegro"
          disabled={busy}
          onPress={checkout}
          hitSlop={12}
          style={({ pressed }) => [
            styles.iconButton,
            (pressed || busy) && styles.pressed,
          ]}
        >
          <Text style={styles.iconText}>▢</Text>
          <View style={styles.bagBadge}>
            <Text style={styles.bagBadgeText}>1</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.editorialIntro}>
          <View style={styles.overline}>
            <Text style={styles.overlineText}>VOLTA STUDIO</Text>
            <Text style={styles.overlineText}>OBJECT 01—03</Text>
          </View>
          <Text style={styles.editorialTitle}>A slower,{"\n"}<Text style={styles.editorialTitleAccent}>warmer morning.</Text></Text>
        </View>

        <View style={styles.hero}>
          <Image
            source={require("./assets/kora-dawn-brew.jpg")}
            resizeMode="cover"
            style={styles.heroImage}
            accessibilityLabel="Terracotta Dawn Brew Set with a pour-over and cup"
          />
          <View style={styles.smallBatch}>
            <Text style={styles.smallBatchText}>Small batch</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? "Remove from favorites" : "Add to favorites"
            }
            onPress={() => setFavorite(!favorite)}
            style={({ pressed }) => [
              styles.favorite,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.favoriteText, favorite && styles.favoriteActive]}
            >
              {favorite ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.details}>
          <Text style={styles.objectLabel}>HAND-THROWN STONEWARE · HO, GHANA</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Dawn Brew Set</Text>
            <Text style={styles.amount}>GHS 50</Text>
          </View>
          <View style={styles.ratingRow}>
            <Text style={styles.rating}>★ 4.9</Text>
            <Text style={styles.muted}>240 reviews</Text>
            <View style={styles.flex} />
            <Text style={styles.ready}>● Ready to ship</Text>
          </View>
          <Text style={styles.description}>
            A sculptural pour-over and cup, shaped by hand in Ho for slower
            mornings and more considered rituals.
          </Text>

          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Finish</Text>
            <Text style={styles.muted}>{finish}</Text>
          </View>
          <View style={styles.swatchRow}>
            {finishes.map((item) => (
              <Pressable
                key={item.name}
                accessibilityRole="button"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: finish === item.name }}
                onPress={() => setFinish(item.name)}
                style={[
                  styles.swatchOuter,
                  finish === item.name && styles.swatchSelected,
                ]}
              >
                <View
                  style={[styles.swatch, { backgroundColor: item.color }]}
                />
              </Pressable>
            ))}
          </View>

          <View style={styles.makerCard}>
            <Text style={styles.makerTitle}>Made by Ama Ofori</Text>
            <Text style={styles.makerCopy}>
              Every piece keeps the subtle marks of its making. Local clay is
              fired to a food-safe finish and packed without plastic.
            </Text>
            <View style={styles.divider} />
            <Text style={styles.delivery}>
              ▰ Delivery across Ghana in 2–4 days
            </Text>
          </View>

          {status ? (
            <View
              style={styles.status}
              accessible
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.statusTitle}>Latest update</Text>
              <Text style={styles.statusCopy}>{status}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.total}>GHS 50.00</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityHint="Creates a finalized order and opens Inttegro"
          disabled={busy}
          onPress={checkout}
          style={({ pressed }) => [
            styles.payButton,
            (pressed || busy) && styles.payPressed,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.payText}>Pay with Inttegro</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function newAttemptId(): string {
  return `rn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function describe(result: PaymentSheetResult): string {
  // INTTEGRO:VERIFY [server-side-verification] This immediate result controls UI
  // only. Before fulfillment, the merchant backend must look up the owner-scoped
  // Order. Use bounded polling plus reconciliation while merchant-facing
  // webhooks are unavailable: https://studio.inttegro.com/webhooks.
  if (result.status === "completed")
    return "Payment submitted. We’ll verify it before fulfillment.";
  if (result.status === "canceled")
    return "Checkout paused. Your Dawn Brew Set is still in the bag.";
  return `Payment unavailable (${result.error.code}).`;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 68,
    justifyContent: "space-between",
    borderBottomColor: "rgba(27,32,28,.13)",
    borderBottomWidth: 1,
    paddingHorizontal: 18,
  },
  iconButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  iconText: { color: "#183c32", fontSize: 20, fontWeight: "500" },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  brandMark: {
    alignItems: "center",
    backgroundColor: "#183c32",
    borderRadius: 9,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  brandLetter: { color: "#fffaf1", fontSize: 13, fontWeight: "500" },
  brand: {
    color: "#183c32",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  bagBadge: {
    alignItems: "center",
    backgroundColor: "#b84831",
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    top: 3,
    width: 16,
  },
  bagBadgeText: { color: "#fff", fontSize: 9, fontWeight: "500" },
  content: { paddingBottom: 118 },
  editorialIntro: { paddingHorizontal: 20, paddingBottom: 34, paddingTop: 36 },
  overline: { borderTopColor: "rgba(27,32,28,.18)", borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 10 },
  overlineText: { color: "#686a63", fontSize: 9, fontWeight: "500", letterSpacing: 1.4 },
  editorialTitle: { color: "#1b201c", fontSize: 54, fontWeight: "500", letterSpacing: -2.8, lineHeight: 50, marginTop: 54 },
  editorialTitleAccent: { color: "#a84d32", fontStyle: "italic" },
  hero: {
    aspectRatio: 0.82,
    backgroundColor: "#d98c68",
    overflow: "hidden",
    position: "relative",
  },
  heroImage: { height: "100%", width: "100%" },
  smallBatch: {
    backgroundColor: "rgba(255,250,241,.88)",
    borderRadius: 18,
    left: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: "absolute",
    top: 16,
  },
  smallBatchText: { color: "#183c32", fontSize: 12, fontWeight: "500" },
  favorite: {
    alignItems: "center",
    backgroundColor: "rgba(255,250,241,.9)",
    borderRadius: 24,
    height: 46,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    top: 14,
    width: 46,
  },
  favoriteText: { color: "#183c32", fontSize: 27 },
  favoriteActive: { color: "#b84831" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
  details: { gap: 0, padding: 20, paddingTop: 28 },
  objectLabel: { color: "#a84d32", fontSize: 9, fontWeight: "500", letterSpacing: 1.3, marginBottom: 14 },
  titleRow: { alignItems: "flex-start", flexDirection: "row", gap: 14 },
  title: {
    color: "#183c32",
    flex: 1,
    fontSize: 34,
    fontWeight: "500",
    letterSpacing: -1.4,
    lineHeight: 37,
  },
  amount: {
    color: "#183c32",
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: -0.7,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  rating: { color: "#a65d16", fontSize: 13, fontWeight: "500" },
  muted: { color: "#69736d", fontSize: 13 },
  flex: { flex: 1 },
  ready: { color: "#26855b", fontSize: 12, fontWeight: "500" },
  description: {
    color: "#59665f",
    fontSize: 17,
    lineHeight: 26,
    marginTop: 24,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
  },
  sectionTitle: { color: "#183c32", fontSize: 16, fontWeight: "500" },
  swatchRow: { flexDirection: "row", gap: 11, marginTop: 12 },
  swatchOuter: {
    alignItems: "center",
    borderColor: "transparent",
    borderRadius: 23,
    borderWidth: 2,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  swatchSelected: { borderColor: "#183c32" },
  swatch: {
    borderColor: "#fffaf1",
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    width: 36,
  },
  makerCard: {
    backgroundColor: "#394b3e",
    borderRadius: 22,
    marginTop: 30,
    padding: 20,
  },
  makerTitle: { color: "#fffaf1", fontSize: 22, fontWeight: "500" },
  makerCopy: { color: "#d5d8d2", fontSize: 15, lineHeight: 23, marginTop: 10 },
  divider: {
    backgroundColor: "rgba(255,255,255,.15)",
    height: 1,
    marginVertical: 16,
  },
  delivery: { color: "#fffaf1", fontSize: 13, fontWeight: "500" },
  status: {
    backgroundColor: "#dcece6",
    borderRadius: 18,
    marginTop: 18,
    padding: 16,
  },
  statusTitle: {
    color: "#183c32",
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  statusCopy: { color: "#36584d", fontSize: 14, lineHeight: 20, marginTop: 5 },
  checkoutBar: {
    alignItems: "center",
    backgroundColor: "rgba(255,251,243,.97)",
    borderTopColor: "rgba(24,60,50,.1)",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    gap: 18,
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    position: "absolute",
    right: 0,
  },
  totalLabel: { color: "#69736d", fontSize: 11 },
  total: { color: "#183c32", fontSize: 17, fontWeight: "500" },
  payButton: {
    alignItems: "center",
    backgroundColor: "#183c32",
    borderRadius: 999,
    flex: 1,
    justifyContent: "center",
    minHeight: 54,
  },
  payPressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  payText: { color: "#fff", fontSize: 16, fontWeight: "500" },
});
