# modular-api

Use-case-centric toolkit for building modular APIs with Starlette.  
Define `UseCase` classes (input → validate → execute → output), connect them to HTTP routes, and get automatic OpenAPI documentation.

> Also available in **Dart**: [modular_api](https://pub.dev/packages/modular_api) · **TypeScript**: [@macss/modular-api](https://www.npmjs.com/package/@macss/modular-api)

---

## Quick start

```python
from modular_api import ModularApi, ModuleBuilder

# ─── Module builder (separate file in real projects) ──────────
def build_greetings_module(m: ModuleBuilder) -> None:
    m.usecase("hello", HelloWorld)

# ─── Server ───────────────────────────────────────────────────
api = ModularApi(base_path="/api")

api.module("greetings", build_greetings_module)

api.serve(port=8080)
```

```bash
curl -X POST http://localhost:8080/api/greetings/hello \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}'
```

```json
{ "message": "Hello, World!" }
```

**Docs** → `http://localhost:8080/docs`  
**Health** → `http://localhost:8080/health`  
**OpenAPI JSON** → `http://localhost:8080/openapi.json` *(also /openapi.yaml)*  
**Metrics** → `http://localhost:8080/metrics` *(opt-in)*

See `example/example.py` for the full implementation including Input, Output, UseCase with `validate()`, and the builder.

---

## Features

- `UseCase[I, O]` — pure business logic, no HTTP concerns
- `Input` / `Output` — DTOs with automatic OpenAPI schema generation via Pydantic `Field()`
- `Output.status_code` — custom HTTP status codes per response
- `UseCaseException` — structured error handling (status_code, message, error_code, details)
- `ModularApi` + `ModuleBuilder` — module registration and routing
- Constructor-based unit testing with fake dependency injection
- `cors_middleware` — built-in CORS support
- Scalar docs at `/docs` — auto-generated from registered use cases
- OpenAPI spec at `/openapi.json` and `/openapi.yaml` — raw spec download
- Health check at `GET /health` — [IETF Health Check Response Format](doc/health_check_guide.md)
- Prometheus metrics at `GET /metrics` — [Prometheus exposition format](doc/metrics_guide.md)
- Structured JSON logging — Loki/Grafana compatible, [request-scoped with trace_id](doc/logger_guide.md)
- All endpoints default to `POST` (configurable per use case)
- Full type annotations with `py.typed` marker (PEP 561)

---

## Installation

```bash
pip install modular-api
```

With Uvicorn for `api.serve()`:

```bash
pip install modular-api[serve]
```

---

## Error handling

```python
async def execute(self) -> None:
    user = await repository.find_by_id(self.input.user_id)
    if not user:
        raise UseCaseException(
            status_code=404,
            message="User not found",
            error_code="USER_NOT_FOUND",
        )
    self._output = FoundUserOutput(name=user.name)
```

---

## Testing

```python
def test_hello_world():
    usecase = HelloWorld(HelloInput(name="World"))
    error = usecase.validate()
    assert error is None

    await usecase.execute()
    assert usecase.output.message == "Hello, World!"
```

See [doc/testing_guide.md](doc/testing_guide.md) for the full testing guide.

---

## License

MIT — see [LICENSE](LICENSE).
