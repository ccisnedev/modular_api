# modular_api — Ecosystem Roadmap

> *"The spec is the source of truth. The code is its consequence."*

This roadmap covers the development of the `modular_api` ecosystem: core SDKs, plugin architecture, CQRS via GraphQL, and production readiness. Each version is a coherent, shippable milestone — not a collection of features. Spec Driven Development (pragma_spec) and MCP integration (pragma_mcp) are documented as v2.0+ vision.

---

## Versioning Philosophy

Every release must be **complete within itself**. A version is not a list of features — it is a state of the system that makes sense on its own. No version exists merely to set up the next one.

Versioning follows semantic versioning strictly:
- **Major** — breaking changes to the plugin interface or module contract
- **Minor** — new capabilities, new plugins, new SDKs
- **Patch** — bug fixes, documentation, performance

---

## Current State — v0.4.5

| Package | Version | Registry | Status |
|---|---|---|---|
| `modular_api` (Dart) | 0.4.5 | [pub.dev](https://pub.dev/packages/modular_api) | ✅ Published |
| `@macss/modular-api` (TS) | 0.4.5 | [npm](https://www.npmjs.com/package/@macss/modular-api) | ✅ Published |
| `macss-modular-api` (Python) | 0.4.5 | [PyPI](https://pypi.org/project/macss-modular-api/) | ✅ Published |

---

## v0.4.1 — Released

> *Core SDKs complete in three languages. Zero external metric dependencies.*

### Achievements

- [x] **Python SDK** — full implementation published to PyPI as `macss-modular-api`
- [x] **Native metrics** — `prom-client` removed from TypeScript; all three SDKs implement Counter, Gauge, and Histogram natively with Prometheus text exposition format
- [x] **Monorepo consolidation** — Dart, TypeScript, and Python SDKs unified under a single repository (`macss-dev/modular_api`)
- [x] **Cross-language parity** — 188 integration tests validating structural identity across all three SDKs
- [x] **Built-in endpoints** in all three SDKs, zero configuration:
  - `GET /docs` — Interactive Swagger UI from `openapi.json`
  - `GET /health` — IETF Health Check Response Format
  - `GET /metrics` — Prometheus text exposition format (opt-in)
  - `GET /openapi.json` — OpenAPI 3.0 specification
  - `GET /openapi.yaml` — OpenAPI 3.0 specification (YAML)
- [x] **Monorepo structure finalized** — `code/dart/` · `code/ts/` · `code/py/` · `docs/` · `code/tests/`
- [x] **CHANGELOG discipline** established across all three SDKs

---

## v0.4.2 — Released

> *Documentation generation must be automatic.*

### Auto-Generated Documentation

- [x] Remove the need for `ToSchema()` — OpenAPI documentation generated automatically from Use Case DTOs (Input/Output) without requiring manual schema definitions
- [x] All three SDKs (Dart, TypeScript, Python) must generate identical OpenAPI output from equivalent DTO definitions
- [x] Dart: `SchemaField` metadata via `schemaFields` getter + `buildSchema()` utility
- [x] TypeScript: Stage 3 `@Field` decorators + `getFieldMetadata()` + `buildSchemaFromMetadata()`
- [x] Python: Pydantic `BaseModel` + `_normalize_schema()` (Draft 2020-12 → OpenAPI 3.0.3)
- [x] Cross-language schema conformance tests against shared JSON fixtures

---

## v0.4.3 — Released

> *Use cases return their output. No mutable state.*

### Execute Returns Output (BREAKING)

- [x] `execute()` returns `Future<O>` / `Promise<O>` / `O` — no longer void; the handler reads the returned Output directly
- [x] Removed `output` field from `UseCase` — no mutable state
- [x] Removed `toJson()` from `UseCase` — the handler calls `output.toJson()` on the returned value
- [x] `inputExample` / `outputExample` (Dart) and `inputClass` / `outputClass` (TS) now required in `ModuleBuilder.usecase()` — OpenAPI schema extraction uses them directly
- [x] Removed Strategy 2 fallback in OpenAPI schema extraction

---

## v0.4.4 — Released

> *One Swagger UI to rule them all.*

### Docs UI Extraction

- [x] Swagger UI replaced with `@macss/docs-ui` — the ~200-line inline HTML/CSS/JS reduced to a ~15-line bootloader that loads `@macss/docs-ui@0.1` from jsdelivr CDN
- [x] Dark mode delegated to `docs-ui` package — single source of truth across all three SDKs
- [x] Published `docs-ui/` as standalone package

---

## v0.4.5 — Released

> *The API must know where it lives. Every error must be traceable.*

### OpenAPI `servers` Configuration

- [x] Add `servers` parameter to `ModularApi` constructor in all three SDKs (Dart, TypeScript, Python)
- [x] When `servers` is provided, propagate it to OpenAPI spec generation — the `servers` field in `openapi.json` / `openapi.yaml` reflects the user-defined list
- [x] When `servers` is omitted, `serve()` auto-generates `[{url: "http://localhost:{port}", description: "Local"}]` as the default (current behavior, no breaking change)
- [x] Swagger UI `Try it out` dropdown populates from the user-defined servers, enabling requests to production, LAN, or any configured host

### CORS Middleware Alignment (Dart)

- [x] Replace `exampleCorsMiddleware()` in Dart with a configurable `corsMiddleware()` matching the interface of TypeScript (`cors()`) and Python (`cors_middleware()`)
- [x] Configurable parameters: `origin` (string or list), `methods`, `allowedHeaders`
- [x] Defaults: `origin: '*'`, `methods: 'GET,POST,PUT,PATCH,DELETE,OPTIONS'`, `allowedHeaders: 'Content-Type,Authorization'`
- [x] Preflight `OPTIONS` handled with 204 No Content
- [x] Update Dart barrel export: remove `exampleCorsMiddleware`, export `corsMiddleware`

### Scoped Logger in Error Paths (issue #7)

- [x] TypeScript: moved `express.json()` after `loggingMiddleware` so body-parser errors carry `trace_id`; added `bodyParserErrorHandler` Express error middleware
- [x] All 3 SDKs: catch blocks in use case handlers now log via scoped `RequestScopedLogger` instead of `stderr` / `console.error` / `print`, enabling Loki correlation

### `SchemaField.object` / `Field.object` (issue #8)

- [x] Dart: `SchemaField.object()` factory + `case 'object'` in `_isJsonTypeValid` + `Map` case in `_inferOpenApiType`
- [x] TypeScript: `Field.object()` decorator + `'object'` in `FieldMeta.type` union + `case 'object'` in `isJsonTypeValid`
- [x] Python: `_normalize_schema` strips `additionalProperties` for cross-SDK parity
- [x] Shared fixture `webhook_input_schema.json` — all 3 SDKs produce identical schemas for object fields

---

## v0.5.0 — Plugin Architecture + CQRS

> *The ecosystem cannot grow until the plugin contract is public. Queries and commands flow through different paths.*

### Plugin Interface — `modular_api_plugins`

The package that enables anyone to build a first-class plugin.

- [ ] Define and publish the **`ModularApiPlugin`** contract as a standalone package
  - Lifecycle hooks: `onRegister`, `onModulesLoaded`, `onMount`, `onOpenApiGenerated`, `onShutdown`
  - `PluginContext` — read-only access to registry, basePath, title, version, logger, metrics
  - `MacssModule` and `OpenApiSpec` type definitions
- [ ] `.plugin()` method on `ModularApi` — the public API for plugin registration
- [ ] Plugin registration validated at startup: duplicate names, duplicate endpoints → startup error with precise message
- [ ] Publish to all three registries:
  - pub.dev: `modular_api_plugins`
  - npm: `@macss/modular-api-plugins`
  - PyPI: `macss-modular-api-plugins`
- [ ] Full documentation: what each hook receives, when it is called, what it can do
- [ ] Reference implementation: a minimal `HelloWorldPlugin` that demonstrates every hook

### Built-in Endpoints as Plugins (Dart + TypeScript + Python)

Built-in capabilities refactored as first-class plugins — they are plugins, not special cases:

- [ ] **DocsPlugin** — `/docs` endpoint refactored to use the plugin interface
- [ ] **HealthPlugin** — `/health` endpoint refactored; `.addHealthCheck()` migrates to plugin configuration
- [ ] **MetricsPlugin** — `/metrics` endpoint refactored (Counter, Gauge, Histogram already native)
- [ ] **OpenApiPlugin** — `/openapi.json` and `/openapi.yaml` refactored to use the plugin interface
- [ ] `modular_api` core updated to depend on `modular_api_plugins` — core eats its own dog food

### GraphQL Plugin — `modular_api_graphql`

Auto-generated **read-only** GraphQL layer from module DTOs:

- [ ] GraphQL handles **Queries only** (SELECT) — the frontend requests exactly the data it needs, no over-fetching
- [ ] **Commands** (mutations) remain as REST endpoints — each use case is an explicit, validated command
- [ ] `operationId` values become GraphQL resolver names for query fields
- [ ] GraphQL Playground at `/graphql/playground`
- [ ] Publish as separate package to all three registries:
  - pub.dev: `modular_api_graphql`
  - npm: `@macss/modular-api-graphql`
  - PyPI: `macss-modular-api-graphql`

### Milestone: Native CQRS

At the end of v0.5.0, `modular_api` becomes a **native CQRS (Command Query Responsibility Segregation) system**:

- **Queries** — GraphQL. The frontend requests exactly the fields it needs. No over-fetching, no under-fetching. GraphQL is used exclusively for reads (SELECT).
- **Commands** — REST endpoints. Each module use case is an explicit command with validated Input, typed Output, and a single responsibility. POST/PUT/PATCH/DELETE remain in the module's REST API.

This separation is not optional — it is structural. Queries and commands flow through different paths, different protocols, and different validation rules. The GraphQL plugin reads from the same data the commands produce, but never mutates it.

**Exit criterion:** A developer outside the MACSS team can build, test, and publish a working `modular_api` plugin using only the public `modular_api_plugins` package and its documentation. The built-in endpoints (docs, health, metrics, OpenAPI) and the GraphQL plugin serve as reference implementations — proving the plugin interface is powerful enough to express even the framework's own capabilities.

---

## v0.6.0 — Foundation Hardening

> *Before scaling the ecosystem, the core must be production-grade.*

- [ ] Formalize and document the **Module Interface** contract — the exact API any module must implement
- [ ] Migrate to **OpenAPI 3.1** maintaining backward compatibility with 3.0 consumers where possible
- [ ] Validate that all three SDKs produce structurally identical OpenAPI output for the same module definition
- [ ] Document the internal architecture: how modules are registered, how endpoints are composed, how OpenAPI is generated
- [ ] CI/CD pipeline: test on every PR, publish on tag for each SDK independently
- [ ] Contribution guide and code style per language

**Exit criterion:** A developer with no prior MACSS knowledge can clone the repo, read the README, implement a module, register it, run the server, and hit `/docs`, `/health`, and `/metrics` — in Dart, TypeScript, and Python — without asking a question.

---

## v0.7.0 — Reference Implementation

> *The methodology is only credible if it has been applied.*

### `macss-imc` — The Reference Module

The IMC (Body Mass Index) module built entirely under the MACSS methodology. This is the canonical example of how the full lifecycle works.

**Etapa 1 — Database**
- [ ] Derive schema from domain: tables, views
- [ ] SQL-as-code: all schema via DDL scripts, no ORMs
- [ ] Every table traces to at least one use case

**Etapa 2 — Use Cases**
- [ ] Derive endpoints from database schema and business rules
- [ ] Each endpoint implements exactly one business operation
- [ ] `operationId` names defined before implementation — honored by code

**TDD — Phase 1: Repositories**
- [ ] Tests written against ephemeral PostgreSQL (Docker container)
- [ ] Zero mocks — if the query is wrong, the test fails
- [ ] 100% pass before Phase 2 begins

**TDD — Phase 2: Use Cases**
- [ ] Tests use real repositories against ephemeral DB
- [ ] Business logic tested in isolation from HTTP layer
- [ ] 100% pass before Phase 3 begins

**TDD — Phase 3: Flows**
- [ ] End-to-end HTTP tests: request → response
- [ ] GraphQL query tests against the same use cases
- [ ] 100% pass = module is complete

**Deliverables**
- [ ] `macss-imc` published as open source reference implementation
- [ ] Full walkthrough article on `blog.macss.dev` *(planned)*

---

## v1.0.0 — Production Ready

> *v1.0.0 is the first version that can be used in production without reservation.*

### `modular_api_oauth2` Plugin (Dart + TypeScript + Python)

- [ ] JWT bearer token flow: login, refresh, logout
- [ ] Integration with `AuthModule` for scope resolution
- [ ] Configurable token lifetime, secret, algorithm
- [ ] Publish to all three registries:
  - pub.dev: `modular_api_oauth2`
  - npm: `@macss/modular-api-oauth2`
  - PyPI: `macss-modular-api-oauth2`

### Stability Milestone

- [ ] All packages at stable versions (no pre-release)
- [ ] All packages documented with full API reference
- [ ] All packages with >80% test coverage against ephemeral infrastructure
- [ ] `macss-imc` running in production as reference deployment
- [ ] `macss.dev` documentation site live with full ecosystem overview *(planned)*

**Exit criterion:** A team outside MACSS can build a production-grade API — with authentication, CQRS via GraphQL + REST, and the plugin system — using only public MACSS packages and public documentation.

---

## Horizon — v2.0+ (En evaluación)

Features whose timing depends on ecosystem maturity and community demand. These are documented as vision, not committed scope.

### Spec Driven Development — `pragma_spec`

> *The specification governs the code. Not the other way around.*

- [ ] Define the full `pragma_spec.yaml` schema (the Momento Zero file) — states, transitions, tools, resources, prompts
- [ ] Build-time validation: every `operationId` in `pragma_spec.yaml` must exist in `openapi.json`
- [ ] Module composition: merge all `pragma_spec.yaml` files into a single `pragma.yaml`
- [ ] `GET /pragma.yaml` endpoint — live, always reflects current state
- [ ] Publish to all three registries (pub.dev, npm, PyPI)
- [ ] Publish `pragma_spec.yaml` format as a versioned open specification at `pragmaspec.dev` *(planned)*

### MCP Integration — `pragma_mcp`

> *The bridge between precision engineering and AI agents.*

- [ ] `PragmaMCP` — reads `GET /pragma.yaml` from a URI, produces a fully compliant MCP server
- [ ] Support MCP transports: `stdio` (CLI agents), `sse` (HTTP agents)
- [ ] Map `pragma.yaml` primitives to MCP primitives (tools, resources, prompts)
- [ ] Publish to all three registries (pub.dev, npm, PyPI)

### Community & Tooling

- [ ] Custom API documentation UI — inspired by Scalar's design
- [ ] VSCode extension: `pragma_spec.yaml` schema validation and autocompletion
- [ ] CLI tool: `macss new module`, `macss validate`, `macss diff pragma`
- [ ] Plugin registry page on `macss.dev` *(planned)*
- [ ] Plugin starter template repository for each language

### Other Planned Packages

| Feature | Description |
|---|---|
| `modular_api_postman` | Postman collection generator plugin — auto-generates `.postman_collection.json` from OpenAPI spec |
| `modular_api_webhooks` | Event subscription layer over module transitions |
| `modular_api_audit` | Immutable audit log middleware for all mutations |
| `modular_api_cache` | Declarative caching layer for GET endpoints |
| `modular_api_i18n` | Internationalization for error messages and API docs |
| `pragma_mcp` multi-server | Single `pragma_mcp` consuming multiple `/pragma.yaml` endpoints |
| `pragma_spec` IDE server | Language Server Protocol for `pragma_spec.yaml` |
| Academic publication | MACSS methodology as a formal software engineering paper |

---

## Summary Timeline

```
v0.4.1  ████████████████████████████  Core SDKs complete (Dart + TS + Python)       ✅
v0.4.2  ████████████████████████████  Auto-generated documentation (SchemaField)    ✅
v0.4.3  ████████████████████████████  execute() returns Output (BREAKING)           ✅
v0.4.4  ████████████████████████████  Swagger UI → @macss/docs-ui                   ✅
v0.4.5  ████████████████████████████  servers + CORS + trace_id + Field.object       ✅
v0.5.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Plugin architecture + GraphQL = CQRS
v0.6.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Foundation hardening (OpenAPI 3.1 + CI/CD)
v0.7.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Reference implementation (macss-imc)
v1.0.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Production ready (oauth2 + stability)
v2.0+   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  pragma_spec + pragma_mcp + community tooling
```

---

## The Invariants

Regardless of version, these never change:

1. **The spec governs the code.** `pragma_spec.yaml` is written before implementation. The build fails if the code does not honor it.
2. **No mocks.** Tests run against ephemeral or development infrastructure. A test that passes against a mock is not a test.
3. **Modules do not cross boundaries.** A workflow that transcends modules is a design error, not a feature.
4. **Plugins never modify the core.** The core plugin interface is the only contract. If a plugin needs to change the core, the design is wrong.
5. **The methodology is the source of truth.** The SDKs are its expression. If a SDK diverges from the methodology, the SDK is wrong.

---

*modular_api Ecosystem Roadmap*
*macss-dev · macss.dev (planned)*