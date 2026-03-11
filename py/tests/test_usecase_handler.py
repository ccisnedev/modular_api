"""RED — UseCaseHandler: Starlette endpoint factory for any UseCase."""

import json

import pytest
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.testclient import TestClient

from modular_api.core.use_case_exception import UseCaseException
from modular_api.core.usecase import Input, Output, UseCase
from modular_api.core.usecase_handler import LOGGER_STATE_KEY, usecase_handler


# ── Stubs ─────────────────────────────────────────────────────────────────


class GreetInput(Input):
    def __init__(self, name: str) -> None:
        self._name = name

    def to_json(self) -> dict:
        return {"name": self._name}

    def to_schema(self) -> dict:
        return {"type": "object", "properties": {"name": {"type": "string"}}}

    @property
    def status_code(self) -> int:
        return 200


class GreetOutput(Output):
    def __init__(self, greeting: str = "") -> None:
        self._greeting = greeting

    def to_json(self) -> dict:
        return {"greeting": self._greeting}

    def to_schema(self) -> dict:
        return {"type": "object", "properties": {"greeting": {"type": "string"}}}

    @property
    def status_code(self) -> int:
        return 200


class GreetUseCase(UseCase[GreetInput, GreetOutput]):
    """Says hello — happy path."""

    def __init__(self, data: dict) -> None:
        self._input = GreetInput(name=data.get("name", ""))
        self._output = GreetOutput()

    @property
    def input(self) -> GreetInput:
        return self._input

    @property
    def output(self) -> GreetOutput:
        return self._output

    def validate(self) -> str | None:
        if not self._input._name:
            return "name is required"
        return None

    async def execute(self) -> None:
        self._output = GreetOutput(greeting=f"Hello, {self._input._name}!")

    def to_json(self) -> dict:
        return self._output.to_json()


class FailingUseCase(UseCase[GreetInput, GreetOutput]):
    """Raises UseCaseException during execute."""

    def __init__(self, data: dict) -> None:
        self._input = GreetInput(name=data.get("name", ""))
        self._output = GreetOutput()

    @property
    def input(self) -> GreetInput:
        return self._input

    @property
    def output(self) -> GreetOutput:
        return self._output

    def validate(self) -> str | None:
        return None

    async def execute(self) -> None:
        raise UseCaseException(
            status_code=409,
            message="Already exists",
            error_code="CONFLICT",
        )

    def to_json(self) -> dict:
        return self._output.to_json()


class CrashingUseCase(UseCase[GreetInput, GreetOutput]):
    """Raises an unexpected error during execute."""

    def __init__(self, data: dict) -> None:
        self._input = GreetInput(name="x")
        self._output = GreetOutput()

    @property
    def input(self) -> GreetInput:
        return self._input

    @property
    def output(self) -> GreetOutput:
        return self._output

    def validate(self) -> str | None:
        return None

    async def execute(self) -> None:
        raise RuntimeError("disk on fire")

    def to_json(self) -> dict:
        return self._output.to_json()


# ── Helpers ───────────────────────────────────────────────────────────────


def _app(*routes: Route) -> Starlette:
    return Starlette(routes=list(routes))


# ── Payload extraction ────────────────────────────────────────────────────


class TestPayloadExtraction:
    """POST/PUT/PATCH → JSON body; GET/DELETE → query params."""

    def test_post_extracts_json_body(self) -> None:
        app = _app(Route("/greet", usecase_handler(GreetUseCase), methods=["POST"]))
        client = TestClient(app)
        resp = client.post("/greet", json={"name": "World"})
        assert resp.status_code == 200
        assert resp.json()["greeting"] == "Hello, World!"

    def test_get_extracts_query_params(self) -> None:
        app = _app(Route("/greet", usecase_handler(GreetUseCase), methods=["GET"]))
        client = TestClient(app)
        resp = client.get("/greet?name=World")
        assert resp.status_code == 200
        assert resp.json()["greeting"] == "Hello, World!"

    def test_get_extracts_path_params(self) -> None:
        app = _app(Route("/greet/{name}", usecase_handler(GreetUseCase), methods=["GET"]))
        client = TestClient(app)
        resp = client.get("/greet/World")
        assert resp.status_code == 200
        assert resp.json()["greeting"] == "Hello, World!"


# ── UseCase lifecycle ─────────────────────────────────────────────────────


class TestUseCaseLifecycle:
    """validate → execute → respond with output.toJson + output.statusCode."""

    def test_validation_error_returns_400(self) -> None:
        app = _app(Route("/greet", usecase_handler(GreetUseCase), methods=["POST"]))
        client = TestClient(app)
        resp = client.post("/greet", json={"name": ""})
        assert resp.status_code == 400
        body = resp.json()
        assert body["error"] == "name is required"

    def test_use_case_exception_returns_custom_status(self) -> None:
        app = _app(Route("/fail", usecase_handler(FailingUseCase), methods=["POST"]))
        client = TestClient(app)
        resp = client.post("/fail", json={})
        assert resp.status_code == 409
        body = resp.json()
        assert body["error"] == "CONFLICT"
        assert body["message"] == "Already exists"

    def test_unhandled_exception_returns_500(self) -> None:
        app = _app(Route("/crash", usecase_handler(CrashingUseCase), methods=["POST"]))
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/crash", json={})
        assert resp.status_code == 500
        body = resp.json()
        assert body["error"] == "Internal server error"
        # Stack trace must NOT be exposed to the client.
        assert "disk on fire" not in json.dumps(body)

    def test_response_content_type_is_json(self) -> None:
        app = _app(Route("/greet", usecase_handler(GreetUseCase), methods=["POST"]))
        client = TestClient(app)
        resp = client.post("/greet", json={"name": "Ada"})
        assert "application/json" in resp.headers["content-type"]

    def test_non_dict_json_body_returns_400(self) -> None:
        """Bare JSON string like '"hello"' must return 400, not 500."""
        app = _app(Route("/greet", usecase_handler(GreetUseCase), methods=["POST"]))
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/greet",
            content='"string"',
            headers={"content-type": "application/json"},
        )
        assert resp.status_code == 400
        assert "must be a JSON object" in resp.json()["error"]

    def test_logger_injected_from_request_state(self) -> None:
        """If logging middleware placed a logger in request.state, the handler injects it."""
        captured_loggers: list[object] = []

        class SpyUseCase(UseCase[GreetInput, GreetOutput]):
            def __init__(self, data: dict) -> None:
                self._input = GreetInput(name="x")
                self._output = GreetOutput()

            @property
            def input(self) -> GreetInput:
                return self._input

            @property
            def output(self) -> GreetOutput:
                return self._output

            def validate(self) -> str | None:
                return None

            async def execute(self) -> None:
                captured_loggers.append(self.logger)
                self._output = GreetOutput(greeting="ok")

            def to_json(self) -> dict:
                return self._output.to_json()

        # Middleware that fakes a logger in request.state
        from starlette.middleware import Middleware
        from starlette.middleware.base import BaseHTTPMiddleware

        class FakeLoggerMiddleware(BaseHTTPMiddleware):
            async def dispatch(self, request, call_next):
                setattr(request.state, LOGGER_STATE_KEY, "fake-logger")
                return await call_next(request)

        app = Starlette(
            routes=[Route("/spy", usecase_handler(SpyUseCase), methods=["POST"])],
            middleware=[Middleware(FakeLoggerMiddleware)],
        )
        client = TestClient(app)
        client.post("/spy", json={})
        assert captured_loggers == ["fake-logger"]
