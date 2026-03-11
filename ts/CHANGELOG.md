# Changelog

All notable changes to this project will be documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/)
and the project adheres to [Semantic Versioning](https://semver.org/).

### Documentation

## [0.4.1] - 2026-03-12

### Removed

- **`prom-client`** — removed external dependency; all Prometheus metrics are now pure TypeScript
- Zero runtime dependencies besides `express`

### Added

- `Counter`, `Gauge`, `Histogram` — pure TypeScript metric types with Prometheus text exposition format
- `DEFAULT_BUCKETS`, `MetricSample` — public exports for custom metric usage
- `SwaggerDocs` — replaced `swagger-ui-express` with built-in Swagger UI served via CDN
- Built-in dark mode support for Swagger UI (system-aware via `prefers-color-scheme`)
- Cross-language parity with Dart and Python implementations

## [0.4.0] - 2026-03-03

### Removed

- **BREAKING:** `useCaseTestHandler` — removed from public API and deleted `src/core/usecase_test_handler.ts`
  - Testing now uses direct constructor injection: instantiate the UseCase with its Input, call `validate()`, `execute()`, and assert on `output` directly
  - Barrel exports removed from `src/index.ts` (`useCaseTestHandler`, `TestResponse`)

### Added

- **`GET /openapi.json`** — returns the full OpenAPI 3.0 specification as `application/json`
- **`GET /openapi.yaml`** — returns the full OpenAPI 3.0 specification as `application/x-yaml`
- `openApiJsonHandler()` / `openApiYamlHandler()` — Express handlers for raw spec access
- `jsonToYaml()` — zero-dependency JSON-to-YAML converter
- Spec is cached at startup alongside Swagger UI (no per-request rebuild)
- Barrel exports: `buildOpenApiSpec`, `jsonToYaml`, `openApiJsonHandler`, `openApiYamlHandler`
- 18 new tests: jsonToYaml unit (8), /openapi.json integration (4), /openapi.yaml integration (5), consistency (1)

### Changed

- Added comprehensive testing guide (`doc/testing_guide.md`) documenting the constructor-injection approach
- Updated `README.md` examples to reflect the new testing pattern

## [0.3.0] - 2026-02-26

### Added

- **Structured JSON Logger** — request-scoped logging compatible with Loki, Grafana, Elasticsearch, and any JSON log aggregator
- `LogLevel` enum — 8 RFC 5424 severity levels (emergency..debug) with configurable filtering
- `ModularLogger` interface — 8 logging methods (one per level) with optional structured `fields` and `traceId` property
- `RequestScopedLogger` — implementation with injectable `writeFn` for testability
- `loggingMiddleware()` — Express middleware that creates a per-request logger with unique `trace_id`
- `trace_id` auto-generated (UUID v4 via `crypto.randomUUID()`) or propagated from `X-Request-ID` header
- `X-Request-ID` response header set on every response for client-side correlation
- Logger injected as `UseCase.logger` property — zero breaking change to `execute()` signature
- Automatic status-to-level mapping: 2xx→info, 4xx→warning, 5xx→error
- Excluded routes: `/health`, `/metrics`, `/docs`, `/docs/` (no request/response logs)
- `logLevel` option on `ModularApiOptions` (default: `LogLevel.info`)
- `useCaseTestHandler` now accepts optional `{ logger }` options parameter
- Barrel exports: `LogLevel`, `RequestScopedLogger`, `ModularLogger`, `loggingMiddleware`, `LOGGER_LOCALS_KEY`, `LoggingMiddlewareOptions`
- 51 new tests: logger (26), middleware (19), integration (6)
- Documentation: `doc/logger_guide.md`

## [0.2.0] - 2026-02-24

### Added

- **IETF Health Check Response Format** — `GET /health` now returns `application/health+json` following [draft-inadarei-api-health-check](https://datatracker.ietf.org/doc/html/draft-inadarei-api-health-check)
- `HealthCheck` abstract class — implement to register custom health checks (database, cache, queue, etc.)
- `HealthCheckResult` — result DTO with `status`, `responseTime` (ms), and optional `output`
- `HealthStatus` type — `'pass' | 'warn' | 'fail'` with worst-status-wins aggregation
- `HealthService` — executes checks in parallel with per-check configurable timeout (default: 5s)
- `HealthResponse` — aggregated response with `version`, `releaseId`, `checks` map, and `httpStatusCode` (200 for pass/warn, 503 for fail)
- `healthHandler()` — Express handler for `GET /health`
- `ModularApi.addHealthCheck()` — register health checks via method chaining
- `ModularApiOptions` now accepts `version` and optional `releaseId`
- `releaseId` defaults to `version-debug`; override via `process.env.RELEASE_ID`
- **Prometheus Metrics Endpoint** — opt-in `GET /metrics` in [Prometheus text exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/)
- `MetricsRegistrar` — public API for registering custom metrics via `api.metrics`
- `metricsEnabled`, `metricsPath`, `excludedMetricsRoutes` constructor options
- Built-in HTTP instrumentation: `http_requests_total`, `http_request_duration_seconds`, `http_requests_in_flight`, `process_start_time_seconds`
- `prom-client` dependency for Prometheus metric types
- Test infrastructure: vitest + supertest

### Changed

- **BREAKING:** `GET /health` response changed from plaintext `ok` to JSON `application/health+json`
- **BREAKING:** `ModularApiOptions` extended — `version` parameter added (defaults to `'0.0.0'`)

## [0.1.0] - 2026-02-21

### Added

- **Initial release** — TypeScript port of [modular_api](https://pub.dev/packages/modular_api) (Dart)
- `UseCase<I, O>`, `Input`, `Output` — abstract base classes for use-case centric architecture
- `UseCaseFactory<I, O>` — type alias for static `fromJson` factories
- `UseCaseException` — structured error handling with `statusCode`, `message`, `errorCode`, `details`
- `ModularApi` — main orchestrator: module registration, middleware pipeline, Express server
- `ModuleBuilder` — fluent builder to register use cases as HTTP endpoints
- `useCaseHandler` — wraps any `UseCaseFactory` into an Express `RequestHandler`
- `useCaseTestHandler` — unit test helper (no HTTP server required)
- `cors()` middleware — configurable CORS with zero dependencies
- Automatic OpenAPI 3.0 spec generation from registered use cases
- Swagger UI auto-mounted at `GET /docs`
- Health check at `GET /health`
- All endpoints default to `POST` (configurable per use case)
- Schema introspection via `Input.toSchema()` / `Output.toSchema()`
- Custom HTTP status codes via `Output.statusCode` getter
- Full TypeScript declarations (`.d.ts`) included

### Stack

- Express 4.x
- swagger-ui-express 5.x
- TypeScript 5.x, strict mode, ES2020 target
