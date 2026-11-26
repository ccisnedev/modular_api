# 2. Synchronized Versioning Across SDKs

Date: 2026-04-24

## Status

Accepted — **corrected 2026-11-11** (see the Erratum section). To be superseded by
[ADR-0006](0006-per-project-versioning-across-the-three-sdks.md), which keeps the decision below — the
three SDKs of one package share a version — and replaces how it is carried out. Until ADR-0006 is
accepted, the decision below stays in force; the 15-package extension never was a decision.

## Context

modular_api is published as three SDKs: Dart (pub.dev), TypeScript (npm), and Python (PyPI). On 2026-03-30, version 0.4.5 of the TypeScript package was published to npm with a stale `dist/` directory — the build artifacts did not include `Field.object()` or body-parser error handler changes that were already committed and documented in the CHANGELOG. Dart and Python 0.4.5 were published correctly because their ecosystems publish source code directly (pub.dev publishes `.dart` files; PyPI publishes via `python -m build` which always rebuilds).

Root cause analysis:

1. `dist/` is in `.gitignore` — compiled output is not version-controlled.
2. The publish was manual (`npm publish`), with no script enforcing a fresh build.
3. `package.json` was edited to `0.4.5` in the working directory, but `npm run build` was not re-executed — the stale `dist/` from 0.4.4 was published.

npm does not allow re-publishing the same version number. To ship the correct build, a new version (0.4.6) is required for TypeScript. This raises the question: should the other two SDKs also bump to 0.4.6?

## Decision

We adopt **synchronized versioning**: all three SDKs always share the same version number. When a release only has functional changes in a subset of SDKs, the others receive a **version bump for parity** with a minimal changelog entry.

Additionally, the TypeScript `package.json` will include a `prepublishOnly` script that runs `npm run build` automatically before `npm publish`, making it impossible to publish stale build artifacts.

## Consequences

- **Every release bumps all three SDKs** — even if one or two have no functional changes. The changelog for those SDKs notes "version bump for cross-SDK parity."
- **Consumers can assume version alignment** — `0.4.6` Dart = `0.4.6` TS = `0.4.6` Python in terms of feature completeness.
- **`prepublishOnly` safeguard** — TypeScript cannot be published without a fresh build. Dart and Python don't need this (pub.dev publishes source; `publish.ps1` already rebuilds).
- **Minor changelog noise** — parity bumps add entries with no functional content. This is an accepted trade-off for version consistency.
- **Release process** — all three publishes happen in the same session; no SDK is left behind.

## Erratum (2026-11-11)

The section below was appended for `0.5.0`. Its first sentence said "Synchronized versioning now
covers 15 packages", and its release mechanism validated all fifteen manifests against one tag. That
stretched the decision above — **the three SDKs of one package** share a version — into "all fifteen
packages share one", with no argument of its own. It was a misreading, not a decision, and it is
corrected here instead of being kept as if it had been one. ADR-0006 lays out what it cost: releases
with no content (twelve of them in `0.7.1`, for a TypeScript-only fix), a convention that broke at
`0.6.1`, and constraints between packages it never checked.

What the decision covers is each package across its three languages. The table below lists the
packages of each language; it does not make them one versioning unit. `release.yml` still enforces the
misreading and is retired by ADR-0006.

## Package set (as of 0.5.0)

Five packages, each published in three ecosystems:

| Ecosystem | Packages |
| --- | --- |
| TypeScript (npm) | `@macss/modular-api`, `@macss/modular-api-rest-client`, `@macss/modular-api-graphql-client`, `@macss/modular-api-sqlserver`, `@macss/modular-api-postgres` |
| Dart (pub.dev) | `modular_api`, `modular_api_rest_client`, `modular_api_graphql_client`, `modular_api_sqlserver`, `modular_api_postgres` |
| Python (PyPI) | `macss-modular-api`, `macss-modular-api-rest-client`, `macss-modular-api-graphql-client`, `macss-modular-api-sqlserver`, `macss-modular-api-postgres` |

`docs-ui` follows its own independent 0.1.x line.

**Release mechanism, as built (the misreading in practice):** a single tag `v<version>` triggers `.github/workflows/release.yml`, which validates that all 15 manifests match the tag version and publishes everything in dependency-safe waves. Per-package multi-tag pushes are prohibited: GitHub suppresses push events when more than 3 tags are pushed at once, so they silently publish nothing. The per-package `publish-*.yml` workflows remain `workflow_dispatch`-only for individual republication.
