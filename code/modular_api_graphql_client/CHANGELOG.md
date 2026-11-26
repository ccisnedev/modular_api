# Changelog

## [0.7.2](https://github.com/ccisnedev/modular_api/compare/modular_api_graphql_client-v0.7.1...modular_api_graphql_client-v0.7.2) (2026-11-26)


### Miscellaneous Chores

* **release:** release the leaf projects as 0.7.2 ([#51](https://github.com/ccisnedev/modular_api/issues/51)) ([eb3b293](https://github.com/ccisnedev/modular_api/commit/eb3b293f2c5989fc83caae796e39eb0ed624f693))

## [0.7.1 and earlier] Before release-please

Until 0.7.1 each language kept its own changelog. They are reproduced below unchanged, one
subsection per language, with their headings moved down two levels. From 0.7.2 on,
this file is written by release-please and covers the three languages at once
([ADR-0006](https://github.com/ccisnedev/modular_api/blob/main/docs/adr/0006-per-project-versioning-across-the-three-sdks.md)).

### Dart (pub.dev)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- raise the `modular_api_rest_client` constraint to `^0.7.0`: `^0.6.0` resolves to `>=0.6.0 <0.7.0`, so this package would have shipped at 0.7.0 requiring a 0.6.x modular_api_rest_client — a version conflict for anyone using both

#### 0.6.0

- version bump for cross-SDK parity (ADR-0002); no functional changes
- update `modular_api_rest_client` dependency to `^0.6.0`

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes
- update `modular_api_rest_client` dependency to `^0.5.0`

#### 0.4.7

- bootstrap `modular_api_graphql_client` for Dart
- add the first GraphQL client slice with query-only requests and normalized failures
- add tests for happy path, GraphQL errors, auth injection, timeout, transport failures, and mutation rejection

### TypeScript (npm)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- raise the `@macss/modular-api-rest-client` constraint to `^0.7.0`: `^0.6.0` resolves to `>=0.6.0 <0.7.0`, so this package would have shipped at 0.7.0 requiring a 0.6.x @macss/modular-api-rest-client — a version conflict for anyone using both

#### 0.6.0

- version bump for cross-SDK parity (ADR-0002); no functional changes
- update `@macss/modular-api-rest-client` dependency to `^0.6.0`

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes
- update `@macss/modular-api-rest-client` dependency to `^0.5.0`

#### 0.4.7

- bootstrap `@macss/modular-api-graphql-client`
- add the first GraphQL client slice with query-only requests and normalized failures
- add tests for happy path, GraphQL errors, auth injection, timeout, transport failures, and mutation rejection

### Python (PyPI)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.6.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.4.7

- bootstrap `macss-modular-api-graphql-client`
- add the first GraphQL client slice with query-only requests and normalized failures
- add tests for happy path, GraphQL errors, auth injection, timeout, transport failures, and mutation rejection
