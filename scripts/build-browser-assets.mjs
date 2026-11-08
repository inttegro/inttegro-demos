import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const destinations = {
  nextjs: "nextjs/public",
  express: "express/public",
  nuxt: "nuxt/public",
  go: "go/static",
  django: "django/src/checkout/static/checkout",
  fastapi: "fastapi/public/static",
  rails: "rails/public",
  laravel: "laravel/public",
  "spring-boot": "spring-boot/src/main/resources/static",
  nestjs: "nestjs/public",
  redwoodsdk: "redwoodsdk/public",
  astro: "astro/public",
};

const sharedStyleDestinations = [
  "nextjs/app/styles.css",
  "express/public/styles.css",
  "nuxt/assets/styles.css",
  "go/static/styles.css",
  "django/src/checkout/static/checkout/styles.css",
  "rails/public/styles.css",
  "laravel/public/styles.css",
  "spring-boot/src/main/resources/static/styles.css",
];

const storyAssets = {
  "kora-dawn-brew.jpg": ["nextjs/public", "nuxt/public", "rails/public", "laravel/public"],
  "kora-maker-story.jpg": ["nextjs/public", "nuxt/public", "rails/public", "laravel/public"],
  "accra-afterglow.jpg": ["express/public", "django/src/checkout/static/checkout", "fastapi/public/static"],
  "afterglow-crowd.jpg": ["express/public", "django/src/checkout/static/checkout", "fastapi/public/static"],
  "ledgerline-studio.jpg": ["go/static", "spring-boot/src/main/resources/static"],
  "ledgerline-materials.jpg": ["go/static", "spring-boot/src/main/resources/static"],
  "openfield-garden.jpg": ["nestjs/public", "redwoodsdk/public", "astro/public"],
  "openfield-impact.jpg": ["nestjs/public", "redwoodsdk/public", "astro/public"],
};

await build({
  entryPoints: [join(root, "assets/inttegro-loader.entry.js")],
  bundle: true,
  format: "esm",
  outfile: join(root, "assets/inttegro-loader.js"),
  platform: "browser",
  minify: true,
  sourcemap: false,
  target: ["es2022"],
});

for (const directory of Object.values(destinations)) {
  const destination = join(root, directory);
  await mkdir(destination, { recursive: true });
  await Promise.all(
    [
      "checkout-presentations.css",
      "checkout-presentations.js",
      "demo-ui.js",
      "favicon.svg",
      "inttegro-loader.js",
    ].map((asset) =>
      copyFile(join(root, "assets", asset), join(destination, asset)),
    ),
  );
}

for (const relativePath of sharedStyleDestinations) {
  const destination = join(root, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, "assets/demo-ui.css"), destination);
}

const sharedStyles = await readFile(join(root, "assets/demo-ui.css"), "utf8");
const angularModalStyles = await readFile(
  join(root, "assets/adapters/angular-checkout-modal.css"),
  "utf8",
);
await writeFile(
  join(root, "fastapi/public/static/styles.css"),
  `${sharedStyles.trimEnd()}\n\n${angularModalStyles.trim()}\n`,
);

for (const [asset, directories] of Object.entries(storyAssets)) {
  await Promise.all(
    directories.map(async (directory) => {
      const destination = join(root, directory);
      await mkdir(destination, { recursive: true });
      await copyFile(join(root, "assets", asset), join(destination, asset));
    }),
  );
}

console.log(
  `Built the audited Inttegro browser loader and synchronized ${Object.keys(destinations).length} server demos, shared story styles, and media.`,
);
