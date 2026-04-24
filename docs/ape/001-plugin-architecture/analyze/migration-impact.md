# APE 001 — Plugin Architecture: Migration Impact

> Estado: **ANALYZE**
> Scope: v0.5.0 — migración a plugins (sin GraphQL)
> Fecha: 2026-04-07
> Actualizado: 2026-04-08

---

## 1. Breaking changes (0.x.x — no backward compatibility contract)

### 1.1 — `addHealthCheck()` eliminado

**v0.4.5**:
```typescript
api.addHealthCheck(new DatabaseHealthCheck());
```

**v0.5.0**:
```typescript
api.plugin(healthPlugin({ checks: [new DatabaseHealthCheck()] }));
```

`addHealthCheck()` se elimina de `ModularApi`. No se depreca — 0.x.x no tiene contrato de retrocompatibilidad. El código llega limpio a 1.0.0.

### 1.2 — `metricsEnabled` y `api.metrics` eliminados del core

**v0.4.5**:
```typescript
const api = new ModularApi({ metricsEnabled: true });
api.metrics?.createCounter({ name: 'orders_total', help: '...' });
```

**v0.5.0**:
```typescript
const metrics = metricsPlugin();
api.plugin(metrics);
metrics.registrar.createCounter({ name: 'orders_total', help: '...' });
```

Todo lo relacionado con métricas vive en `MetricsPlugin`: registry, registrar, middleware de instrumentación, endpoint `/metrics`, y built-in counters. El core no sabe de métricas.

### 1.3 — Built-ins son opt-in

**v0.4.5**:
```typescript
const api = new ModularApi(); // auto-monta /health, /docs, /openapi.json, /openapi.yaml
```

**v0.5.0**:
```typescript
const api = new ModularApi(); // no monta nada — solo módulos
api
  .plugin(healthPlugin())
  .plugin(metricsPlugin())
  .plugin(openApiPlugin());
```

No hay auto-registro. No hay flags de desactivación. Si no lo registras, no existe. Diseñamos para 1.0.0, no para el pasado.

### 1.4 — Constructor simplificado

Parámetros que desaparecen del constructor de `ModularApi`:

| Parámetro eliminado | Migración |
|---|---|
| `metricsEnabled` | `api.plugin(metricsPlugin())` |
| `metricsPath` | `api.plugin(metricsPlugin({ path: '/custom' }))` |
| `excludedMetricsRoutes` | `metricsPlugin({ excludedRoutes: [...] })` |

Lo que queda en el constructor:
```typescript
ModularApi({
  basePath?: string;     // "/api"
  title?: string;        // "Modular API"
  version?: string;      // "x.y.z"
  releaseId?: string;    // version-debug
  servers?: Array<{url, description?}>;
  logLevel?: LogLevel;
})
```

---

## 2. Cambios en ModularApi por SDK

### 2.1 — Estado interno nuevo

```
_plugins: List<ModularApiPlugin>                 ← plugins registrados
_pluginRoutes: List<{method, path, plugin}>      ← rutas montadas por plugins (validación)
_pluginMiddlewares: List<Middleware>              ← middlewares instalados por plugins
```

### 2.2 — Métodos eliminados

- `addHealthCheck()` — reemplazado por `healthPlugin({ checks })`
- `get metrics` — reemplazado por `metricsPlugin().registrar`

### 2.3 — Nuevo método público: `.plugin()`

```typescript
api.plugin(myPlugin): this;
```

### 2.4 — `serve()` / `build()` reestructurado

**Antes** (v0.4.5):
```dart
_root.get('/health', healthHandler(_healthService));
if (metricsEnabled) _root.get(metricsPath, metricsHandler(_metricRegistry!));
await OpenApi.init(title: title, port: port, servers: servers);
_root.get('/docs', swaggerDocsHandler(title: title));
_root.get('/openapi.json', OpenApi.openapiJson);
_root.get('/openapi.yaml', OpenApi.openapiYaml);
// ... pipeline y listen
```

**Después** (v0.5.0):
```dart
// 1. Notify plugins: modules are loaded
for (final p in _plugins) { p.onModulesLoaded(_buildContext(port: port)); }

// 2. Let plugins mount their routes
for (final p in _plugins) { p.onMount(_buildContext(port: port)); }

// 3. Build middleware pipeline:
//    logging (core) → plugin middlewares → user middlewares (.use()) → routes

// 4. Mount module routes

// 5. Generate OpenAPI spec
await OpenApi.init(title: title, port: port, servers: servers);

// 6. Notify plugins: spec generated
for (final p in _plugins) { p.onOpenApiGenerated(spec, _buildContext(port: port)); }

// 7. Listen
```

### 2.5 — Python: hooks en `build()`

Python tiene `build()` (retorna ASGI app) y `serve()` (llama uvicorn). Los hooks se invocan en `build()`. `serve()` solo llama `build()` + `uvicorn.run()`.

---

## 3. Impacto en tests existentes

### 188 parity tests — SE ROMPEN (intencionalmente)

Con opt-in, los tests que esperan `/health`, `/docs`, `/openapi.json`, `/metrics` necesitan registrar plugins primero. Esto es intencional — estamos en 0.x.x y la migración es mecánica:

```typescript
// Agregar antes de serve() en cada test fixture:
api.plugin(healthPlugin())
   .plugin(openApiPlugin())
   .plugin(metricsPlugin());
```

### Tests nuevos necesarios

| Test | Qué valida |
|---|---|
| Plugin registration | `.plugin()` registra, retorna `this`, chainable |
| Duplicate name rejection | `.plugin()` con nombre duplicado lanza `PluginRegistrationError` |
| Lifecycle: onRegister | Se llama inmediatamente al hacer `.plugin()` |
| Lifecycle: onModulesLoaded | Se llama en `serve()` después de todos los `.module()` |
| Lifecycle: onMount | Se llama después de onModulesLoaded |
| Lifecycle: onOpenApiGenerated | Se llama después de generar spec |
| Lifecycle: onShutdown | Se llama al cerrar servidor |
| Lifecycle: ordering | onRegister → onModulesLoaded → onMount → onOpenApiGenerated |
| PluginContext: registry read-only | Intentar mutar lanza error |
| PluginContext: config values | basePath, title, version, servers correctos |
| PluginContext: mountRoute | Monta ruta efectivamente accesible via HTTP |
| PluginContext: addMiddleware | Middleware se inserta en el pipeline correcto |
| Duplicate path rejection | Dos plugins montando mismo path lanza error |
| HealthPlugin | `/health` responde igual que v0.4.5 |
| MetricsPlugin: endpoint | `/metrics` responde igual que v0.4.5 |
| MetricsPlugin: middleware | Request counters/histograms funcionan |
| MetricsPlugin: custom metrics | `plugin.registrar.createCounter()` funciona |
| OpenApiPlugin | `/openapi.json`, `/openapi.yaml`, `/docs` responden igual |
| Bare ModularApi | Sin plugins, solo módulos — no hay /health ni /docs |

Estimación: ~20 tests nuevos por SDK × 3 SDKs = ~60 tests nuevos.

---

## 4. Impacto en barrel exports

### Nuevos exports

```
ModularApiPlugin        ← interface/abstract class
PluginContext            ← lo que recibe el plugin
PluginRegistrationError ← error de nombre duplicado

healthPlugin()          ← factory del plugin interno
metricsPlugin()         ← factory del plugin interno
openApiPlugin()         ← factory del plugin interno
```

### Exports que NO cambian

`HealthCheck`, `HealthService`, `HealthCheckResult`, `Counter`, `Gauge`, `Histogram`, `MetricRegistry`, `MetricsRegistrar`, `buildOpenApiSpec`, `swaggerDocsHandler`, etc. — siguen exportados. Los plugins los usan internamente y el usuario puede importarlos para configuración avanzada.

### Exports eliminados

- `metricsHandler` — ahora es interno de MetricsPlugin (el usuario no monta `/metrics` manualmente)
- `metricsMiddleware` — interno de MetricsPlugin

---

## 5. Impacto en la estructura de archivos

### Nuevos archivos por SDK

```
core/plugin/
├── modular_api_plugin.{dart|ts|py}    ← interface + PluginContext
└── plugin_errors.{dart|ts|py}         ← PluginRegistrationError

plugins/
├── health_plugin.{dart|ts|py}
├── metrics_plugin.{dart|ts|py}
└── openapi_plugin.{dart|ts|py}
```

### Archivos que se modifican

```
core/modular_api.{dart|ts|py}     ← .plugin(), lifecycle en serve(), eliminar addHealthCheck/metricsEnabled
{barrel export file}               ← nuevos exports, remover metricsHandler/metricsMiddleware
```

### Archivos que NO se eliminan

Los archivos actuales de health, metrics, OpenAPI se MANTIENEN. Los plugins son composiciones de lo que ya existe — no reimplementaciones. `health_plugin.ts` importa `healthHandler` de `core/health/health_handler.ts`.

---

## 6. Impacto en el registry

### Estado actual: singleton global mutable

```typescript
export const apiRegistry = new ApiRegistry();
```

### Cambio: `PluginContext.registry` retorna snapshot read-only

```typescript
private buildContext(port?: number): PluginContext {
  return {
    registry: Object.freeze([...apiRegistry.routes]),
    basePath: this.basePath,
    title: this.title,
    version: this.version,
    // ...
  };
}
```

El singleton mutable no se toca — `ModuleBuilder.usecase()` sigue agregando entries. Solo el view entregado al plugin es inmutable.

---

## 7. Orden de migración (secuencia de trabajo)

1. **Plugin infrastructure** — `ModularApiPlugin`, `PluginContext`, `.plugin()`, `addMiddleware()`, lifecycle en `serve()`
2. **HealthPlugin** — migrar `/health` a plugin, eliminar `addHealthCheck()`
3. **OpenApiPlugin** — migrar `/openapi.json`, `/openapi.yaml`, `/docs`
4. **MetricsPlugin** — migrar MetricRegistry, middleware, `/metrics`, eliminar `metricsEnabled` y `api.metrics`
5. **Limpiar constructor** — remover parámetros de metrics
6. **Actualizar tests existentes** — agregar plugins a fixtures
7. **Tests nuevos** — plugin infrastructure + built-in plugins

Cada paso: implementar en 1 SDK → tests → replicar a los otros 2 → parity tests.

---

## 8. Decisiones resueltas

| # | Decisión | Resolución | Razón |
|---|---|---|---|
| D1 | ¿Plugin package separado? | **NO** — vive en `modular_api` | Específico de este framework |
| D2 | ¿Scope de v0.5.0? | Plugin interface + 3 built-ins. Sin GraphQL. | GraphQL tendrá su propio APE |
| D3 | ¿Plugins internos? | health, metrics, openapi (incluye /docs) | Todo lo que no es módulos es plugin |
| D4 | ¿MetricRegistry en core o plugin? | **Plugin** | Métricas es una unidad cohesiva opt-in |
| D5 | ¿Metrics middleware en core o plugin? | **Plugin** | Inseparable del MetricRegistry |
| D6 | ¿Built-ins auto o opt-in? | **Opt-in** | 0.x.x, diseñamos para 1.0.0 |
| D7 | ¿`addHealthCheck()` deprecated o eliminado? | **Eliminado** | 0.x.x, código limpio para 1.0.0 |
| D8 | ¿`PluginContext.addMiddleware()`? | **SÍ en v0.5.0** | Necesario para MetricsPlugin |
