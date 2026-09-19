# Releasing Inttegro demos

Inttegro demos are released as one coherent suite and also receive immutable
per-demo tag aliases. The suite release makes the supported set easy to
discover; the aliases let Studio link to a framework-specific version without
depending on the moving `main` branch.

## Version model

Releases use Semantic Versioning:

- increment **major** when a demo's integration contract or required Inttegro
  API generation changes incompatibly;
- increment **minor** when adding a demo, supported integration path, or
  substantial backward-compatible capability; and
- increment **patch** for backward-compatible fixes, documentation corrections,
  dependency maintenance, and UI refinements.

All published demos currently release together. A suite release therefore has
one per-demo alias for every included implementation. Release 1.8.3 contains:

```text
v1.8.3
nextjs-v1.8.3
express-v1.8.3
nuxt-v1.8.3
go-v1.8.3
django-v1.8.3
fastapi-v1.8.3
rails-v1.8.3
laravel-v1.8.3
spring-boot-v1.8.3
ios-swiftui-v1.8.3
android-compose-v1.8.3
flutter-v1.8.3
react-native-expo-v1.8.3
nestjs-v1.8.3
redwoodsdk-v1.8.3
astro-v1.8.3
```

Every tag in a suite release points to the exact same commit. Per-demo aliases
are names, not partial-repository snapshots: cloning any tag still produces the
complete repository. A future independently shipped demo may advance its own
alias, but must record that mapping in a new release manifest.

`manifest.json.currentRelease`, `deployments.json`, the generated catalogue,
and Studio always describe the latest published suite. Work intended for the
next suite may be recorded under `manifest.json.nextRelease`, but that field is
planning metadata only. Do not advance the public release fields or enable a
provider button until its signed tags and immutable deployment refs exist.

## Stable Studio permalinks

Studio must link to a tag, never to `main`. Construct a link with the release
manifest's `permalinkTemplate`:

```text
https://github.com/inttegro/inttegro-demos/blob/{tag}/{file}#L{start}-L{end}
```

For example, a Laravel page for version 1.0.0 can link to a section of
`laravel/app/Services/CheckoutService.php` through the
`laravel-v1.0.0` tag. Studio should obtain the tag and allowed entry-point paths
from [`releases/v1.0.0.json`](./releases/v1.0.0.json), then add line anchors for
the section it presents.

Line anchors are stable within a tag but may move in later versions. Store the
demo ID, semantic version, repository-relative path, start line, and end line as
the source reference; derive the public URL from those fields. This makes links
auditable and lets a documentation build validate that the requested file is an
entry point for that demo.

## Immutability and corrections

Published release tags are immutable. Never force-update, delete, or reuse one.
If code or commentary needs correction, create the next patch release and
update Studio to the new version deliberately. Old Studio pages and external
references must continue resolving to the code they originally explained.

Release tags are annotated and signed. The GitHub Release is attached only to
the canonical suite tag; per-demo tags remain lightweight from a GitHub product
perspective but are also signed annotated Git objects.

## Release procedure

1. Finish and verify all release changes on `main`.
2. Update `manifest.json`, add `releases/vX.Y.Z.json`, and add matching release
   notes at `releases/vX.Y.Z.md`.
3. Run `node scripts/check.mjs` and every available framework check.
4. Create a signed release commit using the repository's normal
   `scope: change` message style.
5. Create the signed annotated suite tag and every per-demo alias listed in the
   release manifest, all at the release commit.
6. Push `main` first, then push the exact tags explicitly.
7. Compare every remote tag's peeled commit with the local release commit.
8. Publish one GitHub Release on the suite tag using the tracked Markdown notes.
9. Run `node scripts/prepare-deploy-refs.mjs vX.Y.Z`, inspect each generated
   signed branch, and push every exact `deploy-{demo}-vX.Y.Z` ref explicitly.
   Protect published deployment refs from force-pushes and deletion.
10. Exercise every public provider button from a clean account or project and
   update deployment status only from recorded evidence.
11. Verify a representative GitHub `blob/{tag}/{path}#Lx-Ly` URL before updating
   Studio.

The repository contract check validates release metadata, demo coverage, tag
names, source paths, permalinks, provider manifests, and deployment refs. Remote
tag signatures, provider smoke tests, template publication, and GitHub Release
publication are deployment evidence and must be checked separately.
