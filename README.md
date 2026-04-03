# modular_api

> *The theoretical and practical core of the MACSS ecosystem.*

A methodology for building modular, contract-first, AI-ready APIs — distributed as official SDKs in three languages, extensible through a plugin interface that anyone can implement.

---

## What is modular_api

`modular_api` is simultaneously three things:

- **A methodology** — part of MACSS (Modular Architecture for Comprehensive Software Solutions). A way of thinking about API design that is modular, contract-first, and AI-ready by default.
- **A specification** — a set of conventions and contracts that define how modules, plugins, DTOs, repositories, and use cases relate to each other. The spec is the source of truth. The SDKs are its expression.
- **A set of SDKs** — official implementations in three languages, each producing structurally identical `openapi.json` outputs from the same conceptual model.

---

## Monorepo Structure

```
modular_api/
  code/
    dart/        →  pub.dev: modular_api
    ts/          →  npm: @macss/modular-api
    py/          →  PyPI: macss-modular-api
    docs-ui/     →  npm: @macss/docs-ui
    tests/       →  cross-language parity tests
  docs/          →  specification and methodology
  README.md
```

Each SDK is independently versioned and published. The methodology they implement is identical.

---

## SDKs

| SDK | Package | Registry | Status |
|---|---|---|---|
| `code/dart/` | `modular_api` | [pub.dev](https://pub.dev/packages/modular_api) | ✅ Published |
| `code/ts/` | `@macss/modular-api` | [npm](https://www.npmjs.com/package/@macss/modular-api) | ✅ Published |
| `code/py/` | `macss-modular-api` | [PyPI](https://pypi.org/project/macss-modular-api/) | ✅ Published |

---

## Core Concepts

### Modules

Modules are written by the user. Each module owns exactly one domain — `imc/`, `patients/`, `billing/` — and is self-contained: use cases, DTOs, repository ports, and adapters. Modules do not call each other directly.

### Built-in Endpoints

Every SDK ships with the following endpoints out of the box, zero configuration:

| Endpoint | Description |
|---|---|
| `GET /docs` | Interactive Swagger UI from `openapi.json` |
| `GET /health` | IETF Health Check Response Format |
| `GET /metrics` | Prometheus text exposition format (opt-in) |
| `GET /openapi.json` | OpenAPI 3.0 specification |
| `GET /openapi.yaml` | OpenAPI 3.0 specification (YAML) |

### Plugins *(roadmap)*

Plugins will extend `modular_api` without modifying it. They will implement a single interface and integrate through lifecycle hooks. The core stays lean; the developer composes what they need.

**Ecosystem** — planned packages developed by MACSS:

| Package | Description |
|---|---|
| `pragma_spec` | Spec Driven Development + MCP bridge |
| `modular_api_oauth2` | Standards-compliant OAuth2 flows |
| `modular_api_graphql` | Auto-generated GraphQL from DTOs |

**Community** — anyone will be able to build and publish a plugin. The interface is the only contract.

---

## Quick Start

### Dart

```dart
import 'package:modular_api/modular_api.dart';

Future<void> main() async {
  final api = ModularApi(
    basePath: '/api',
    title: 'Modular API',
    version: '1.0.0',
    metricsEnabled: true,
  );

  api.module('greetings', (m) {
    m.usecase('hello', HelloWorld.fromJson);
  });

  await api.serve(port: 8080);
}
```

### TypeScript

```typescript
import { ModularApi, ModuleBuilder } from '@macss/modular-api';

const api = new ModularApi({
  basePath: '/api',
  title: 'Modular API',
  version: '1.0.0',
  metricsEnabled: true,
});

api.module('greetings', (m: ModuleBuilder) => {
  m.usecase('hello', HelloWorld.fromJson);
});

api.serve({ port: 8080 });
```

### Python

```python
from modular_api import ModularApi

api = ModularApi(
    base_path="/api",
    title="Modular API",
    version="1.0.0",
    metrics_enabled=True,
)

api.module("greetings", lambda m: m.usecase("hello", HelloWorld))

api.serve(port=8080)
```

```bash
# All three respond identically:
curl -X POST http://localhost:8080/api/greetings/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
 
# → {"message": "Hello, World!"}
```

See `code/dart/example/`, `code/ts/example/`, `code/py/example/` for full implementations including Input, Output, UseCase with `validate()`, health checks, and custom metrics.

---

## The Plugin Interface *(roadmap)*

Any package that implements this interface will be a valid plugin:

```dart
// Dart
abstract class ModularApiPlugin {
  String get name;
  List<String> get endpoints;
  void onModulesLoaded(List<MacssModule> modules);
  void onOpenApiGenerated(OpenApiSpec spec);
}
```

```typescript
// TypeScript
interface ModularApiPlugin {
  name: string;
  endpoints: string[];
  onModulesLoaded(modules: MacssModule[]): void;
  onOpenApiGenerated(spec: OpenApiSpec): void;
}
```

---

## Ecosystem

```
modular_api           →  this repo — core SDKs (Dart, TS, Python)
modular_api_plugins   →  base package for building community plugins  (planned)
modular_api_graphql   →  GraphQL plugin — CQRS queries               (planned)
modular_api_oauth2    →  OAuth2 plugin                                (planned)
pragma_spec           →  Spec Driven Development plugin               (v2.0+)
pragma_mcp            →  MCP server from /pragma.yaml                 (v2.0+)
```

All packages will live under the `macss-dev` organization on GitHub.

---

## MACSS & Spec Driven Development *(v2.0+ vision)*

`modular_api` implements the MACSS methodology. The v1.0 focus is CQRS: Commands via REST, Queries via GraphQL, with plugins and OAuth2.

In v2.0+, the ecosystem will explore Spec Driven Development: every module begins at Momento Zero — a `pragma_spec.yaml` written by the engineer before any code exists. This file would be the single source of truth, defining states, transitions, workflows, and business intent. The code must honor it.

```
pragma_spec.yaml   →  Momento Zero (human writes the spec)         (v2.0+)
code               →  must honor the spec
openapi.json       →  generated by modular_api                     (✅ today)
pragma.yaml        →  generated by pragma_spec plugin              (v2.0+)
MCP server         →  generated by pragma_mcp                      (v2.0+)
```

---

## License

MIT — see [LICENSE](./LICENSE)