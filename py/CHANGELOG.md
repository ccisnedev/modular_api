# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/)
and the project adheres to [Semantic Versioning](https://semver.org/).

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
