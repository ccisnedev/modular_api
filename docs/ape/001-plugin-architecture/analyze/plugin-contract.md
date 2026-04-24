# APE 001 — Plugin Architecture: Contract Design

> Estado: **ANALYZE**
> Scope: v0.5.0 — migración a plugins (sin GraphQL)
> Fecha: 2026-04-07
> Actualizado: 2026-04-08

---

## 1. ModularApiPlugin — Contrato mínimo

El contrato vive en el paquete `modular_api` — no en un paquete separado. Es específico de este framework.

### Dart

```dart
abstract class ModularApiPlugin {
  /// Identifier — must be unique across all registered plugins.
  String get name;

  /// Called immediately when `.plugin()` is invoked on ModularApi.
  /// Use for early validation and state initialization.
  void onRegister(PluginContext context) {}

  /// Called after all `.module()` calls, before routes are mounted.
  /// The registry is fully populated — read-only access to all use cases.
  void onModulesLoaded(PluginContext context) {}

  /// Called when the plugin should mount its own routes.
  /// Use `context.mountRoute(method, path, handler)` to add endpoints.
  void onMount(PluginContext context) {}

  /// Called after the OpenAPI spec has been generated.
  /// The plugin can read or enrich the spec (add paths, schemas, etc.).
  void onOpenApiGenerated(Map<String, dynamic> spec, PluginContext context) {}

  /// Called when the server is shutting down. Cleanup resources.
  void onShutdown() {}
}
```

### TypeScript

```typescript
interface ModularApiPlugin {
  readonly name: string;

  onRegister?(context: PluginContext): void;
  onModulesLoaded?(context: PluginContext): void;
  onMount?(context: PluginContext): void;
  onOpenApiGenerated?(spec: Record<string, unknown>, context: PluginContext): void;
  onShutdown?(): void;
}
```

### Python

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class ModularApiPlugin(Protocol):
    @property
    def name(self) -> str: ...

    def on_register(self, context: PluginContext) -> None: ...
    def on_modules_loaded(self, context: PluginContext) -> None: ...
    def on_mount(self, context: PluginContext) -> None: ...
    def on_openapi_generated(self, spec: dict, context: PluginContext) -> None: ...
    def on_shutdown(self) -> None: ...
```

**Opcionalidad por lenguaje**: en Dart los hooks tienen cuerpo vacío (no-op por defecto). En TS son opcionales (`?`). En Python las implementaciones concretas usan `pass` en los hooks que no necesitan.

---

## 2. PluginContext — Lo que recibe un plugin

```
PluginContext
├── registry: ReadonlyList<UseCaseRegistration>   ← read-only snapshot
├── basePath: string                               ← e.g. "/api"
├── title: string                                  ← API title
├── version: string                                ← semver
├── servers: List<{url, description?}>             ← OpenAPI servers
├── port: int                                      ← listening port (0 before serve())
├── logger: ModularLogger                          ← scoped to plugin
├── mountRoute(method, path, handler)              ← route registration
└── addMiddleware(middleware)                       ← middleware installation
```

### `registry` es read-only

El plugin lee el registry pero nunca lo muta. El conjunto de use cases es determinístico — definido exclusivamente por `.module()`.

Implementación:
- Dart: `UnmodifiableListView<UseCaseRegistration>`
- TS: `readonly UseCaseRegistration[]` + `Object.freeze` en runtime
- Python: `tuple[UseCaseRegistration, ...]`

### `mountRoute()` acepta handler nativo del framework

No existe abstracción cross-framework en runtime. Cada SDK tipifica `mountRoute()` con su handler nativo:

```dart
// Dart
void mountRoute(String method, String path, Handler handler);
```
```typescript
// TS
mountRoute(method: string, path: string, handler: RequestHandler): void;
```
```python
# Python
def mount_route(self, method: str, path: str, handler: ASGIApplication) -> None: ...
```

Esto es consistente con cómo el framework funciona hoy — los handlers de health, docs, etc. ya son framework-nativos.

### `addMiddleware()` instala middleware en el pipeline

Los plugins que necesitan interceptar el pipeline de requests (e.g. MetricsPlugin) usan `addMiddleware()`. Los middlewares de plugins se insertan en el pipeline entre el logging (core) y los middlewares del usuario (`.use()`).

```dart
// Dart
void addMiddleware(Middleware middleware);
```
```typescript
// TS
addMiddleware(middleware: RequestHandler): void;
```
```python
# Python
def add_middleware(self, middleware: type) -> None: ...
```

Pipeline resultante:
```
Logging (core, siempre) → Plugin middlewares (orden de registro) → User middlewares (.use()) → Routes
```

### `logger` es scoped al plugin

El logger viene pre-configurado con `plugin:<name>` como contexto. Cada log entry identifica qué plugin lo emitió.

### `port` disponible a partir de `onMount`

En `onRegister` el port es `0` (aún no se llamó `serve()`). A partir de `onMount` tiene el valor real.

---

## 3. `.plugin()` en ModularApi

```dart
// Dart
ModularApi plugin(ModularApiPlugin plugin) {
  if (_plugins.any((p) => p.name == plugin.name)) {
    throw PluginRegistrationError('Plugin "${plugin.name}" is already registered.');
  }
  _plugins.add(plugin);
  plugin.onRegister(_buildContext());
  return this;
}
```

```typescript
// TS
plugin(plugin: ModularApiPlugin): this {
  if (this.plugins.some((p) => p.name === plugin.name)) {
    throw new PluginRegistrationError(`Plugin "${plugin.name}" is already registered.`);
  }
  this.plugins.push(plugin);
  plugin.onRegister?.(this.buildContext());
  return this;
}
```

```python
# Python
def plugin(self, plugin: ModularApiPlugin) -> ModularApi:
    if any(p.name == plugin.name for p in self._plugins):
        raise PluginRegistrationError(f'Plugin "{plugin.name}" is already registered.')
    self._plugins.append(plugin)
    plugin.on_register(self._build_context())
    return self
```

### Orden de invocación (flujo completo en `serve()`)

```
1. Constructor           → ModularApi created
2. .plugin(p)            → p.onRegister(context)        [por cada plugin, en orden de registro]
3. .module(name, build)  → registry populated            [por cada módulo]
4. .use(middleware)       → custom middleware queued
5. .serve(port) ─────────→ pipeline:
   5a.                      for each plugin: plugin.onModulesLoaded(context)
   5b.                      for each plugin: plugin.onMount(context)
   5c.                      build middleware pipeline:
                              logging (core)
                              → plugin middlewares (from addMiddleware, in registration order)
                              → user middlewares (from .use())
   5d.                      mount module routes
   5e.                      generate OpenAPI spec
   5f.                      for each plugin: plugin.onOpenApiGenerated(spec, context)
   5g.                      start listening
6. shutdown ─────────────→ for each plugin: plugin.onShutdown()
```

### Validación

- **Nombre duplicado**: error inmediato en `.plugin()`.
- **Path duplicado**: detectado en `onMount()` — el `mountRoute()` del contexto valida.

---

## 4. Los 3 plugins internos

### HealthPlugin

Absorbe: `HealthService`, `healthHandler`. Reemplaza `addHealthCheck()`.

```typescript
function healthPlugin(options?: { checks?: HealthCheck[] }): ModularApiPlugin {
  let service: HealthService;
  return {
    name: 'health',
    onRegister(context) {
      service = new HealthService({ version: context.version });
      for (const check of options?.checks ?? []) {
        service.addHealthCheck(check);
      }
    },
    onMount(context) {
      context.mountRoute('GET', '/health', healthHandler(service));
    },
  };
}
```

**`addHealthCheck()` se elimina de ModularApi.** Reemplazado por:
```typescript
api.plugin(healthPlugin({ checks: [dbCheck, cacheCheck] }));
```

### MetricsPlugin

Absorbe: `MetricRegistry`, `MetricsRegistrar`, metrics middleware, `/metrics` endpoint, built-in counters/gauges/histograms. `metricsEnabled` y `api.metrics` desaparecen del core.

```typescript
function metricsPlugin(options?: {
  path?: string;
  excludedRoutes?: string[];
}): ModularApiPlugin {
  const registry = new MetricRegistry();
  const registrar = new MetricsRegistrar(registry);

  // Built-in HTTP metrics
  const httpRequestsTotal = registry.createCounter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests.',
    labelNames: ['method', 'route', 'status_code'],
  });
  const httpRequestsInFlight = registry.createGauge({
    name: 'http_requests_in_flight',
    help: 'Number of HTTP requests currently being processed.',
  });
  const httpRequestDuration = registry.createHistogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds.',
    labelNames: ['method', 'route', 'status_code'],
  });

  return {
    name: 'metrics',

    /** Expose the registrar for custom metric creation by the user. */
    get registrar() { return registrar; },

    onRegister(context) {
      const registeredPaths = context.registry.map((r) => r.path);
      context.addMiddleware(
        metricsMiddleware({
          requestsTotal: httpRequestsTotal,
          requestsInFlight: httpRequestsInFlight,
          requestDuration: httpRequestDuration,
          excludedRoutes: options?.excludedRoutes ?? [
            options?.path ?? '/metrics', '/health', '/docs', '/docs/',
          ],
          registeredPaths,
        }),
      );
    },

    onMount(context) {
      const path = options?.path ?? '/metrics';
      context.mountRoute('GET', path, metricsHandler(registry));
    },
  };
}
```

El usuario accede al registrar reteniendo referencia al plugin:
```typescript
const metrics = metricsPlugin();
api.plugin(metrics);
// Custom metrics via plugin reference:
metrics.registrar.createCounter({ name: 'orders_total', help: 'Total orders.' });
```

**Nota**: `metricsPlugin.registrar` es un campo extra que no está en `ModularApiPlugin`. Esto es válido — el plugin puede tener API pública propia además de los hooks del contrato.

### OpenApiPlugin

Absorbe: OpenAPI spec generation, `/openapi.json`, `/openapi.yaml`, `/docs` (Swagger UI).

```typescript
function openApiPlugin(options?: { docsPath?: string }): ModularApiPlugin {
  return {
    name: 'openapi',
    onMount(context) {
      const spec = buildOpenApiSpec({
        title: context.title,
        port: context.port,
        servers: context.servers,
      });
      context.mountRoute('GET', '/openapi.json', openApiJsonHandler(spec));
      context.mountRoute('GET', '/openapi.yaml', openApiYamlHandler(spec));

      const docsPath = options?.docsPath ?? '/docs';
      context.mountRoute('GET', docsPath, swaggerDocsHandler({ title: context.title }));
      context.mountRoute('GET', `${docsPath}/`, swaggerDocsHandler({ title: context.title }));
    },
  };
}
```

---

## 5. Uso completo — API resultante

```typescript
const metrics = metricsPlugin();

const api = new ModularApi({ basePath: '/api', title: 'My API', version: '1.0.0' });
api
  .plugin(healthPlugin({ checks: [new DatabaseHealthCheck()] }))
  .plugin(metrics)
  .plugin(openApiPlugin())
  .module('users', buildUsersModule)
  .module('products', buildProductsModule)
  .serve({ port: 8080 });

// Custom metrics:
metrics.registrar.createCounter({ name: 'orders_total', help: 'Total orders.' });
```

`new ModularApi()` sin plugins produce una API desnuda que solo monta módulos. Cada capability es una decisión explícita del desarrollador.
