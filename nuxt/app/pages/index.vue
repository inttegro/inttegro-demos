<script setup lang="ts">
const route = useRoute();
const attemptId = useState('attempt-id', () => crypto.randomUUID());
const errorCode = computed(() => typeof route.query.code === 'string' ? route.query.code : '');
const errorMessage = computed(() => typeof route.query.message === 'string' ? route.query.message : '');
const needsConfiguration = computed(() => errorCode.value === 'configuration_error');
useSeoMeta({ title: 'Kora Market — Inttegro + Nuxt', description: 'A production-shaped storefront powered by Nuxt and Inttegro.' });
</script>

<template>
  <div class="story-kora story-kora--editorial">
    <header class="site-header kora-header">
      <a class="brand kora-wordmark" href="#top" aria-label="Kora Market home"><span class="brand-mark kora-monogram">K</span><span>Kora <em>Market</em></span></a>
      <nav class="header-nav kora-nav" aria-label="Store navigation"><a href="#collection" aria-current="page">Collection</a><a href="#story">Our story</a><button class="header-action kora-bag" type="button" data-cart-open>Bag <span aria-hidden="true">(1)</span></button></nav>
    </header>
    <main id="top" class="kora-main">
      <section class="kora-hero kora-editorial-hero" aria-labelledby="product-title">
        <div class="kora-copy kora-hero-copy">
          <p class="kora-overline"><span>Volta studio</span><span>Object 01—03</span></p><h1 id="product-title"><span class="kora-display-line">A slower,</span><span class="kora-display-line">warmer morning.</span></h1>
          <p class="lede kora-hero-dek">The Dawn Brew Set is shaped and fired in small batches, pairing a sculptural pour-over with a cup designed to make the first ritual of the day feel considered.</p>
          <div class="kora-actions kora-hero-actions"><button class="primary-action" type="button" data-cart-open>Add to bag · GHS 50</button><a class="secondary-action" href="#story">Meet the maker</a></div>
          <div class="kora-proof" aria-label="Product reputation and origin"><div><strong class="kora-proof-score">4.9</strong><span class="kora-proof-label">average rating</span></div><span class="kora-proof-rule" /><div><strong class="kora-proof-score">240</strong><span class="kora-proof-label">thoughtful homes</span></div><span class="kora-proof-rule" /><div><strong class="kora-proof-score">Ho</strong><span class="kora-proof-label">made in Ghana</span></div></div>
        </div>
        <figure id="collection" class="product-stage kora-product-stage"><div class="product-image-wrap kora-product-media"><img src="/kora-dawn-brew.jpg" alt="Terracotta pour-over coffee set with a small cup and natural linen"></div><figcaption class="kora-image-caption"><span>Dawn Brew Set</span><span>Ho, Ghana · 2026</span></figcaption><div class="product-badge kora-availability"><span class="status-dot" /> Ready to ship</div><aside class="product-float kora-product-panel" aria-label="Product summary"><div class="row kora-product-heading"><div><span class="rating">★★★★★</span><h2>Dawn Brew Set</h2></div><strong class="price kora-product-price">GHS 50</strong></div><p class="microcopy kora-product-meta">Hand-thrown stoneware · One set · Ships in 2–4 days</p><fieldset class="kora-finish-picker"><legend class="kora-finish-legend">Finish <span data-finish-label>Sunrise clay</span></legend><div class="swatches" aria-label="Choose finish"><button class="swatch kora-swatch" type="button" aria-label="Sunrise clay" aria-pressed="true" data-swatch /><button class="swatch kora-swatch" type="button" aria-label="Night earth" aria-pressed="false" data-swatch /><button class="swatch kora-swatch" type="button" aria-label="River sand" aria-pressed="false" data-swatch /></div></fieldset></aside></figure>
      </section>
      <section id="story" class="story-section kora-editorial-story" aria-labelledby="story-title">
        <div class="story-section-head kora-story-heading"><div><p class="eyebrow">Made with intention</p><h2 id="story-title">From earth to everyday ritual.</h2></div><p class="microcopy">Designed by Ama Ofori<br>Ho, Ghana</p></div>
        <div class="story-grid kora-story-grid"><figure class="story-card story-card--image"><img src="/kora-maker-story.jpg" alt="A ceramicist finishing the terracotta Dawn Brew Set by hand"><figcaption>Each piece is finished by hand in Ama’s light-filled studio.</figcaption></figure><article class="story-card story-card--manifesto"><span class="number">01 / FORM</span><h3>Thrown by hand, never rushed.</h3><p>Every silhouette keeps the small variations that make an object personal. No two sets land in quite the same way.</p></article><article class="story-card story-card--material"><span class="number">02 / MATERIAL</span><h3>Local clay</h3><p>A durable, food-safe finish with a naturally warm touch.</p></article><article class="story-card story-card--delivery"><span class="number">03 / DELIVERY</span><h3>Carefully packed</h3><p>Plastic-free materials and delivery across Ghana in 2–4 days.</p></article></div>
      </section>
    </main>
    <dialog class="cart-dialog kora-cart" data-cart-dialog :data-auto-open="errorCode ? '' : undefined">
      <div class="cart-head kora-cart-head"><p><span>Order edit</span><strong>Your bag</strong></p><button class="icon-button" type="button" aria-label="Close bag" data-cart-close /></div>
      <div class="cart-body kora-cart-body">
        <section v-if="needsConfiguration" class="setup-card has-config-error" role="status">
          <span class="setup-kicker">Setup required</span><h3>Connect this copy to Inttegro</h3>
          <p>Add <code>NUXT_INTTEGRO_API_KEY</code> as a private secret, set the active Product and Price IDs plus this deployment’s public URL, then redeploy. Never place the key in <code>runtimeConfig.public</code>.</p>
          <div class="setup-actions"><a href="https://studio.inttegro.com/keys">Create an API key</a><a href="https://github.com/inttegro/inttegro-demos/blob/nuxt-v1.8.3/nuxt/README.md#deploy-your-own">Deployment guide</a></div>
        </section>
        <p v-else-if="errorCode" class="inline-error" role="alert"><strong>{{ errorCode.replaceAll('_', ' ') }}:</strong> {{ errorMessage || 'Checkout could not be started.' }}</p>
        <div class="cart-line kora-cart-line"><img src="/kora-dawn-brew.jpg" alt=""><div><div class="row"><h3>Dawn Brew Set</h3><strong>GHS 50</strong></div><p class="microcopy"><span data-finish-label>Sunrise clay</span> · Quantity 1</p></div></div><div class="cart-total kora-cart-total"><span>Total</span><strong>GHS 50.00</strong></div>
        <form class="checkout-form kora-checkout-form" action="/checkout" method="post" data-checkout-form><input type="hidden" name="attempt_id" :value="attemptId"><div class="field-grid"><label>Full name<input name="name" value="Akua Mensah" autocomplete="name" required></label><label>Email address<input name="email" type="email" value="akua@example.com" autocomplete="email" required></label></div><label>Phone number<input name="phone" type="tel" value="+233544998605" autocomplete="tel" required></label><button class="checkout-button" type="submit">Continue securely <span>→</span></button><p class="secure-note">Secure checkout powered by Inttegro · API key remains server-side</p></form>
      </div>
    </dialog>
  </div>
</template>
