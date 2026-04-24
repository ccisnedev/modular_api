# APE 001 — Plugin Architecture: Current State

> Estado: **ANALYZE**
> Scope: v0.5.0 — migración a plugins (sin GraphQL)
> Fecha: 2026-04-07
> Actualizado: 2026-04-08

---

## Principio rector

**ModularApi existe para crear APIs modulares.** Todo lo demás — health checks, métricas, documentación OpenAPI — son plugins. El core hace una sola cosa: registrar módulos, componer rutas, y ejecutar el pipeline de request.

---

## 1. Lo que existe hoy

### ModularApi — Superficie pública

Los 3 SDKs exponen una API fluida idéntica:

```
ModularApi(basePath, title, version, releaseId, servers, metricsEnabled, metricsPath, logLevel)
  .module(name, builder)     → registra módulos (use cases + rutas)
  .use(middleware)            → middleware pipeline (user-level)
  .addHealthCheck(check)     → salud custom
  .serve(port)               → arranca servidor + monta built-ins
```

### Built-in Endpoints — Hardcoded en `serve()`

Todos están montados directamente dentro de `serve()` / `build()`:

| Endpoint | Handler | Montaje |
|---|---|---|
| `GET /health` | `healthHandler(healthService)` | `serve()` |
| `GET /docs` | `swaggerDocsHandler(title)` | `serve()` |
| `GET /openapi.json` | `openApiJsonHandler(spec)` | `serve()` |
| `GET /openapi.yaml` | `openApiYamlHandler(spec)` | `serve()` |
| `GET /metrics` | `metricsHandler(registry)` | `serve()` (condicional) |

No hay abstracción — cada endpoint es una llamada directa al router dentro del cuerpo de `serve()`.

### Registry — Global singleton

| SDK | Tipo | Acceso |
|---|---|---|
| Dart | `_ApiRegistry` (privado, prefijo `_`) | `apiRegistry` (top-level) |
| TS | `class ApiRegistry` (export) | `apiRegistry` singleton (export) |
| Python | `class ApiRegistry` (export) | `api_registry` singleton (export) |

Contenido: `List<UseCaseRegistration>` con:
- `module`, `command`, `method`, `path` — metadata de ruta
- `factory` — `UseCaseFactory` (constructor desde JSON)
- `schemas` — `{ input, output }` JSON Schema (TS/Python) o `inputExample`/`outputExample` (Dart)
- `doc` — `UseCaseDocMeta` (summary, description, tags)

Consumido por:
1. OpenAPI generator — itera `routes` para producir paths/schemas
2. Metrics middleware — usa `routes.map(r => r.path)` para normalizar métricas

### Middleware Pipeline

Orden fijo en los 3 SDKs:
1. **Logging** (outermost) — trace_id, structured JSON
2. **Metrics** (si enabled) — counters, histograms
3. **Custom middlewares** (`.use()`) — user-level
4. **Routes** (modules + built-ins)

### Metrics Infrastructure

- `MetricRegistry` — almacena Counter/Gauge/Histogram
- `MetricsRegistrar` — public API para crear métricas custom (`api.metrics?.createCounter(...)`)
- Built-in metrics: `http_requests_total`, `http_requests_in_flight`, `http_request_duration_seconds`
- Se crean en el constructor (Dart/TS) o en `build()` (Python)
- Exposición Prometheus en `/metrics`

### Health Infrastructure

- `HealthService` — evalúa checks en paralelo
- `HealthCheck` — interface/abstract: `name` + `check() → HealthCheckResult`
- `addHealthCheck()` en `ModularApi` delega a `HealthService`
- Respuesta IETF Health Check Response Format

---

## 2. Qué debe ser plugin y qué no

### Core (NO es plugin)

| Responsabilidad | Razón |
|---|---|
| Registro de módulos (`.module()`) | Es la razón de existir de ModularApi |
| Composición de rutas | Consecuencia directa de los módulos |
| Middleware pipeline (`.use()`) | Infraestructura de transporte |
| Logging middleware | Cross-cutting concern del request pipeline |

El logging no es plugin porque es parte del pipeline de transporte — todo request pasa por él. No monta endpoints, no consume el registry, no tiene lifecycle independiente.

### Plugins internos (v0.5.0)

| Plugin | Endpoints | Middleware | Depende de |
|---|---|---|---|
| **HealthPlugin** | `GET /health` | — | `HealthService`, `HealthCheck` |
| **MetricsPlugin** | `GET /metrics` | `metricsMiddleware` | `MetricRegistry`, `MetricsRegistrar`, counters/gauges/histograms |
| **OpenApiPlugin** | `GET /openapi.json`, `GET /openapi.yaml`, `GET /docs` | — | Registry (para generar spec), `swaggerDocsHandler` |

Cada uno monta endpoints propios. MetricsPlugin también instala middleware via `addMiddleware()`. Cada uno tiene un lifecycle independiente del core. Cada uno podría no existir y la API seguiría funcionando — incluyendo métricas.

---

## 3. Diferencias entre SDKs relevantes para plugins

| Aspecto | Dart (Shelf) | TS (Express) | Python (Starlette) |
|---|---|---|---|
| Router | `Router` (shelf_router) | `express.Router` | `Starlette(routes=[...])` |
| Montar ruta | `_root.get(path, handler)` | `this.app.get(path, handler)` | `Route(path, endpoint)` en lista |
| Middleware | `Pipeline().addMiddleware()` | `this.app.use()` | `app.add_middleware()` |
| Schema en registry | `inputExample` / `outputExample` | `schemas.input` / `schemas.output` | `schemas['input']` / `schemas['output']` |
| Metrics init | Constructor | Constructor | `build()` |

### Implicación

Los plugins son código específico de cada SDK — un plugin Dart usa `Handler`, uno TS usa `RequestHandler`, uno Python usa ASGI endpoint. **No existe abstracción cross-framework en runtime.** La paridad es de contrato: los 3 SDKs definen `ModularApiPlugin` + `PluginContext` con la misma estructura y los mismos hooks.

---

## 4. Lo que NO existe y se necesita para v0.5.0

1. **`ModularApiPlugin`** — interface/abstract class con lifecycle hooks
2. **`PluginContext`** — lo que el framework entrega al plugin (`mountRoute`, `addMiddleware`, registry, config, logger)
3. **`.plugin()` en ModularApi** — método público de registro con validación de nombre duplicado
4. **Lifecycle en `serve()`** — invocación ordenada de hooks (onRegister → onModulesLoaded → onMount → onOpenApiGenerated → onShutdown)
5. **HealthPlugin** — refactor de `/health` como plugin. Reemplaza `addHealthCheck()`.
6. **MetricsPlugin** — refactor de `/metrics` + middleware + MetricRegistry como plugin. Reemplaza `metricsEnabled` y `api.metrics`.
7. **OpenApiPlugin** — refactor de `/openapi.json`, `/openapi.yaml`, `/docs` como plugin
8. **Validación de plugins** — nombres duplicados (en `.plugin()`), paths duplicados (en `mountRoute()`)
9. **Read-only registry** — vista inmutable del registry para plugins
10. **Eliminación de parámetros del constructor** — `metricsEnabled`, `metricsPath`, `excludedMetricsRoutes`
11. **Eliminación de métodos** — `addHealthCheck()`, `get metrics`
