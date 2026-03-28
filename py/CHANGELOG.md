# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/)
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.5] - 2026-03-28

### Added

- **`servers` parameter** in `ModularApi` constructor — configures the OpenAPI `servers` field so Swagger UI "Try it out" targets the correct host (LAN IP, domain, reverse proxy URL). Defaults to `localhost:{port}` when omitted.

### Fixed

- **`usecase_handler` catch blocks use scoped logger** — `UseCaseException` and unexpected errors are now logged through `request.state.modular_logger` instead of `print(stderr)`, enabling Loki correlation with `trace_id` (issue #7).

## [0.4.4] - 2026-03-14

### Changed

- **Swagger UI replaced with `@macss/docs-ui`** — the ~200-line inline HTML/CSS/JS reduced to a ~15-line bootloader that loads `@macss/docs-ui@0.1` from jsdelivr CDN
- Dark mode now delegated to `docs-ui` package — single source of truth across all three SDKs

## [0.4.3] - 2026-03-13

### Changed (BREAKING)

- **`execute()` returns `O`** — no longer `None`; the handler reads the returned Output directly
- **Removed `output` property** from `UseCase` — no mutable state; `execute()` returns the result
- **Removed `to_json()`** from `UseCase` — the handler calls `output.to_json()` on the returned value
- **Removed Strategy 2 fallback** in OpenAPI schema extraction — no `factory({}).output` path

## [0.4.2] - 2026-03-12

### Added

- **Auto-schema generation** — `Input` and `Output` inherit from Pydantic `BaseModel`; schemas derived automatically from field declarations
- `Field(description='x')` re-exported from Pydantic — uniform field metadata across all three SDKs
- Class-level schema extraction in `ModuleBuilder` — no `factory({})` dummy call needed
- `_normalize_schema()` — converts Pydantic JSON Schema Draft 2020-12 to OpenAPI 3.0.3 (`anyOf` → `nullable`, strip `title`/`default`)
- Cross-language schema conformance tests against shared JSON fixtures

### Changed

- `Input` / `Output` now inherit from `BaseModel` — `to_json()`, `to_schema()`, `from_json()` are automatic
- Manual `to_schema()` override is deprecated via `__init_subclass__()` detection — use field declarations instead (removal in v0.5.0)
- `_extract_schemas()` uses return type hint introspection (Strategy 1) with `factory({})` fallback (Strategy 2)

## [0.4.1] - 2026-03-12

### Added

- PyPI publish script (`publish.ps1`) with `.env` token management
- Published to PyPI: `pip install modular-api`

### Fixed

- Schema extraction for nested Pydantic models in OpenAPI spec
- Dictionary guard for input validation edge cases
- Default output initialization in `UseCase`

## [0.4.0] - 2026-03-11

### Added

- Initial Python implementation of `modular_api` reaching feature parity with Dart and TypeScript
- `UseCase[I, O]` — abstract base class for pure business logic, no HTTP concerns
- `Input` / `Output` — DTOs with `to_json()` and `to_schema()` for automatic OpenAPI
- `Output.status_code` — custom HTTP status codes per response
- `UseCaseException` — structured error handling (status_code, message, error_code, details)
- `ModularApi` + `ModuleBuilder` — module registration and routing via Starlette
- `cors_middleware` — built-in CORS support
- Scalar docs at `/docs` — auto-generated from registered use cases
- OpenAPI spec at `/openapi.json` and `/openapi.yaml` — raw spec download
- Health check at `GET /health` — IETF Health Check Response Format
- Prometheus metrics at `GET /metrics` — native implementation, zero external dependencies
- Structured JSON logging — Loki/Grafana compatible, request-scoped with `trace_id`
- All endpoints default to `POST` (configurable per use case)
- Full type annotations with `py.typed` marker (PEP 561)
