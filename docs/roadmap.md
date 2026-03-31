# modular_api — Ecosystem Roadmap

> *"The spec is the source of truth. The code is its consequence."*

This roadmap covers the full development of the `modular_api` ecosystem: core SDKs, plugin architecture, Spec Driven Development tooling, MCP integration, and community infrastructure. Each version is a coherent, shippable milestone — not a collection of features.

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

## Phase 0 — Foundation Hardening `v0.5.0`

> *Before building the ecosystem, the core must be production-grade.*

### Core SDKs (Dart + TypeScript + Python)

- [ ] Formalize and document the **Module Interface** contract — the exact API any module must implement
- [ ] Formalize and document the **Plugin Interface** contract — `onModulesLoaded`, `onOpenApiGenerated`, lifecycle hooks
- [ ] Migrate to **OpenAPI 3.1** maintaining backward compatibility with 3.0 consumers where possible
- [ ] Validate that all three SDKs produce structurally identical OpenAPI output for the same module definition
- [ ] Add integration tests for all three SDKs against a reference module (`imc`)
- [ ] Document the internal architecture: how modules are registered, how endpoints are composed, how OpenAPI is generated

### Repository

- [ ] CI/CD pipeline: test on every PR, publish on tag for each SDK independently
- [ ] Contribution guide and code style per language

**Exit criterion:** A developer with no prior MACSS knowledge can clone the repo, read the README, implement a module, register it, run the server, and hit `/docs`, `/health`, and `/metrics` — in Dart, TypeScript, and Python — without asking a question.

---

## Phase 1 — Plugin Infrastructure `v0.6.0`

> *The ecosystem cannot grow until the plugin contract is public.*

### `modular_api_plugins` — Base Package

The package that enables anyone to build a first-class plugin.

- [ ] Define and publish the **Plugin Interface** as a standalone package (not bundled with core)
  - `ModularApiPlugin` abstract class / interface
  - `MacssModule` type definitions
  - `OpenApiSpec` type definitions
  - Lifecycle hook signatures
- [ ] Publish to all three registries:
  - pub.dev: `modular_api_plugins`
  - npm: `@macss/modular-api-plugins`
  - PyPI: `macss-modular-api-plugins`
- [ ] Full documentation: what each hook receives, when it is called, what it can do
- [ ] Reference implementation: a minimal `HelloWorldPlugin` that demonstrates every hook
- [ ] Plugin authoring guide published on `macss.dev` *(planned)*

### Internal Plugins (Dart + TypeScript + Python)

Built-in capabilities refactored as first-class plugins using the public plugin interface — they are plugins, not special cases:

- [ ] **Metrics plugin** — `/metrics` endpoint refactored to use the plugin interface (Counter, Gauge, Histogram already implemented natively)
- [ ] **GraphQL plugin** — auto-generated **read-only** GraphQL layer from module DTOs:
  - GraphQL handles **Queries only** (SELECT) — the frontend requests exactly the data it needs, no over-fetching
  - **Commands** (mutations) remain as REST endpoints in the module — each use case is an explicit, validated command
  - `operationId` values become GraphQL resolver names for query fields
  - GraphQL Playground at `/graphql/playground`
  - Publish as separate package to all three registries:
    - pub.dev: `modular_api_graphql`
    - npm: `@macss/modular-api-graphql`
    - PyPI: `macss-modular-api-graphql`
- [ ] `/docs` and `/health` also refactored to use the plugin interface

### Core Integration

- [ ] `modular_api` (Dart + TS + Python) updated to depend on `modular_api_plugins` for its own plugin interface — core eats its own dog food
- [ ] Plugin registration validated at startup: duplicate names, duplicate endpoints → startup error with precise message

**Exit criterion:** A developer outside the MACSS team can build, test, and publish a working `modular_api` plugin using only the public `modular_api_plugins` package and its documentation. The internal GraphQL and Metrics plugins serve as reference implementations.

### Milestone: Native CQRS

At the end of Phase 1, `modular_api` becomes a **native CQRS system**:

- **Queries** — GraphQL. The frontend requests exactly the fields it needs. No over-fetching, no under-fetching. GraphQL is used exclusively for reads (SELECT).
- **Commands** — REST endpoints. Each module use case is an explicit command with validated Input, typed Output, and a single responsibility. POST/PUT/PATCH/DELETE remain in the module's REST API.

This separation is not optional — it is structural. Queries and commands flow through different paths, different protocols, and different validation rules. The GraphQL plugin reads from the same data the commands produce, but never mutates it.

---

## Phase 2 — Spec Driven Development `v0.7.0`

> *The specification governs the code. Not the other way around.*

### `pragma_spec` Plugin (Dart + TypeScript + Python)

- [ ] Define the full `pragma_spec.yaml` schema (the Momento Zero file)
  - `states` — FSM states
  - `transitions` — FSM transition function
  - `server` — name, version, instructions
  - `tools` — workflows with risk levels and confirmation flags
  - `resources` — readable context with operationId references
  - `prompts` — reusable conversation templates
- [ ] Implement **build-time validation**:
  - Every `operationId` referenced in `tools.workflow` must exist in the generated `openapi.json`/`openapi.yaml`
  - Every `operationId` referenced in `resources` must exist in the generated `openapi.json`/`openapi.yaml`
  - Workflows must not cross module boundaries
  - Duplicate tool names across modules → build error
  - Multiple security blocks → build error
  - All errors: precise, actionable, with suggestions
- [ ] Implement **module composition**: merge all `pragma_spec.yaml` files across modules into a single `pragma.yaml`
- [ ] Implement **`auth/` special handling**: `security` block injected into composed `pragma.yaml` and into `server.instructions`
- [ ] Register `GET /pragma.yaml` endpoint — live, always reflects current state
- [ ] Publish to all three registries:
  - pub.dev: `pragma_spec`
  - npm: `@macss/pragma-spec`
  - PyPI: `macss-pragma-spec`
- [ ] Full documentation: `pragma_spec.yaml` field reference, validation error catalog, lifecycle

### `pragma_spec.yaml` Format Specification

- [ ] Publish `pragma_spec.yaml` format as a versioned open specification at `pragmaspec.dev` *(planned)*
- [ ] JSON Schema for `pragma_spec.yaml` — enables IDE validation and autocompletion
- [ ] VSCode extension: YAML schema association for `pragma_spec.yaml` files *(stretch goal)*

**Exit criterion:** A MACSS project with three modules and an `auth/` module can run `modular_api` with `PragmaSpec()` registered, serve `GET /pragma.yaml`, and have the build fail with a precise error if any `operationId` in any `pragma_spec.yaml` does not match the implemented code.

---

## Phase 3 — MCP Integration `v0.8.0`

> *The bridge between precision engineering and AI agents.*

### `pragma_mcp` (Dart + TypeScript + Python)

- [ ] Implement `PragmaMCP` — reads `GET /pragma.yaml` from a URI, produces a fully compliant MCP server
- [ ] Support MCP transports:
  - `McpTransport.stdio` — for CLI agent integration
  - `McpTransport.sse` — for HTTP-based agent integration
- [ ] Map all `pragma.yaml` primitives to MCP primitives:
  - `tools[]` → MCP Tools
  - `resources[]` → MCP Resources
  - `prompts[]` → MCP Prompts
  - `server.instructions` → MCP system prompt
- [ ] `risk: high` + `confirmation: true` → agent confirmation flow before execution
- [ ] Security context from `security` block injected into system prompt
- [ ] Publish to all three registries:
  - pub.dev: `pragma_mcp`
  - npm: `@macss/pragma-mcp`
  - PyPI: `macss-pragma-mcp`
- [ ] Full documentation: transport options, MCP primitive mapping, security context

### Integration Test

- [ ] End-to-end test: `macss-imc` module → `pragma_spec` plugin → `/pragma.yaml` → `pragma_mcp` → working MCP server
- [ ] AI agent (Claude via MCP) successfully executes all tools, reads all resources, and uses all prompts defined in `pragma_spec.yaml`

**Exit criterion:**

```dart
PragmaMCP(
  pragma: "https://imc-api.com/pragma.yaml",
  transport: McpTransport.stdio,
).run();
```

One URI. One call. Working MCP server. AI agent operates correctly against a live MACSS API.

---

## Phase 4 — Reference Implementation `v0.9.0`

> *The methodology is only credible if it has been applied.*

### `macss-imc` — The Reference Module

The IMC (Body Mass Index) module built entirely under the MACSS SDD methodology. This is the canonical example of how the full lifecycle works — from FSM to MCP.

**Etapa 1 — FSM**
- [ ] Define user stories for IMC
- [ ] Translate to FSM: states, events, transition function
- [ ] FSM encoded in `pragma_spec.yaml` under `states` and `transitions`

**Etapa 2 — Database**
- [ ] Derive schema from FSM: tables, views, stored procedures
- [ ] SQL-as-code: all schema changes via migration files, no ORMs
- [ ] Insert-only pattern for measurement history — no UPDATE on historical data
- [ ] Every table traces to at least one FSM state or transition

**Etapa 3 — Use Cases**
- [ ] Derive endpoints from database schema and FSM transitions
- [ ] Each endpoint implements exactly one FSM transition
- [ ] `operationId` names defined before implementation — honored by code

**Momento Zero**
- [ ] Complete `pragma_spec.yaml` — tools, resources, prompts, states, transitions
- [ ] This file is frozen before any code is written

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
- [ ] `pragma_spec` plugin validates `pragma_spec.yaml` against implemented code at test startup
- [ ] 100% pass = module is complete

**Deliverables**
- [ ] `macss-imc` published as open source reference implementation
- [ ] Full walkthrough article on `blog.macss.dev` *(planned)*
- [ ] Video on YouTube (@macssdev): "Building an API from Momento Zero"

---

## Phase 5 — Authentication `v1.0.0`

> *v1.0.0 is the first version that can be used in production without reservation.*

### `modular_api_oauth2` Plugin (Dart + TypeScript + Python)

- [ ] JWT bearer token flow: login, refresh, logout
- [ ] Integration with `AuthModule` for scope resolution
- [ ] `pragma_spec.yaml` `security` block wired to OAuth2 plugin at runtime
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

**Exit criterion:** A team outside MACSS can build a production-grade API — with authentication, MCP integration, and Spec Driven Development — using only public MACSS packages and public documentation.

---

## Phase 6 — Community & Tooling `v1.1.0`

> *An ecosystem without community tooling is a library. With it, it becomes a platform.*

### Custom API Documentation UI

- [ ] Build a custom API documentation web interface — inspired by Scalar's design, with Swagger UI's familiarity
- [ ] Features beyond standard Swagger UI:
  - PowerShell `curl` command generation (not just bash)
  - WhatsApp-formatted API request sharing
  - Modern, responsive design
- [ ] Replaces CDN-served Swagger UI in all three SDKs
- [ ] Published as a standalone package usable outside MACSS

### Developer Experience

- [ ] VSCode extension: `pragma_spec.yaml` schema validation and autocompletion
- [ ] VSCode extension: MACSS module scaffolding command (`New MACSS Module`)
- [ ] CLI tool: `macss new module <name>` — generates module structure + empty `pragma_spec.yaml`
- [ ] CLI tool: `macss validate` — runs `pragma_spec` validation without starting the server
- [ ] CLI tool: `macss diff pragma` — shows what changed between two versions of `pragma.yaml`

### Community Infrastructure

- [ ] Plugin registry page on `macss.dev` *(planned)* — curated list of community plugins
- [ ] Plugin starter template repository for each language
- [ ] `modular_api_plugins` contribution guide with review criteria
- [ ] Badge system for community plugin quality tiers: Experimental → Stable → Certified

### Documentation

- [ ] Full methodology documentation at `macss.dev/methodology` *(planned)*
- [ ] SDD lifecycle guide: FSM → DB → Use Cases → Momento Zero → TDD
- [ ] Plugin authoring guide per language
- [ ] `pragma_spec.yaml` complete field reference at `pragmaspec.dev` *(planned)*

---

## Horizon — No Fixed Version

Features that belong in the roadmap but whose timing depends on ecosystem maturity and community demand.

| Feature | Description |
|---|---|
| `modular_api_postman` | Postman collection generator plugin — auto-generates `.postman_collection.json` from OpenAPI spec |
| `modular_api_webhooks` | Event subscription layer over module transitions |
| `modular_api_audit` | Immutable audit log middleware for all mutations |
| `modular_api_cache` | Declarative caching layer for GET endpoints |
| `modular_api_i18n` | Internationalization for error messages and API docs |
| `pragma_mcp` multi-server | Single `pragma_mcp` consuming multiple `/pragma.yaml` endpoints |
| `pragma_spec` IDE server | Language Server Protocol for `pragma_spec.yaml` |
| GAINLINE integration | `pragma_spec` plugin for GAINLINE task tracking |
| Academic publication | MACSS SDD methodology as a formal software engineering paper |

---

## Summary Timeline

```
v0.4.1  ████████████████████████████  Core SDKs complete (Dart + TS + Python)       ✅
v0.4.2  ████████████████████████████  Auto-generated documentation (SchemaField)    ✅
v0.4.3  ████████████████████████████  execute() returns Output (BREAKING)           ✅
v0.4.4  ████████████████████████████  Swagger UI → @macss/docs-ui                   ✅
v0.4.5  ████████████████████████████  servers + CORS + trace_id + Field.object       ✅
v0.5.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Foundation hardening (interfaces + OpenAPI 3.1)
v0.6.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Plugin infrastructure (plugins + GraphQL + metrics)
v0.7.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Spec Driven Development (pragma_spec)
v0.8.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  MCP integration (pragma_mcp)
v0.9.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Reference implementation (macss-imc)
v1.0.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Production ready (oauth2 + stability)
v1.1.0  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  Custom docs UI + community tooling + CLI
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
*macss-dev · macss.dev (planned) · pragmaspec.dev (planned)*