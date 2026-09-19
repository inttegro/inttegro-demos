import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const demosRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(demosRoot, 'manifest.json'), 'utf8'));
const decisions = JSON.parse(readFileSync(join(demosRoot, 'integration-decisions.json'), 'utf8'));
const releaseManifestPath = join(demosRoot, manifest.currentRelease.manifest);
const release = JSON.parse(readFileSync(releaseManifestPath, 'utf8'));
const deployments = JSON.parse(readFileSync(join(demosRoot, 'deployments.json'), 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.demos.length, 20, 'the roadmap must contain 20 demos');
assert.equal(new Set(manifest.demos.map((demo) => demo.id)).size, 20, 'demo IDs must be unique');

const v1 = manifest.demos.filter((demo) => demo.release === 'v1');
const v2 = manifest.demos.filter((demo) => demo.release === 'v2');
assert.equal(v1.length, 13, 'V1 must contain 13 demos');
assert.equal(v2.length, 7, 'V2 must contain 7 demos');
assert.deepEqual(
  v2.filter((demo) => demo.status === 'verified').map((demo) => demo.id).toSorted(),
  ['astro', 'nestjs', 'redwoodsdk'],
  'Astro, NestJS, and RedwoodSDK must remain the implemented V2 tranche',
);
assert.deepEqual(
  v2.filter((demo) => demo.status === 'planned').map((demo) => demo.id).toSorted(),
  ['angular', 'aspnet-core', 'react-vite', 'sveltekit'],
  'the remaining V2 roadmap must stay explicit',
);
const implemented = manifest.demos.filter((demo) => demo.status !== 'planned');
const published = implemented;
const serverDemoIds = [
  'nextjs', 'express', 'nuxt', 'go', 'django', 'fastapi', 'rails', 'laravel',
  'spring-boot', 'nestjs', 'redwoodsdk', 'astro',
];

assert.equal(release.schemaVersion, 1, 'release manifest schema must be version 1');
assert.match(release.version, /^\d+\.\d+\.\d+$/, 'release version must use SemVer');
assert.equal(manifest.currentRelease.version, release.version, 'current release version must resolve to its manifest');
assert.equal(manifest.currentRelease.suiteTag, release.suiteTag, 'current suite tag must resolve to its manifest');
assert.equal(release.suiteTag, `v${release.version}`, 'suite tag must match the release version');
assert.equal(
  release.repository,
  'https://github.com/inttegro/inttegro-demos',
  'release repository must remain canonical',
);
assert.equal(
  release.permalinkTemplate,
  `${release.repository}/blob/{tag}/{file}#L{start}-L{end}`,
  'Studio permalink template must use an immutable tag and explicit line range',
);
assert.equal(
  release.rawTemplate,
  'https://raw.githubusercontent.com/inttegro/inttegro-demos/{tag}/{file}',
  'raw source template must use an immutable tag',
);
assert(existsSync(join(demosRoot, release.releaseNotes)), 'release notes referenced by the manifest must exist');
assert.equal(release.deploymentManifest, 'deployments.json', 'release must identify its deployment contract');
assert.equal(release.demos.length, published.length, 'current release metadata must resolve every published demo');
assert.deepEqual(
  release.demos.map((demo) => demo.id).toSorted(),
  published.map((demo) => demo.id).toSorted(),
  'current release demo IDs must match the published roadmap subset',
);
assert.equal(new Set(release.demos.map((demo) => demo.tag)).size, published.length, 'per-demo release tags must be unique');

for (const demo of release.demos) {
  assert.equal(demo.version, release.version, `${demo.id} version must match the suite release`);
  assert.equal(demo.tag, `${demo.id}-v${release.version}`, `${demo.id} tag must be deterministic`);
  assert.equal(demo.path, demo.id, `${demo.id} release path must match its manifest directory`);
  for (const sourcePath of demo.entryPoints) {
    assert(sourcePath.startsWith(`${demo.path}/`), `${sourcePath} must remain inside ${demo.path}`);
    if (!existsSync(join(demosRoot, sourcePath))) {
      assert.doesNotThrow(
        () => execFileSync('git', ['cat-file', '-e', `${demo.tag}:${sourcePath}`], { cwd: demosRoot, stdio: 'ignore' }),
        `release entry point does not exist at ${demo.tag}: ${sourcePath}`,
      );
    }
  }
}

const expectedStories = {
  'kora-market': ['nextjs', 'nuxt', 'rails', 'laravel'],
  'afterglow-sessions': ['express', 'django', 'fastapi'],
  ledgerline: ['go', 'spring-boot'],
  'kora-market-mobile': ['ios-swiftui', 'android-compose', 'flutter', 'react-native-expo'],
  openfield: ['astro', 'nestjs', 'redwoodsdk'],
};

for (const [story, expectedIds] of Object.entries(expectedStories)) {
  const actualIds = implemented.filter((demo) => demo.story === story).map((demo) => demo.id).sort();
  assert.deepEqual(actualIds, expectedIds.toSorted(), `${story} demo mapping must stay intentional`);
}

for (const demo of implemented) {
  const directory = join(demosRoot, demo.id);
  assert(existsSync(directory), `missing implemented demo directory: ${demo.id}`);
  assert(existsSync(join(directory, 'README.md')), `missing implemented demo README: ${demo.id}`);
}

const checkoutPresentationAssets = {
  nextjs: 'nextjs/public',
  express: 'express/public',
  nuxt: 'nuxt/public',
  go: 'go/static',
  django: 'django/src/checkout/static/checkout',
  fastapi: 'fastapi/public/static',
  rails: 'rails/public',
  laravel: 'laravel/public',
  'spring-boot': 'spring-boot/src/main/resources/static',
  nestjs: 'nestjs/public',
  redwoodsdk: 'redwoodsdk/public',
  astro: 'astro/public',
};
const presentationScript = readFileSync(join(demosRoot, 'assets/checkout-presentations.js'), 'utf8');
const presentationStyles = readFileSync(join(demosRoot, 'assets/checkout-presentations.css'), 'utf8');
const loaderEntry = readFileSync(join(demosRoot, 'assets/inttegro-loader.entry.js'), 'utf8');
const loaderBundlePath = join(demosRoot, 'assets/inttegro-loader.js');
assert(existsSync(loaderBundlePath), 'the public Inttegro loader bundle must be built');
const loaderBundle = readFileSync(loaderBundlePath, 'utf8');
for (const value of ['embedded', 'modal', 'hosted']) {
  assert(
    presentationScript.includes(`    ${value}: {`),
    `presentation selector must offer ${value} Checkout`,
  );
}
assert(
  loaderEntry.includes('const INTTEGRO_JS_VERSION = "0.3.0"'),
  'browser asset entry point must pin the reviewed public loader version',
);
assert(
  presentationScript.startsWith('import { loadInttegro } from "./inttegro-loader.js";'),
  'presentation client must consume the generated public loader bundle',
);
assert(
  loaderBundle.includes('https://js.inttegro.com/inttegro.js@0.3.0'),
  'public loader bundle must pin the reviewed Inttegro-hosted runtime',
);
assert(
  presentationScript.includes('headers: { Accept: "application/json" }'),
  'embedded and modal Checkout must negotiate the minimal JSON representation',
);
assert(
  presentationScript.includes('appearance: { theme: "light" }'),
  'first-party demos must render Checkout in the same light theme as their payment containers',
);
assert(
  presentationScript.includes('if (mode === "modal") await controller.present();'),
  'modal Checkout must delegate presentation, focus, dismissal, and cleanup to the Inttegro runtime',
);
for (const obsoleteModalImplementation of [
  'modalSurface(',
  'data-inttegro-checkout-dialog',
  'document.createElement("dialog")',
]) {
  assert(
    !presentationScript.includes(obsoleteModalImplementation),
    `demos must not build merchant-owned modal chrome: ${obsoleteModalImplementation}`,
  );
}
for (const redundantCopy of [
  'Complete your payment here',
  'Your order remains with this app.',
  'Checkout is ready.',
]) {
  assert(
    !presentationScript.includes(redundantCopy),
    `presentation chrome must not repeat redundant copy: ${redundantCopy}`,
  );
}
for (const [id, directory] of Object.entries(checkoutPresentationAssets)) {
  const scriptPath = join(demosRoot, directory, 'checkout-presentations.js');
  const stylesPath = join(demosRoot, directory, 'checkout-presentations.css');
  const loaderPath = join(demosRoot, directory, 'inttegro-loader.js');
  assert(existsSync(scriptPath), `${id} must ship the shared Checkout presentation client`);
  assert(existsSync(stylesPath), `${id} must ship the shared Checkout presentation styles`);
  assert(existsSync(loaderPath), `${id} must ship the public Inttegro loader bundle`);
  assert.equal(readFileSync(scriptPath, 'utf8'), presentationScript, `${id} presentation client must match the reviewed shared asset`);
  assert.equal(readFileSync(stylesPath, 'utf8'), presentationStyles, `${id} presentation styles must match the reviewed shared asset`);
  assert.equal(readFileSync(loaderPath, 'utf8'), loaderBundle, `${id} loader bundle must match the reviewed shared asset`);
}

const checkoutHandlers = {
  nextjs: 'nextjs/app/checkout/route.ts',
  express: 'express/src/app.ts',
  nuxt: 'nuxt/server/routes/checkout.post.ts',
  go: 'go/main.go',
  django: 'django/src/checkout/views.py',
  fastapi: 'fastapi/src/app/main.py',
  rails: 'rails/app/controllers/checkouts_controller.rb',
  laravel: 'laravel/app/Http/Controllers/CheckoutController.php',
  'spring-boot': 'spring-boot/src/main/java/com/inttegro/demo/CheckoutController.java',
  nestjs: 'nestjs/src/campaign.controller.ts',
  redwoodsdk: 'redwoodsdk/src/worker.tsx',
  astro: 'astro/src/pages/checkout.ts',
};
const checkoutDocuments = {
  nextjs: 'nextjs/app/layout.tsx',
  express: 'express/src/pages.ts',
  nuxt: 'nuxt/nuxt.config.ts',
  go: 'go/templates/home.html',
  django: 'django/src/checkout/templates/checkout/home.html',
  fastapi: 'fastapi/src/app/templates/home.html',
  rails: 'rails/app/views/layouts/application.html.erb',
  laravel: 'laravel/resources/views/checkout.blade.php',
  'spring-boot': 'spring-boot/src/main/resources/templates/checkout.html',
  nestjs: 'nestjs/src/pages.ts',
  redwoodsdk: 'redwoodsdk/src/app/document.tsx',
  astro: 'astro/src/layouts/BaseLayout.astro',
};
const frameworkPresentationClients = {
  fastapi: {
    asset: '/static/angular/main.js',
    source: 'fastapi/client/checkout-flow.component.ts',
  },
  nestjs: {
    asset: '/svelte/checkout.js',
    source: 'nestjs/client/CheckoutFlow.svelte',
  },
};
assert.deepEqual(Object.keys(checkoutHandlers).toSorted(), serverDemoIds.toSorted());
assert.deepEqual(Object.keys(checkoutDocuments).toSorted(), serverDemoIds.toSorted());
for (const id of serverDemoIds) {
  const handler = readFileSync(join(demosRoot, checkoutHandlers[id]), 'utf8');
  assert(handler.includes('orderId'), `${id} must return the finalized Order ID for browser Checkout`);
  assert(handler.toLowerCase().includes('no-store'), `${id} JSON Checkout responses must not be cached`);
  const document = readFileSync(join(demosRoot, checkoutDocuments[id]), 'utf8');
  assert(document.includes('checkout-presentations.css'), `${id} must load the shared presentation styles`);
  const frameworkClient = frameworkPresentationClients[id];
  if (frameworkClient) {
    assert(document.includes(frameworkClient.asset), `${id} must load its framework Checkout client`);
    const clientSource = readFileSync(join(demosRoot, frameworkClient.source), 'utf8');
    assert(
      clientSource.includes("headers: { Accept: 'application/json' }"),
      `${id} framework client must negotiate the minimal JSON representation`,
    );
  } else {
    const presentationOwner = id === 'redwoodsdk'
      ? readFileSync(join(demosRoot, 'redwoodsdk/src/client.tsx'), 'utf8')
      : document;
    assert(presentationOwner.includes('checkout-presentations.js'), `${id} must load the shared presentation client`);
  }
  assert(
    document.includes('type="module"') || document.includes("type: 'module'"),
    `${id} must load the presentation client as a JavaScript module`,
  );
  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  for (const label of ['Embedded', 'Modal', 'Hosted page']) {
    assert(readme.includes(label), `${id} README must document the ${label} presentation`);
  }
}

const frameworkAdapters = {
  fastapi: {
    packageName: '@inttegro/angular',
    manifest: 'fastapi/package.json',
    source: 'fastapi/client/checkout-flow.component.ts',
  },
  nestjs: {
    packageName: '@inttegro/svelte',
    manifest: 'nestjs/package.json',
    source: 'nestjs/client/CheckoutFlow.svelte',
  },
  nextjs: {
    packageName: '@inttegro/react',
    manifest: 'nextjs/package.json',
    source: 'nextjs/app/inttegro-demo-checkout.tsx',
  },
  nuxt: {
    packageName: '@inttegro/vue',
    manifest: 'nuxt/package.json',
    source: 'nuxt/plugins/inttegro-checkout.client.ts',
  },
  redwoodsdk: {
    packageName: '@inttegro/react',
    manifest: 'redwoodsdk/package.json',
    source: 'redwoodsdk/src/inttegro-demo-checkout.tsx',
  },
};
for (const [id, adapter] of Object.entries(frameworkAdapters)) {
  const packageManifest = JSON.parse(
    readFileSync(join(demosRoot, adapter.manifest), 'utf8'),
  );
  assert.equal(
    packageManifest.dependencies[adapter.packageName],
    '0.2.0',
    `${id} must pin ${adapter.packageName} 0.2.0`,
  );
  const source = readFileSync(join(demosRoot, adapter.source), 'utf8');
  assert(
    source.includes(`from '${adapter.packageName}'`),
    `${id} must mount Checkout through ${adapter.packageName}`,
  );
}

assert.equal(deployments.schemaVersion, 1, 'deployment manifest schema must be version 1');
assert.equal(deployments.repository, release.repository, 'deployment repository must remain canonical');
assert.equal(deployments.releaseVersion, release.version, 'deployments must target the current release');
assert.equal(deployments.suiteTag, release.suiteTag, 'deployments must target the current suite tag');
assert.equal(deployments.domain.status, 'active', 'inttegro.dev must be recorded as an active release domain');
assert.equal(deployments.domain.provider, 'cloudflare');
assert.match(deployments.domain.activatedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(deployments.domain.catalogHost, 'demos.inttegro.dev');
assert.equal(deployments.domain.demoHostTemplate, '{id}-demo.inttegro.dev');
assert.equal(deployments.domain.nativeBackendHost, 'mobile-api.inttegro.dev');
assert.equal(deployments.deployRefTemplate, 'deploy-{id}-v{version}');
assert.equal(deployments.environment.INTTEGRO_DEMO_CUSTOMER_ID.default, false);
for (const name of ['INTTEGRO_API_KEY', 'INTTEGRO_DEMO_PRODUCT_ID', 'INTTEGRO_DEMO_PRICE_ID', 'INTTEGRO_DEMO_PUBLIC_URL']) {
  assert.equal(deployments.environment[name].required, true, `${name} must be required for every server demo`);
}
assert.deepEqual(
  deployments.demos.map((demo) => demo.id).toSorted(),
  published.map((demo) => demo.id).toSorted(),
  'deployment metadata must cover every published demo exactly once',
);

const providerStatuses = new Set(['prepared', 'verified', 'blocked']);
const providerRecommendations = new Set(['recommended', 'alternative', 'experimental']);
const providerIds = new Set(Object.keys(deployments.providers));
const providerIsActive = (provider) => provider.status === 'prepared' || provider.status === 'verified';
const compareProviders = (left, right) => {
  const activityOrder = Number(providerIsActive(right)) - Number(providerIsActive(left));
  return activityOrder || left.name.localeCompare(right.name);
};
const providerButtonAssets = {
  'cloud-run': 'cloud-run-button.svg',
  cloudflare: 'cloudflare-button.svg',
  docker: 'docker-button.svg',
  railway: 'railway-button.svg',
  render: 'render-button.svg',
  vercel: 'vercel-button.svg',
};
for (const provider of Object.values(deployments.providers)) {
  assert.match(provider.documentation, /^https:\/\//, `${provider.name} must link its canonical deployment documentation`);
  assert.match(provider.icon, /^\/assets\/providers\/[a-z-]+\.svg$/, `${provider.name} must define its provider icon`);
  assert(existsSync(join(demosRoot, provider.icon.slice(1))), `${provider.name} provider icon must exist`);
  if (provider.buttonImage) {
    assert.match(
      provider.buttonImage,
      /^\/assets\/providers\/[a-z-]+-button\.svg$/,
      `${provider.name} button image must use a shared repository asset`,
    );
    assert(
      existsSync(join(demosRoot, provider.buttonImage.slice(1))),
      `${provider.name} button image must exist`,
    );
  }
}

for (const demo of deployments.demos) {
  assert.equal(new Set(demo.providers.map((provider) => provider.id)).size, demo.providers.length, `${demo.id} provider IDs must be unique`);
  if (demo.mode === 'native') {
    assert.equal(demo.providers.length, 0, `${demo.id} must not advertise a cloud deployment for native application code`);
    assert.equal(demo.companionBackend, 'nextjs', `${demo.id} must identify the shared mobile backend`);
    continue;
  }
  if (demo.live) {
    assert.equal(demo.live.status, 'verified', `${demo.id} live deployment must be verified`);
    assert(['cloudflare', 'railway'].includes(demo.live.provider), `${demo.id} uses an unknown live provider`);
    assert.equal(
      demo.live.url,
      `https://${deployments.domain.demoHostTemplate.replace('{id}', demo.id)}`,
      `${demo.id} live URL must use the canonical host`,
    );
  }
  assert(demo.providers.length > 0, `${demo.id} must document at least one provider`);
  assert.deepEqual(
    demo.providers.map((provider) => provider.id).toSorted(),
    [...providerIds].toSorted(),
    `${demo.id} must expose every provider as active or unavailable`,
  );
  assert.equal(
    demo.providers.filter((provider) => provider.recommendation === 'recommended').length,
    1,
    `${demo.id} must identify exactly one recommended provider`,
  );
  for (const provider of demo.providers) {
    assert(providerIds.has(provider.id), `${demo.id} references unknown provider ${provider.id}`);
    assert(providerStatuses.has(provider.status), `${demo.id}/${provider.id} has invalid status`);
    assert(providerRecommendations.has(provider.recommendation), `${demo.id}/${provider.id} has invalid recommendation`);
    if (provider.config) {
      assert(existsSync(join(demosRoot, provider.config)), `${demo.id}/${provider.id} config does not exist: ${provider.config}`);
    }
    if (provider.status === 'blocked') {
      assert(provider.reason, `${demo.id}/${provider.id} must explain why it is blocked`);
    } else {
      assert(provider.config, `${demo.id}/${provider.id} must point to checked-in configuration`);
    }
    if (provider.id === 'railway' && provider.status !== 'blocked') {
      assert.match(
        provider.templateId,
        /^[A-Za-z0-9_-]{6}$/,
        `${demo.id}/railway must identify its shareable one-click template`,
      );
    }
  }
}

for (const id of ['nextjs', 'nuxt', 'express', 'django', 'fastapi', 'rails', 'laravel', 'go', 'astro']) {
  const demo = deployments.demos.find((candidate) => candidate.id === id);
  assert.equal(demo.live?.status, 'verified', `${id} must record its verified first-party deployment`);
}
assert.equal(
  deployments.demos.find((demo) => demo.id === 'spring-boot').live,
  undefined,
  'Spring Boot must not claim a live deployment while its SDK publication is gated',
);

for (const id of ['nextjs', 'nuxt', 'express', 'django', 'fastapi', 'rails', 'laravel', 'go', 'spring-boot', 'nestjs', 'astro']) {
  for (const file of ['Dockerfile', '.dockerignore']) {
    assert(existsSync(join(demosRoot, id, file)), `${id} must include ${file} for portable deployment`);
  }
}

for (const id of ['express', 'django', 'fastapi', 'rails', 'laravel', 'go', 'spring-boot', 'nestjs', 'astro']) {
  for (const file of ['render.yaml', 'railway.json']) {
    assert(existsSync(join(demosRoot, id, file)), `${id} must include ${file} for portable deployment`);
  }
}

for (const [id, envFile, port, hasContainerHealthcheck] of [
  ['nextjs', '.env.local', 3000],
  ['nuxt', '.env', 3002],
  ['express', '.env', 3001],
  ['django', '.env', 3004],
  ['fastapi', '.env', 3005],
  ['go', '.env', 3003, false],
  ['rails', '.env', 3006],
  ['laravel', '.env', 3007],
]) {
  const composePath = join(demosRoot, id, 'compose.yaml');
  assert(existsSync(composePath), `${id} must include a one-command Compose path`);
  const compose = readFileSync(composePath, 'utf8');
  assert(compose.includes(`env_file: ${envFile}`), `${id} Compose must load its documented environment file`);
  assert(compose.includes(`"${port}:${port}"`), `${id} Compose must publish its documented port`);
  if (hasContainerHealthcheck !== false) {
    assert(compose.includes(`127.0.0.1:${port}/health`), `${id} Compose must check application health`);
  }
  assert(
    readFileSync(join(demosRoot, id, 'README.md'), 'utf8').includes('docker compose up --build --wait'),
    `${id} README must document its one-command Compose path`,
  );
  const docker = deployments.demos
    .find((demo) => demo.id === id)
    ?.providers.find((provider) => provider.id === 'docker');
  assert.equal(docker?.status, 'prepared', `${id} Docker workflow must be reader-launchable`);
  assert.equal(docker?.config, `${id}/compose.yaml`, `${id} Docker workflow must reference Compose`);
  assert(
    readFileSync(join(demosRoot, id, 'README.md'), 'utf8').includes('../assets/providers/docker-button.svg'),
    `${id} README must present the Docker action with its logo`,
  );
}

const springDocker = deployments.demos
  .find((demo) => demo.id === 'spring-boot')
  ?.providers.find((provider) => provider.id === 'docker');
assert.equal(springDocker?.status, 'blocked', 'Spring Boot Docker must remain gated on Java SDK publication');

const nestReadme = readFileSync(join(demosRoot, 'nestjs/README.md'), 'utf8');
const nestCompose = readFileSync(join(demosRoot, 'nestjs/compose.yaml'), 'utf8');
assert(nestCompose.includes('path: .env'), 'NestJS Compose must load its documented environment file');
assert(nestCompose.includes('"3013:3013"'), 'NestJS Compose must publish its documented port');
assert(nestCompose.includes('127.0.0.1:3013/health'), 'NestJS Compose must check application health');
assert(nestReadme.includes('docker compose up --build --wait'), 'NestJS README must document Compose');
assert(nestReadme.includes('../assets/providers/docker-button.svg'), 'NestJS README must present Docker with its logo');

const nestCloudRun = JSON.parse(readFileSync(join(demosRoot, 'nestjs/app.json'), 'utf8'));
for (const name of ['INTTEGRO_API_KEY', 'INTTEGRO_DEMO_PRODUCT_ID', 'INTTEGRO_DEMO_PRICE_ID']) {
  assert(nestCloudRun.env[name], `nestjs/app.json must prompt for ${name}`);
}
assert.equal(nestCloudRun.env.INTTEGRO_API_KEY.value, undefined, 'NestJS Cloud Run config must not contain an API key');
assert.equal(nestCloudRun.options['allow-unauthenticated'], true, 'NestJS Cloud Run service must be public');
assert(nestCloudRun.options['max-instances'] <= 3, 'NestJS must cap Cloud Run scale for reader cost safety');
assert(nestCloudRun.hooks.postcreate.commands.join('\n').includes('$SERVICE_URL'), 'NestJS must derive its Cloud Run origin');
assert(nestCloudRun.hooks.postcreate.commands.join('\n').includes('INTTEGRO_DEMO_PUBLIC_URL'), 'NestJS must configure its checkout return origin');
assert(
  nestReadme.includes(`immutable ${release.version} deployment branch`),
  'NestJS must explain its immutable release deployment branch',
);

const astroReadme = readFileSync(join(demosRoot, 'astro/README.md'), 'utf8');
const astroCompose = readFileSync(join(demosRoot, 'astro/compose.yaml'), 'utf8');
const astroConfig = readFileSync(join(demosRoot, 'astro/astro.config.mjs'), 'utf8');
const astroPackage = JSON.parse(readFileSync(join(demosRoot, 'astro/package.json'), 'utf8'));
const astroCloudRun = JSON.parse(readFileSync(join(demosRoot, 'astro/app.json'), 'utf8'));
assert(deployments.demos.some((demo) => demo.id === 'astro'), 'Astro deployment metadata must be published');
assert.equal(astroPackage.dependencies.astro, '7.3.2', 'Astro must pin the verified framework release');
assert.equal(astroPackage.dependencies['@astrojs/node'], '11.1.5', 'Astro must use the compatible official Node adapter');
assert.equal(astroPackage.dependencies['@inttegro/inttegro-sdk'], '8.2.0', 'Astro must pin the verified Inttegro TypeScript SDK');
assert(astroConfig.includes('checkOrigin: true'), 'Astro must keep same-origin form protection enabled');
assert(astroConfig.includes('bodySizeLimit: 64 * 1024'), 'Astro must bound checkout request bodies');
assert(astroCompose.includes('path: .env'), 'Astro Compose must load its documented environment file');
assert(astroCompose.includes('"3014:3014"'), 'Astro Compose must publish its documented port');
assert(astroCompose.includes('127.0.0.1:3014/health'), 'Astro Compose must check application health');
assert(astroReadme.includes('docker compose up --build --wait'), 'Astro README must document Compose');
assert(astroReadme.includes('../assets/providers/docker-button.svg'), 'Astro README must present Docker with its logo');
assert(astroReadme.includes('immutable 1.8.3 deployment branch'), 'Astro README must identify its immutable deployment ref');
assert(astroReadme.includes('deploy.cloud.run/?'), 'Astro must publish its Cloud Run deployment action');
for (const name of ['INTTEGRO_API_KEY', 'INTTEGRO_DEMO_PRODUCT_ID', 'INTTEGRO_DEMO_PRICE_ID']) {
  assert(astroCloudRun.env[name], `astro/app.json must prompt for ${name}`);
}
assert.equal(astroCloudRun.env.INTTEGRO_API_KEY.value, undefined, 'Astro Cloud Run config must not contain an API key');
assert.equal(astroCloudRun.options['allow-unauthenticated'], true, 'Astro Cloud Run service must be public');
assert(astroCloudRun.options['max-instances'] <= 3, 'Astro must cap Cloud Run scale for reader cost safety');
assert(astroCloudRun.hooks.postcreate.commands.join('\n').includes('$SERVICE_URL'), 'Astro must derive its Cloud Run origin');
assert(astroCloudRun.hooks.postcreate.commands.join('\n').includes('INTTEGRO_DEMO_PUBLIC_URL'), 'Astro must configure its checkout return origin');

for (const id of ['express', 'django', 'fastapi', 'go', 'rails', 'laravel']) {
  const deployment = deployments.demos.find((demo) => demo.id === id);
  const provider = deployment.providers.find((candidate) => candidate.id === 'cloud-run');
  assert(
    ['prepared', 'verified'].includes(provider.status),
    `${id}/cloud-run must be reader-launchable in the current release`,
  );
  assert.equal(provider.config, `${id}/app.json`, `${id}/cloud-run must reference its app.json contract`);

  const cloudRun = JSON.parse(readFileSync(join(demosRoot, id, 'app.json'), 'utf8'));
  for (const name of ['INTTEGRO_API_KEY', 'INTTEGRO_DEMO_PRODUCT_ID', 'INTTEGRO_DEMO_PRICE_ID']) {
    assert(cloudRun.env[name], `${id}/app.json must prompt for ${name}`);
  }
  assert.equal(cloudRun.env.INTTEGRO_API_KEY.value, undefined, `${id}/app.json must not contain an API key`);
  assert.equal(cloudRun.env.INTTEGRO_API_KEY.generator, undefined, `${id}/app.json must prompt for the API key`);
  assert.equal(cloudRun.options['allow-unauthenticated'], true, `${id} must create a public demo service`);
  assert(cloudRun.options['max-instances'] <= 3, `${id} must cap Cloud Run scale for reader cost safety`);
  const postcreate = cloudRun.hooks?.postcreate?.commands?.join('\n') ?? '';
  assert(postcreate.includes('$SERVICE_URL'), `${id} must derive its Cloud Run public origin`);
  assert(postcreate.includes('INTTEGRO_DEMO_PUBLIC_URL'), `${id} must configure its checkout return origin`);

  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  assert(
    readme.includes(
      `https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-${id}-v${release.version}`,
    ),
    `${id} README must launch Cloud Run from its immutable deployment ref`,
  );
}

const djangoCloudRun = JSON.parse(readFileSync(join(demosRoot, 'django/app.json'), 'utf8'));
assert.equal(djangoCloudRun.env.DJANGO_SECRET_KEY.generator, 'secret');
assert(djangoCloudRun.hooks.postcreate.commands.join('\n').includes('DJANGO_ALLOWED_HOSTS'));
assert(djangoCloudRun.hooks.postcreate.commands.join('\n').includes('DJANGO_CSRF_TRUSTED_ORIGINS'));
const railsCloudRun = JSON.parse(readFileSync(join(demosRoot, 'rails/app.json'), 'utf8'));
assert.equal(railsCloudRun.env.SECRET_KEY_BASE.generator, 'secret');
const laravelCloudRun = JSON.parse(readFileSync(join(demosRoot, 'laravel/app.json'), 'utf8'));
assert.equal(laravelCloudRun.env.APP_KEY.value, undefined);
assert.equal(laravelCloudRun.env.APP_KEY.generator, undefined);
assert(laravelCloudRun.env.APP_KEY.description.includes('key:generate --show'));

for (const id of ['express', 'django', 'fastapi', 'laravel', 'go']) {
  const railway = JSON.parse(readFileSync(join(demosRoot, id, 'railway.json'), 'utf8'));
  assert.equal(railway.deploy?.healthcheckPath, '/health', `${id} must retain its Railway health probe`);
}
const railsRailway = JSON.parse(readFileSync(join(demosRoot, 'rails/railway.json'), 'utf8'));
assert.equal(
  railsRailway.deploy?.healthcheckPath,
  undefined,
  'Rails must use Railway process readiness because its production HTTP probe redirects to HTTPS',
);

for (const id of ['nextjs', 'nuxt']) {
  assert(existsSync(join(demosRoot, id, 'vercel.json')), `${id} must include an explicit Vercel contract`);
  assert(existsSync(join(demosRoot, id, 'wrangler.jsonc')), `${id} must include an explicit Cloudflare contract`);
}
assert(existsSync(join(demosRoot, 'express/wrangler.jsonc')), 'Express must include its Cloudflare Worker contract');
for (const id of ['django', 'fastapi', 'redwoodsdk']) {
  assert(existsSync(join(demosRoot, id, 'wrangler.jsonc')), `${id} must include its Cloudflare Worker contract`);
}
assert(existsSync(join(demosRoot, 'catalog/wrangler.jsonc')), 'catalogue must be ready for Cloudflare Static Assets');
assert(existsSync(join(demosRoot, 'hosting/railway-edge/wrangler.jsonc')), 'Railway-hosted demos must define their first-party edge routes');

for (const configPath of [
  'nextjs/wrangler.jsonc', 'nuxt/wrangler.jsonc', 'express/wrangler.jsonc',
  'django/wrangler.jsonc', 'fastapi/wrangler.jsonc', 'redwoodsdk/wrangler.jsonc',
  'catalog/wrangler.jsonc',
]) {
  const config = readFileSync(join(demosRoot, configPath), 'utf8');
  assert(!config.includes('inttegro.dev'), `${configPath} must remain host-neutral for reader-owned deployment`);
}
for (const id of ['django', 'fastapi']) {
  const source = decisions.sourceEntryPoints[id]
    .map((path) => readFileSync(join(demosRoot, path), 'utf8'))
    .join('\n');
  const pyproject = readFileSync(join(demosRoot, id, 'pyproject.toml'), 'utf8');
  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  assert(source.includes('AsyncInttegroClient'), `${id} must use the async SDK at its application boundary`);
  assert(pyproject.includes('"inttegro==6.3.0"'), `${id} must require the async-first Python SDK`);
  assert(
    readFileSync(join(demosRoot, `${id}/wrangler.jsonc`), 'utf8').includes('"python_workers"'),
    `${id} must opt into the Python Workers runtime`,
  );
  assert(readme.includes('deploy.workers.cloudflare.com'), `${id} must expose its Cloudflare deploy action`);
}
assert(
  readFileSync(join(demosRoot, 'redwoodsdk/README.md'), 'utf8').includes('deploy.workers.cloudflare.com'),
  'RedwoodSDK must expose its Cloudflare deploy action',
);
const nuxtWorkerConfig = readFileSync(join(demosRoot, 'nuxt/wrangler.jsonc'), 'utf8');
assert(
  nuxtWorkerConfig.includes('"no_nodejs_compat", "no_nodejs_compat_v2"'),
  'Nuxt must keep Nitro Node shims isolated from Cloudflare runtime Node shims',
);
for (const configPath of ['nextjs/wrangler.jsonc', 'express/wrangler.jsonc']) {
  const config = readFileSync(join(demosRoot, configPath), 'utf8');
  assert(
    config.includes('"nodejs_compat_populate_process_env"'),
    `${configPath} must map Worker bindings into the process.env contract used by its server runtime`,
  );
}

const generatedCatalogue = JSON.parse(readFileSync(join(demosRoot, 'catalog/public/demos.json'), 'utf8'));
assert.equal(generatedCatalogue.releaseVersion, release.version, 'catalogue must describe the current release');
assert.equal(generatedCatalogue.suiteTag, release.suiteTag, 'catalogue suite tag must be current');
assert.equal(generatedCatalogue.domainStatus, 'active', 'catalogue must label the active release domain truthfully');
assert.deepEqual(
  generatedCatalogue.demos.map((demo) => demo.id),
  release.demos.map((demo) => demo.id),
  'catalogue order must follow the published release manifest',
);
const generatedNext = generatedCatalogue.demos.find((demo) => demo.id === 'nextjs');
assert(
  generatedNext.environment.some((variable) => variable.name === 'INTTEGRO_DEMO_CUSTOMER_ID'),
  'Next.js catalogue deployment requirements must include the mobile demo customer',
);
for (const demo of generatedCatalogue.demos.filter((candidate) => candidate.mode === 'server')) {
  const activeProviders = demo.providers.filter((provider) =>
    ['prepared', 'verified'].includes(provider.status),
  );
  const unavailableProviders = demo.providers.filter(
    (provider) => !['prepared', 'verified'].includes(provider.status),
  );
  assert.deepEqual(
    demo.providers,
    [...activeProviders, ...unavailableProviders],
    `${demo.id} must list active providers before unavailable providers`,
  );
  for (const [group, providers] of [
    ['active', activeProviders],
    ['unavailable', unavailableProviders],
  ]) {
    assert.deepEqual(
      providers.map((provider) => provider.name),
      providers.map((provider) => provider.name).toSorted((left, right) => left.localeCompare(right)),
      `${demo.id} ${group} providers must be alphabetical`,
    );
  }
  const expectedProductName = demo.id === 'nuxt' ? 'NUXT_DEMO_PRODUCT_ID' : 'INTTEGRO_DEMO_PRODUCT_ID';
  const expectedPriceName = demo.id === 'nuxt' ? 'NUXT_DEMO_PRICE_ID' : 'INTTEGRO_DEMO_PRICE_ID';
  assert(
    demo.environment.some((variable) => variable.name === expectedProductName),
    `${demo.id} must declare its server-side Product ID`,
  );
  assert(
    demo.environment.some((variable) => variable.name === expectedPriceName),
    `${demo.id} must declare its server-side Price ID`,
  );
}
for (const demo of generatedCatalogue.demos.filter((candidate) => candidate.mode === 'server' && candidate.id !== 'nextjs')) {
  assert(
    !demo.environment.some((variable) => variable.name === 'INTTEGRO_DEMO_CUSTOMER_ID'),
    `${demo.id} must not request the Next.js-only demo customer`,
  );
}

const catalogueApplication = readFileSync(join(demosRoot, 'catalog/public/app.js'), 'utf8');
assert(
  catalogueApplication.includes('const deploymentSource = `${data.repository}/tree/${demo.deployRef}`'),
  'catalogue deploy actions must use root-level immutable deployment refs',
);
assert(
  !catalogueApplication.includes('taggedSubdirectory'),
  'catalogue deploy actions must not send provider builds to tagged subdirectories',
);
assert(
  catalogueApplication.includes("['prepared', 'verified'].includes(provider.status)"),
  'catalogue must let readers launch prepared or verified provider configurations',
);
assert(
  catalogueApplication.includes('railway.com/new/template/${provider.templateId}'),
  'catalogue must build Railway actions from the release manifest template code',
);
assert(
  catalogueApplication.includes('https://deploy.cloud.run/?${query}'),
  'catalogue must build Cloud Run actions from immutable deployment refs',
);
assert(
  catalogueApplication.includes("provider.id === 'docker'"),
  'catalogue must link Docker to the tagged run guide',
);
assert(
  catalogueApplication.includes('<img src="${provider.icon}" alt="" />'),
  'catalogue provider choices must use provider logos',
);
const catalogueDocument = readFileSync(join(demosRoot, 'catalog/public/index.html'), 'utf8');
assert(!catalogueDocument.includes('Release candidate'), 'published catalogue must not label the current release as a candidate');
for (const providerId of Object.keys(deployments.providers)) {
  assert(
    catalogueDocument.includes(`<option value="${providerId}">`),
    `catalogue filter must expose ${providerId}`,
  );
}

for (const id of ['nextjs', 'nuxt', 'express']) {
  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  assert(
    readme.includes(`/tree/deploy-${id}-v${release.version}`),
    `${id} deployment buttons must target its root-level immutable deployment ref`,
  );
}

for (const demo of deployments.demos.filter((candidate) => candidate.mode === 'server')) {
  const readme = readFileSync(join(demosRoot, demo.id, 'README.md'), 'utf8');
  const launchableProviders = demo.providers.filter((candidate) => candidate.status !== 'blocked');
  for (const provider of launchableProviders) {
    const buttonAsset = providerButtonAssets[provider.id];
    if (!buttonAsset) continue;
    assert(
      readme.includes(`../assets/providers/${buttonAsset}`),
      `${demo.id}/${provider.id} must use the shared provider button`,
    );
  }
  const expectedButtonOrder = demo.providers
    .filter((provider) => providerButtonAssets[provider.id] && ['prepared', 'verified'].includes(provider.status))
    .map((provider) => ({ ...provider, name: deployments.providers[provider.id].name }))
    .sort(compareProviders)
    .map((provider) => provider.id);
  const buttonOrder = launchableProviders
    .filter((provider) => providerButtonAssets[provider.id])
    .map((provider) => ({
      id: provider.id,
      offset: readme.indexOf(`../assets/providers/${providerButtonAssets[provider.id]}`),
    }))
    .toSorted((left, right) => left.offset - right.offset)
    .map((provider) => provider.id);
  assert.deepEqual(
    buttonOrder,
    expectedButtonOrder,
    `${demo.id} README buttons must follow the active provider order`,
  );
}

const railwayTemplateIds = {
  express: 'MJF7nD',
  django: '0h-Ilj',
  fastapi: 'wk2B6a',
  go: 'ABT6ae',
  rails: 'CssQzr',
  laravel: 'p5qiP5',
};
for (const [id, templateId] of Object.entries(railwayTemplateIds)) {
  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  assert(
    readme.includes(`railway.com/new/template/${templateId}`),
    `${id} README must link its shareable Railway template`,
  );
  const generatedDemo = generatedCatalogue.demos.find((demo) => demo.id === id);
  const railway = generatedDemo.providers.find((provider) => provider.id === 'railway');
  assert.equal(railway.templateId, templateId, `${id} catalogue must expose the Railway template code`);
  assert(
    ['prepared', 'verified'].includes(railway.status),
    `${id} Railway template must be reader-launchable`,
  );
}

for (const id of ['ios-swiftui', 'android-compose', 'flutter', 'react-native-expo']) {
  const readme = readFileSync(join(demosRoot, id, 'README.md'), 'utf8');
  assert(readme.includes('## Deploy the companion backend'), `${id} must explain how to deploy its server trust boundary`);
  assert(
    readme.includes(`/tree/deploy-nextjs-v${release.version}`),
    `${id} companion deployment button must target the immutable Next.js deployment ref`,
  );
  assert(
    readme.includes('../assets/providers/docker-button.svg'),
    `${id} must present the Docker companion-backend action with its logo`,
  );
  for (const buttonAsset of ['cloudflare-button.svg', 'vercel-button.svg']) {
    assert(
      readme.includes(`../assets/providers/${buttonAsset}`),
      `${id} must use the shared ${buttonAsset.replace('-button.svg', '')} backend button`,
    );
  }
  assert(
    readme.indexOf('cloudflare-button.svg') < readme.indexOf('docker-button.svg')
      && readme.indexOf('docker-button.svg') < readme.indexOf('vercel-button.svg'),
    `${id} companion-backend buttons must be alphabetical`,
  );
}

const deployRefScript = readFileSync(join(demosRoot, 'scripts/prepare-deploy-refs.mjs'), 'utf8');
for (const requiredReleaseGuard of [
  "git(['verify-tag', requestedTag]",
  "git(['verify-tag', sourceDemoTag]",
  "typeof output === 'string' ? output.trim() : ''",
  "`${requestedTag}:LICENSE`",
  ".replaceAll('../DEPLOYING.md'",
  'for (const providerId of providerButtonIds)',
]) {
  assert(
    deployRefScript.includes(requiredReleaseGuard),
    `deployment ref preparation must preserve release guard: ${requiredReleaseGuard}`,
  );
}

assert(existsSync(join(demosRoot, 'INTEGRATION_GUIDE.md')), 'missing human-readable integration guide');
assert.equal(decisions.schemaVersion, 1, 'integration decision schema must be version 1');
assert.deepEqual(
  decisions.markers,
  ['FLOW', 'SECURITY', 'DECISION', 'ALTERNATIVE', 'VERIFY', 'OBSERVABILITY', 'DOCS'],
  'the public source-comment vocabulary must stay stable',
);

const documentationEntries = Object.entries(decisions.canonicalDocs);
assert(documentationEntries.length >= 8, 'decision registry must link the canonical documentation set');
for (const [key, value] of documentationEntries) {
  assert.match(value, /^https:\/\/studio\.inttegro\.com\/[a-z0-9#/-]+$/, `invalid canonical documentation URL: ${key}`);
}

const decisionIds = decisions.decisions.map((decision) => decision.id);
assert.equal(new Set(decisionIds).size, decisionIds.length, 'integration decision IDs must be unique');
assert(decisionIds.length >= 15, 'decision registry must cover the material integration trade-offs');
for (const decision of decisions.decisions) {
  assert.match(decision.id, /^[a-z0-9-]+$/, `invalid decision ID: ${decision.id}`);
  assert(decision.selected && decision.rationale, `${decision.id} must state the selected option and rationale`);
  assert(decision.alternatives.length > 0, `${decision.id} must document at least one alternative`);
  for (const documentationKey of decision.docs) {
    assert(decisions.canonicalDocs[documentationKey], `${decision.id} references unknown docs key: ${documentationKey}`);
  }
}

assert.deepEqual(
  Object.keys(decisions.sourceEntryPoints).toSorted(),
  implemented.map((demo) => demo.id).toSorted(),
  'every implemented demo must have documented source entry points',
);

const knownDecisionIds = new Set(decisionIds);
const decisionReferencePattern = /INTTEGRO:(?:FLOW|SECURITY|DECISION|ALTERNATIVE|VERIFY|OBSERVABILITY) \[([a-z0-9-]+)\]/g;
for (const [demoId, sourcePaths] of Object.entries(decisions.sourceEntryPoints)) {
  let combinedSource = '';
  for (const sourcePath of sourcePaths) {
    const absolutePath = join(demosRoot, sourcePath);
    assert(existsSync(absolutePath), `missing documented source entry point: ${sourcePath}`);
    const source = readFileSync(absolutePath, 'utf8');
    combinedSource += `\n${source}`;
    assert(source.includes('INTTEGRO:'), `${sourcePath} must use the Inttegro comment vocabulary`);
    assert(source.includes('https://studio.inttegro.com/'), `${sourcePath} must link canonical Inttegro documentation`);
    for (const match of source.matchAll(decisionReferencePattern)) {
      assert(knownDecisionIds.has(match[1]), `${sourcePath} references unknown decision ID: ${match[1]}`);
    }
  }
  assert(combinedSource.includes('INTTEGRO:DECISION'), `${demoId} must explain its selected integration decisions`);
  assert(combinedSource.includes('INTTEGRO:ALTERNATIVE'), `${demoId} must explain a viable integration alternative`);
}

const guide = readFileSync(join(demosRoot, 'INTEGRATION_GUIDE.md'), 'utf8');
for (const marker of decisions.markers) {
  assert(guide.includes(`INTTEGRO:${marker}`), `integration guide must define INTTEGRO:${marker}`);
}

for (const id of [
  'nextjs', 'express', 'nuxt', 'go', 'django', 'fastapi', 'rails', 'laravel',
  'spring-boot', 'flutter', 'react-native-expo', 'nestjs', 'redwoodsdk', 'astro',
]) {
  assert(existsSync(join(demosRoot, id, '.env.example')), `missing environment template: ${id}`);
}

for (const asset of [
  'assets/kora-dawn-brew.jpg',
  'assets/kora-maker-story.jpg',
  'assets/accra-afterglow.jpg',
  'assets/afterglow-crowd.jpg',
  'assets/ledgerline-studio.jpg',
  'assets/ledgerline-materials.jpg',
  'assets/openfield-garden.jpg',
  'assets/openfield-impact.jpg',
  'assets/favicon.svg',
  'assets/providers/docker.svg',
  'assets/providers/cloud-run-button.svg',
  'assets/providers/cloudflare-button.svg',
  'assets/providers/docker-button.svg',
  'assets/providers/railway-button.svg',
  'assets/providers/render-button.svg',
  'assets/providers/vercel-button.svg',
]) {
  assert(existsSync(join(demosRoot, asset)), `missing original demo artwork: ${asset}`);
}

for (const [asset, directories] of Object.entries({
  'kora-dawn-brew.jpg': ['nextjs/public', 'nuxt/public', 'rails/public', 'laravel/public'],
  'kora-maker-story.jpg': ['nextjs/public', 'nuxt/public', 'rails/public', 'laravel/public'],
  'accra-afterglow.jpg': ['express/public', 'django/src/checkout/static/checkout', 'fastapi/public/static'],
  'afterglow-crowd.jpg': ['express/public', 'django/src/checkout/static/checkout', 'fastapi/public/static'],
  'ledgerline-studio.jpg': ['go/static', 'spring-boot/src/main/resources/static'],
  'ledgerline-materials.jpg': ['go/static', 'spring-boot/src/main/resources/static'],
  'openfield-garden.jpg': ['nestjs/public', 'redwoodsdk/public', 'astro/public'],
  'openfield-impact.jpg': ['nestjs/public', 'redwoodsdk/public', 'astro/public'],
  'favicon.svg': [
    'nextjs/public', 'nuxt/public', 'rails/public', 'laravel/public', 'express/public',
    'django/src/checkout/static/checkout', 'fastapi/public/static', 'go/static',
    'spring-boot/src/main/resources/static', 'astro/public',
  ],
})) {
  for (const directory of directories) {
    assert(existsSync(join(demosRoot, directory, asset)), `missing ${asset} in ${directory}`);
  }
}

for (const mobileArtwork of [
  'android-compose/app/src/main/res/drawable/kora_dawn_brew.jpg',
  'flutter/assets/kora-dawn-brew.jpg',
  'ios-swiftui/InttegroSwiftUIDemo/Assets.xcassets/KoraProduct.imageset/kora-dawn-brew.jpg',
  'react-native-expo/assets/kora-dawn-brew.jpg',
]) {
  assert(existsSync(join(demosRoot, mobileArtwork)), `missing mobile product artwork: ${mobileArtwork}`);
}

const skippedDirectories = new Set([
  '.build', '.bundle', '.git', '.gradle', '.kotlin', '.next', '.nuxt', '.output',
  '.swiftpm', '.venv', 'DerivedData', 'build', 'dist', 'node_modules',
  'target', 'vendor',
]);
const textExtensions = new Set([
  '.astro', '.dart', '.go', '.java', '.json', '.kt', '.kts', '.md', '.php', '.py', '.rb',
  '.swift', '.ts', '.tsx', '.yaml', '.yml',
]);

function textFiles(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...textFiles(path));
    else if (textExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) output.push(path);
  }
  return output;
}

const staleSDKName = ['Inttegro', 'Payments'].join('');
const staleStoryName = ['Inttegro integration', 'workshop'].join(' ');
const staleMobileField = ['payment', 'Session', 'Secret'].join('');
for (const path of textFiles(demosRoot)) {
  const source = readFileSync(path, 'utf8');
  assert(!source.includes(staleSDKName), `stale SDK name in ${path}`);
  assert(!source.includes(staleStoryName), `stale generic story in ${path}`);
  assert(!source.includes(staleMobileField), `stale mobile SDK field in ${path}`);
}

console.log('Demo contract check passed: 16 published demos, five stories, three web Checkout presentations, deployment contracts, catalogue metadata, source commentary, original artwork, and Inttegro SDK naming are consistent.');
