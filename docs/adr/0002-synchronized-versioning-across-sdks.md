# 2. Synchronized Versioning Across SDKs

Date: 2026-04-24

## Status

Accepted

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
