import 'dart:async';

import 'package:flutter/material.dart';
import 'package:inttegro_flutter/inttegro_flutter.dart';

import 'demo_backend.dart';

/*
 * Inttegro payment-sheet integration map
 *
 * INTTEGRO:FLOW [native-payment-sheet] Ask the merchant backend for a finalized
 * Order, initialize the Inttegro SDK with its ID and the app return URL, then
 * present the native payment sheet.
 * INTTEGRO:SECURITY [server-api-key] The Flutter app receives an order ID, never
 * a merchant API key. See https://studio.inttegro.com/keys.
 * INTTEGRO:ALTERNATIVE [native-payment-sheet] A product that intentionally
 * prefers browser checkout can open the returned hosted URL in a secure browser
 * surface while retaining the same server-side verification boundary.
 * INTTEGRO:DOCS https://studio.inttegro.com/sdks
 * INTTEGRO:DOCS https://studio.inttegro.com/payment-methods
 * See ../../INTEGRATION_GUIDE.md and ../../integration-decisions.json for the complete
 * rationale and machine-readable alternatives.
 */

void main() => runApp(const KoraMarketApp());

class KoraMarketApp extends StatelessWidget {
  const KoraMarketApp({super.key});

  @override
  Widget build(BuildContext context) {
    const forest = Color(0xff183c32);
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Kora Market',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: forest,
          primary: forest,
          secondary: const Color(0xffb84831),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: Colors.white,
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: forest,
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const KoraProductScreen(),
    );
  }
}

class KoraProductScreen extends StatefulWidget {
  const KoraProductScreen({super.key});

  @override
  State<KoraProductScreen> createState() => _KoraProductScreenState();
}

class _KoraProductScreenState extends State<KoraProductScreen> {
  static const _backendUrl = String.fromEnvironment('INTTEGRO_DEMO_BACKEND_URL');
  static const _finishes = <(String, Color)>[
    ('Sunrise clay', Color(0xffb84831)),
    ('Night earth', Color(0xff302a28)),
    ('River sand', Color(0xffc2a77d)),
  ];

  bool _busy = false;
  bool _favorite = false;
  String _category = 'New in';
  String _finish = _finishes.first.$1;
  String? _status;
  late final StreamSubscription<PaymentSheetTelemetryEvent> _telemetrySubscription;

  @override
  void initState() {
    super.initState();
    // INTTEGRO:OBSERVABILITY [application-owned-observability] The SDK exposes
    // privacy-safe diagnostic fields to the app. Forward them to your own
    // telemetry pipeline if useful, but do not attach customer data, secrets,
    // or raw provider payloads. These events are diagnostics, not payment state.
    // https://studio.inttegro.com/sdk-observability
    _telemetrySubscription = Inttegro.instance.paymentSheetTelemetryEvents.listen(
      (event) => debugPrint(
        'Inttegro payment sheet: flow=${event.flowId} '
        'event=${event.name.wireValue} sequence=${event.sequence} '
        'operation=${event.operation?.wireValue ?? 'none'} '
        'status=${event.httpStatusCode ?? 0} '
        'request=${event.requestId ?? 'none'} '
        'error=${event.errorType ?? 'none'}',
      ),
      onError: (Object _) => debugPrint('Inttegro telemetry unavailable.'),
    );
  }

  @override
  void dispose() {
    unawaited(_telemetrySubscription.cancel());
    super.dispose();
  }

  Future<void> _checkout() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      if (_backendUrl.isEmpty) throw StateError('Set INTTEGRO_DEMO_BACKEND_URL.');
      // INTTEGRO:DECISION [stable-idempotency-key] This value represents one
      // logical checkout. A retry of that attempt must reuse it. Production apps
      // persist the attempt alongside the authenticated cart.
      // https://studio.inttegro.com/idempotency
      final order = await DemoBackend(_backendUrl).createCheckoutOrder(
        'flutter_${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}',
      );
      // INTTEGRO:DECISION [native-payment-sheet] The backend creates a finalized,
      // checkout-ready Order. The return URL must be registered by the native
      // hosts; it resumes UX after an external step but does not prove payment.
      await Inttegro.instance.initializePaymentSheet(
        PaymentSheetConfiguration(
          orderId: order.orderId,
          returnUrl: Uri.parse('inttegro-demo://payment-return'),
        ),
      );
      // Inttegro owns payment-method presentation and provider transitions;
      // Kora owns the surrounding product, loading, cancellation, and result UI.
      final result = await Inttegro.instance.presentPaymentSheet();
      // INTTEGRO:VERIFY [server-side-verification] The result below drives
      // immediate UX only. Before fulfillment, the backend must look up the
      // owner-scoped Order. Use bounded polling plus reconciliation while
      // merchant-facing webhooks are unavailable:
      // https://studio.inttegro.com/webhooks
      _status = switch (result) {
        PaymentSheetCompleted() => 'Payment submitted. We’ll verify it before fulfillment.',
        PaymentSheetCanceled() => 'Checkout paused. Your Dawn Brew Set is still in the bag.',
        PaymentSheetFailed(:final code) => 'Payment unavailable ($code).',
      };
    } on Object catch (error) {
      _status = error is StateError ? error.message.toString() : 'Payment is temporarily unavailable.';
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      drawer: NavigationDrawer(
        selectedIndex: ['New in', 'Table', 'Textiles', 'Objects'].indexOf(_category),
        onDestinationSelected: (index) {
          setState(() => _category = ['New in', 'Table', 'Textiles', 'Objects'][index]);
          Navigator.pop(context);
        },
        children: const [
          SafeArea(bottom: false, child: Padding(padding: EdgeInsets.fromLTRB(28, 24, 28, 18), child: Text('Kora Market', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w500)))),
          NavigationDrawerDestination(icon: Icon(Icons.auto_awesome), label: Text('New in')),
          NavigationDrawerDestination(icon: Icon(Icons.coffee_rounded), label: Text('Table')),
          NavigationDrawerDestination(icon: Icon(Icons.grid_view_rounded), label: Text('Textiles')),
          NavigationDrawerDestination(icon: Icon(Icons.inventory_2_outlined), label: Text('Objects')),
        ],
      ),
      bottomNavigationBar: Material(
        elevation: 16,
        color: colors.surface.withOpacity(.96),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
            child: Row(
              children: [
                const Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [Text('Total', style: TextStyle(fontSize: 12)), Text('GHS 50.00', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w500))],
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _checkout,
                    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54)),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: _busy
                          ? const SizedBox.square(key: ValueKey('busy'), dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Pay with Inttegro', key: ValueKey('ready'), style: TextStyle(fontWeight: FontWeight.w500)),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 560,
            backgroundColor: colors.surface,
            surfaceTintColor: colors.surface,
            title: const Text('KORA MARKET', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, letterSpacing: 1)),
            leading: Builder(
              builder: (context) => IconButton(icon: const Icon(Icons.menu_rounded), tooltip: 'Open menu', onPressed: Scaffold.of(context).openDrawer),
            ),
            actions: [
              IconButton(icon: const Badge(label: Text('1'), child: Icon(Icons.shopping_bag_rounded)), tooltip: 'Shopping bag', onPressed: _busy ? null : _checkout),
              const SizedBox(width: 8),
            ],
            flexibleSpace: FlexibleSpaceBar(
              collapseMode: CollapseMode.parallax,
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.asset('assets/kora-dawn-brew.jpg', fit: BoxFit.cover, semanticLabel: 'Terracotta Dawn Brew Set with a pour-over and cup'),
                  Positioned(
                    left: 18,
                    bottom: 22,
                    child: Chip(
                      avatar: const Icon(Icons.handshake_outlined, size: 17),
                      label: const Text('Small batch'),
                      backgroundColor: colors.surface.withOpacity(.92),
                      side: BorderSide.none,
                      shape: const StadiumBorder(),
                    ),
                  ),
                  Positioned(
                    right: 14,
                    bottom: 14,
                    child: IconButton.filledTonal(
                      tooltip: _favorite ? 'Remove from favorites' : 'Add to favorites',
                      onPressed: () => setState(() => _favorite = !_favorite),
                      icon: Icon(_favorite ? Icons.favorite_rounded : Icons.favorite_border_rounded, color: _favorite ? colors.secondary : null),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 34, 20, 36),
            sliver: SliverList.list(children: [
              const Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('VOLTA STUDIO', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w500, letterSpacing: 1.4, color: Color(0xff686a63))), Text('OBJECT 01—03', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w500, letterSpacing: 1.4, color: Color(0xff686a63)))]),
              const SizedBox(height: 42),
              const Text('A slower,\nwarmer morning.', style: TextStyle(fontSize: 54, height: .92, fontWeight: FontWeight.w500, letterSpacing: -2.6, color: Color(0xff1b201c))),
              const SizedBox(height: 48),
              const Text('HAND-THROWN STONEWARE · HO, GHANA', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w500, letterSpacing: 1.2, color: Color(0xffa84d32))),
              const SizedBox(height: 14),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Expanded(child: Text('Dawn Brew Set', style: TextStyle(fontSize: 34, height: 1, fontWeight: FontWeight.w500, letterSpacing: -1.2))),
                const SizedBox(width: 16),
                Text('GHS 50', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w500)),
              ]),
              const SizedBox(height: 12),
              Row(children: [const Text('★ 4.9', style: TextStyle(color: Color(0xffa65d16), fontWeight: FontWeight.w500)), const SizedBox(width: 9), Text('240 reviews', style: TextStyle(color: colors.onSurfaceVariant)), const Spacer(), const Icon(Icons.check_circle, size: 18, color: Color(0xff26855b)), const SizedBox(width: 5), const Text('Ready to ship', style: TextStyle(color: Color(0xff26855b), fontWeight: FontWeight.w500))]),
              const SizedBox(height: 24),
              Text('A sculptural pour-over and cup, shaped by hand in Ho for slower mornings and more considered rituals.', style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.55, color: colors.onSurfaceVariant)),
              const SizedBox(height: 28),
              Row(children: [const Text('Finish', style: TextStyle(fontWeight: FontWeight.w500)), const Spacer(), Text(_finish, style: TextStyle(color: colors.onSurfaceVariant))]),
              const SizedBox(height: 12),
              Row(children: _finishes.map((finish) => Semantics(
                label: finish.$1,
                selected: _finish == finish.$1,
                button: true,
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: () => setState(() => _finish = finish.$1),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    width: 44,
                    height: 44,
                    margin: const EdgeInsets.only(right: 12),
                    decoration: BoxDecoration(color: finish.$2, shape: BoxShape.circle, border: Border.all(color: _finish == finish.$1 ? colors.onSurface : Colors.transparent, width: 3)),
                  ),
                ),
              )).toList()),
              const SizedBox(height: 30),
              Card(
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
                color: const Color(0xff394b3e),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Made by Ama Ofori', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 10),
                    const Text('Every piece keeps the subtle marks of its making. Local clay is fired to a food-safe finish and packed without plastic.', style: TextStyle(height: 1.45, color: Color(0xffd5d8d2))),
                    const Divider(height: 30, color: Color(0x33ffffff)),
                    const Row(children: [Icon(Icons.local_shipping_outlined, color: Colors.white), SizedBox(width: 10), Expanded(child: Text('Delivery across Ghana in 2–4 days', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w500)))]),
                  ]),
                ),
              ),
              if (_status != null) ...[
                const SizedBox(height: 18),
                Semantics(
                  liveRegion: true,
                  child: Card(color: colors.secondaryContainer, elevation: 0, child: Padding(padding: const EdgeInsets.all(16), child: Text(_status!))),
                ),
              ],
            ]),
          ),
        ],
      ),
    );
  }
}
