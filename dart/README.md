[![pub package](https://img.shields.io/pub/v/modular_api.svg)](https://pub.dev/packages/modular_api)

# modular_api

Use-case centric toolkit for building modular APIs with Shelf.  
Define `UseCase` classes (input → validate → execute → output), connect them to HTTP routes, and get automatic Swagger/OpenAPI documentation.

> Also available in **TypeScript**: [@macss/modular-api](https://www.npmjs.com/package/@macss/modular-api) · **Python**: [macss-modular-api](https://pypi.org/project/macss-modular-api/)

---

## Quick start

```dart
import 'package:modular_api/modular_api.dart';

// ─── Module builder (separate file in real projects) ──────────
void buildGreetingsModule(ModuleBuilder m) {
  m.usecase('hello', HelloWorld.fromJson);
}

// ─── Server ───────────────────────────────────────────────────
Future<void> main() async {
  final api = ModularApi(basePath: '/api');

  api.module('greetings', buildGreetingsModule);

  await api.serve(port: 8080);
}
```

```bash
curl -X POST http://localhost:8080/api/greetings/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
```

```json
{"message":"Hello, World!"}
```

**Docs** → `http://localhost:8080/docs`  
**Health** → `http://localhost:8080/health`  
**OpenAPI JSON** → `http://localhost:8080/openapi.json` *(also /openapi.yaml)*  
**Metrics** → `http://localhost:8080/metrics` *(opt-in)*  

See `example/example.dart` for the full implementation including Input, Output, UseCase with `validate()`, and the builder.

---

## Features

- `UseCase<I, O>` — pure business logic, no HTTP concerns
- `Input` / `Output` — DTOs with `toJson()` and `toSchema()` for automatic OpenAPI
- `Output.statusCode` — custom HTTP status codes per response
- `UseCaseException` — structured error handling (status code, message, error code, details)
- `ModularApi` + `ModuleBuilder` — module registration and routing
- `cors()` middleware — built-in CORS support
- Swagger UI at `/docs` — auto-generated from registered use cases
- OpenAPI spec at `/openapi.json` and `/openapi.yaml` — raw spec download
- Health check at `GET /health` — [IETF Health Check Response Format](doc/health_check_guide.md)
- Prometheus metrics at `GET /metrics` — [Prometheus exposition format](doc/metrics_guide.md)
- Structured JSON logging — Loki/Grafana compatible, [request-scoped with trace_id](doc/logger_guide.md)
- All endpoints default to `POST` (configurable per use case)

---

## Installation

```yaml
dependencies:
  modular_api: ^0.3.0
```

```bash
dart pub add modular_api
```

---

## Error handling

```dart
@override
Future<void> execute() async {
  final user = await repository.findById(input.userId);
  if (user == null) {
    throw UseCaseException(
      statusCode: 404,
      message: 'User not found',
      errorCode: 'USER_NOT_FOUND',
    );
  }
  output = GetUserOutput(user: user);
}
```

```json
{"error": "USER_NOT_FOUND", "message": "User not found"}
```

---

## Testing

```dart
import 'package:test/test.dart';

void main() {
  test('HelloWorld returns greeting', () async {
    final useCase = HelloWorld(HelloInput(name: 'World'));
    expect(useCase.validate(), isNull);
    await useCase.execute();
    expect(useCase.output.message, 'Hello, World!');
  });
}
```

```bash
dart test
```

---

## Architecture

```
HTTP Request → ModularApi → Module → UseCase → Business Logic → Output → HTTP Response
```

- **UseCase layer** — pure logic, independent of HTTP
- **HTTP adapter** — turns a UseCase into a Shelf Handler
- **Middlewares** — cross-cutting concerns (CORS, logging)
- **Swagger UI** — documentation served automatically

---

## Documentation

- [AGENTS.md](AGENTS.md) — Framework guide (AI-optimized)
- [doc/INDEX.md](doc/INDEX.md) — Documentation index
- [doc/usecase_dto_guide.md](doc/usecase_dto_guide.md) — Creating Input/Output DTOs
- [doc/usecase_implementation.md](doc/usecase_implementation.md) — Implementing UseCases
- [doc/testing_guide.md](doc/testing_guide.md) — Testing guide
- [doc/health_check_guide.md](doc/health_check_guide.md) — Health check endpoint
- [doc/metrics_guide.md](doc/metrics_guide.md) — Prometheus metrics endpoint
- [doc/logger_guide.md](doc/logger_guide.md) — Structured JSON logger

---

## Compile to executable

```bash
dart compile exe bin/main.dart -o build/server
```

---

## License

MIT © [ccisne.dev](https://ccisne.dev)

```