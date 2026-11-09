package com.inttegro.demo.compose

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.inttegro.payments.InttegroPaymentSheet
import com.inttegro.payments.PaymentSheetConfiguration
import com.inttegro.payments.PaymentSheetResult
import com.inttegro.payments.PaymentSheetTelemetry
import com.inttegro.payments.PaymentSheetTelemetryListener
import java.util.UUID
import kotlinx.coroutines.launch

/*
 * Inttegro payment-sheet integration map
 *
 * INTTEGRO:FLOW [native-payment-sheet] Ask the merchant backend for a finalized
 * Order, configure the Inttegro SDK with its ID and the app return URL, and
 * render InttegroPaymentSheet in the Compose hierarchy.
 * INTTEGRO:SECURITY [server-api-key] The app receives an order ID, never a
 * merchant API key. See https://studio.inttegro.com/keys.
 * INTTEGRO:ALTERNATIVE [native-payment-sheet] A product that deliberately uses
 * browser checkout can open the returned hosted URL in a secure browser surface
 * and keep the same server-side verification requirement.
 * INTTEGRO:DOCS https://studio.inttegro.com/sdks
 * INTTEGRO:DOCS https://studio.inttegro.com/payment-methods
 * See the repository INTEGRATION_GUIDE.md and integration-decisions.json for
 * complete rationale and machine-readable alternatives.
 */

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { KoraTheme { KoraMarketScreen() } }
    }
}

private data class Finish(val name: String, val color: Color)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun KoraMarketScreen() {
    val finishes = remember {
        listOf(
            Finish("Sunrise clay", Color(0xFFB84831)),
            Finish("Night earth", Color(0xFF302A28)),
            Finish("River sand", Color(0xFFC2A77D)),
        )
    }
    var favorite by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    var selectedCategory by remember { mutableStateOf("New in") }
    var selectedFinish by remember { mutableStateOf(finishes.first()) }
    var checkoutOrderId by rememberSaveable {
        mutableStateOf(
            if (BuildConfig.INTTEGRO_SCREENSHOT_MODE) "or_android_documentation" else null,
        )
    }
    var checkoutFlowId by rememberSaveable {
        mutableStateOf(
            if (BuildConfig.INTTEGRO_SCREENSHOT_MODE) "android-documentation" else null,
        )
    }
    var isCreatingOrder by remember { mutableStateOf(false) }
    var outcome by rememberSaveable { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val beginCheckout: () -> Unit = {
        if (!isCreatingOrder) {
            if (BuildConfig.INTTEGRO_SCREENSHOT_MODE) {
                checkoutOrderId = "or_android_documentation"
                checkoutFlowId = "android-documentation"
                outcome = null
            } else {
                isCreatingOrder = true
                outcome = null
                scope.launch {
                    try {
                        // INTTEGRO:DECISION [stable-idempotency-key] This UUID names
                        // one logical attempt. Network retries for that attempt must
                        // reuse it; production apps persist it with the cart.
                        // https://studio.inttegro.com/idempotency
                        val attemptId = UUID.randomUUID().toString()
                        // INTTEGRO:FLOW [mobile-backend-boundary] The trusted backend
                        // authenticates the customer and owns order construction.
                        checkoutOrderId = DemoBackend(BuildConfig.INTTEGRO_DEMO_BACKEND_URL)
                            .createCheckoutOrder(attemptId)
                        checkoutFlowId = attemptId
                    } catch (error: Exception) {
                        outcome = error.message ?: "Payment is temporarily unavailable."
                    } finally {
                        isCreatingOrder = false
                    }
                }
            }
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
        topBar = {
            TopAppBar(
                title = { Text("Kora Market", fontWeight = FontWeight.Medium) },
                navigationIcon = {
                    Box {
                        IconButton(onClick = { showMenu = true }) { Icon(Icons.Default.Menu, "Open menu") }
                        DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                            listOf("New in", "Table", "Textiles", "Objects").forEach { category ->
                                DropdownMenuItem(
                                    text = { Text(category) },
                                    onClick = {
                                        selectedCategory = category
                                        showMenu = false
                                    },
                                )
                            }
                        }
                    }
                },
                actions = {
                    IconButton(onClick = beginCheckout, enabled = !isCreatingOrder) {
                        Icon(Icons.Default.ShoppingBag, "Shopping bag, one item")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLowest),
            )
        },
        bottomBar = {
            Surface(shadowElevation = 14.dp, tonalElevation = 3.dp) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 13.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                ) {
                    Column {
                        Text("Total", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("GHS 50.00", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
                    }
                    Button(
                        onClick = beginCheckout,
                        enabled = !isCreatingOrder,
                        modifier = Modifier.weight(1f).height(52.dp),
                    ) {
                        if (isCreatingOrder) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                            )
                            Spacer(Modifier.size(10.dp))
                        }
                        Text(
                            if (isCreatingOrder) "Preparing checkout" else "Pay GHS 50.00",
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            verticalArrangement = Arrangement.spacedBy(0.dp),
        ) {
            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 34.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text("VOLTA STUDIO", style = MaterialTheme.typography.labelSmall, letterSpacing = 1.4.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("OBJECT 01—03", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Spacer(Modifier.height(46.dp))
                    Text(
                        "A slower,\nwarmer morning.",
                        style = MaterialTheme.typography.displayMedium.copy(
                            fontWeight = FontWeight.Medium,
                            lineHeight = 52.sp,
                        ),
                        color = Color(0xFF1B201C),
                    )
                }
            }
            item {
                Box(modifier = Modifier.fillMaxWidth().aspectRatio(.8f)) {
                    Image(
                        painter = painterResource(R.drawable.kora_dawn_brew),
                        contentDescription = "Terracotta Dawn Brew Set with a pour-over and cup",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                    )
                    Surface(
                        modifier = Modifier.align(Alignment.TopStart).padding(18.dp),
                        shape = RoundedCornerShape(999.dp),
                        color = MaterialTheme.colorScheme.surface.copy(alpha = .86f),
                        tonalElevation = 4.dp,
                    ) { Text("Small batch", modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp), style = MaterialTheme.typography.labelMedium) }
                    IconButton(
                        onClick = { favorite = !favorite },
                        modifier = Modifier.align(Alignment.TopEnd).padding(14.dp).background(MaterialTheme.colorScheme.surface.copy(alpha = .86f), CircleShape),
                    ) { Icon(if (favorite) Icons.Default.Favorite else Icons.Default.FavoriteBorder, if (favorite) "Remove from favorites" else "Add to favorites", tint = if (favorite) Color(0xFFB84831) else MaterialTheme.colorScheme.onSurface) }
                }
            }
            item {
                Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("HAND-THROWN STONEWARE · HO, GHANA", color = Color(0xFFA84D32), style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Dawn Brew Set", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text("GHS 50", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Medium)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("★ 4.9", color = Color(0xFFA65D16), fontWeight = FontWeight.Medium)
                            Text("240 reviews", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.weight(1f))
                            Icon(Icons.Default.CheckCircle, null, tint = Color(0xFF26855B), modifier = Modifier.size(17.dp))
                            Text("Ready to ship", color = Color(0xFF26855B), style = MaterialTheme.typography.labelMedium)
                        }
                    }
                    Text("A sculptural pour-over and cup, shaped by hand in Ho for slower mornings and more considered rituals.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge)
                    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row { Text("Finish", fontWeight = FontWeight.Medium); Spacer(Modifier.weight(1f)); Text(selectedFinish.name, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            finishes.forEach { finish ->
                                val border by animateColorAsState(if (finish == selectedFinish) MaterialTheme.colorScheme.onSurface else Color.Transparent)
                                Box(
                                    modifier = Modifier.size(44.dp).clip(CircleShape).clickable { selectedFinish = finish }
                                        .semantics { contentDescription = finish.name; selected = finish == selectedFinish }
                                        .background(finish.color).padding(3.dp),
                                ) { Surface(modifier = Modifier.fillMaxSize(), shape = CircleShape, color = Color.Transparent, border = BorderStroke(2.dp, border)) {} }
                            }
                        }
                    }
                    Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color(0xFF394B3E))) {
                        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Made by Ama Ofori", style = MaterialTheme.typography.titleLarge, color = Color.White, fontWeight = FontWeight.Medium)
                            Text("Every piece keeps the subtle marks of its making. Local clay is fired to a food-safe finish and packed without plastic.", color = Color.White.copy(alpha = .7f))
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) { Icon(Icons.Outlined.LocalShipping, null, tint = Color.White); Text("Delivery across Ghana in 2–4 days", color = Color.White, fontWeight = FontWeight.Medium) }
                        }
                    }
                    outcome?.let {
                        Surface(shape = RoundedCornerShape(16.dp), color = MaterialTheme.colorScheme.secondaryContainer) {
                            Text(it, modifier = Modifier.padding(16.dp), color = MaterialTheme.colorScheme.onSecondaryContainer)
                        }
                    }
                }
            }
        }
    }

    val activeOrderId = checkoutOrderId
    val activeFlowId = checkoutFlowId
    if (activeOrderId != null && activeFlowId != null) {
        val telemetry = remember(activeOrderId, activeFlowId) {
            // INTTEGRO:OBSERVABILITY [application-owned-observability] The SDK
            // emits privacy-safe lifecycle fields to the app's listener. Forward
            // them to your own pipeline if useful, but never enrich them with
            // customer data, credentials, or raw provider payloads.
            // https://studio.inttegro.com/sdk-observability
            PaymentSheetTelemetry(
                listener = PaymentSheetTelemetryListener { event ->
                    Log.i(
                        "InttegroPaymentSheet",
                        "flow=${event.flowId} event=${event.name.wireValue} " +
                            "sequence=${event.sequence} operation=${event.operation ?: "none"} " +
                            "status=${event.httpStatusCode ?: 0} " +
                            "request=${event.requestId ?: "none"} " +
                            "error=${event.errorType ?: "none"}",
                    )
                },
                flowId = activeFlowId,
            )
        }
        // INTTEGRO:DECISION [native-payment-sheet] Inttegro owns payment-method
        // presentation and provider transitions; Kora owns the surrounding
        // product, loading, cancellation, and result experience.
        InttegroPaymentSheet(
            configuration = PaymentSheetConfiguration(
                // The backend returned a finalized checkout-ready Order. The
                // registered return URL resumes this app after an external step;
                // it is not evidence that payment succeeded.
                orderId = activeOrderId,
                returnUrl = "inttegro-demo://payment-return",
                features = PaymentSheetConfiguration.Features(
                    showLineItems = BuildConfig.INTTEGRO_SCREENSHOT_FEATURES,
                    showInvoiceDownload = BuildConfig.INTTEGRO_SCREENSHOT_FEATURES,
                    showReceiptDownload = BuildConfig.INTTEGRO_SCREENSHOT_FEATURES,
                    allowPaymentMethodChange = !BuildConfig.INTTEGRO_SCREENSHOT_FEATURES,
                ),
            ),
            telemetry = telemetry,
            adapter = if (BuildConfig.INTTEGRO_SCREENSHOT_MODE) {
                DemoPaymentSheetAdapter
            } else {
                null
            },
            onDismissRequest = {
                checkoutOrderId = null
                checkoutFlowId = null
            },
            onResult = { result ->
                // INTTEGRO:VERIFY [server-side-verification] This result drives
                // immediate UX only. Before fulfillment, the merchant backend
                // looks up the owner-scoped Order. Use bounded polling and a
                // reconciliation job while merchant webhooks are unavailable:
                // https://studio.inttegro.com/webhooks
                checkoutOrderId = null
                checkoutFlowId = null
                outcome = when (result) {
                    is PaymentSheetResult.Completed -> "Payment submitted. We’ll verify it before fulfillment."
                    is PaymentSheetResult.Canceled -> "Checkout paused. Your Dawn Brew Set is still in the bag."
                    is PaymentSheetResult.Failed ->
                        "Payment unavailable (${result.event.failure?.code ?: "payment_sheet_failed"})."
                }
            },
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun KoraPreview() { KoraTheme { KoraMarketScreen() } }

private val KoraLightColors = lightColorScheme(
    primary = Color(0xFF183C32), onPrimary = Color.White, secondary = Color(0xFFB84831),
    background = Color.White, surface = Color.White, surfaceContainer = Color(0xFFF7F4EE), surfaceContainerLowest = Color.White,
)
private val KoraDarkColors = darkColorScheme(primary = Color(0xFFA8D8C8), secondary = Color(0xFFFFB5A0))

@Composable
private fun KoraTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) KoraDarkColors else KoraLightColors, content = content)
}
