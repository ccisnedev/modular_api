"""Tests for ModularApi — the main orchestrator class."""

from __future__ import annotations

import pytest
from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.testclient import TestClient

from modular_api.core.health.health_check import HealthCheck, HealthCheckResult, HealthStatus
from modular_api.core.metrics.metric_registry import MetricsRegistrar
from modular_api.core.modular_api import ModularApi
from modular_api.core.registry import api_registry
from modular_api.core.usecase import Input, Output, UseCase


# ── Minimal UseCase ───────────────────────────────────────────


class _PingInput(Input):
    def to_json(self) -> dict:
        return {}

    def to_schema(self) -> dict:
        return {"type": "object", "properties": {}}


class _PingOutput(Output):
    def to_json(self) -> dict:
        return {"pong": True}

    def to_schema(self) -> dict:
        return {"type": "object", "properties": {"pong": {"type": "boolean"}}}

    @property
    def status_code(self) -> int:
        return 200


class _PingUseCase(UseCase[_PingInput, _PingOutput]):
    def __init__(self, inp: _PingInput) -> None:
        self._input = inp
        self._output = _PingOutput()

    @property
    def input(self) -> _PingInput:
        return self._input

    @property
    def output(self) -> _PingOutput:
        return self._output

    def validate(self) -> str | None:
        return None

    async def execute(self) -> None:
        self._output = _PingOutput()

    def to_json(self) -> dict:
        return self.output.to_json()

    @staticmethod
    def from_json(json: dict) -> _PingUseCase:
        return _PingUseCase(_PingInput())


# ── Minimal HealthCheck ───────────────────────────────────────


class _AlwaysHealthyCheck(HealthCheck):
    @property
    def name(self) -> str:
        return "always-healthy"

    async def check(self) -> HealthCheckResult:
        return HealthCheckResult(status=HealthStatus.PASS)


# ── Fixtures ──────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def _clean_registry():
    api_registry.clear()
    yield
    api_registry.clear()


def _make_api(**overrides: object) -> ModularApi:
    """Create a ModularApi with sensible defaults."""
    defaults: dict = {
        "base_path": "/api",
        "title": "Test API",
        "version": "1.0.0",
    }
    defaults.update(overrides)
    return ModularApi(**defaults)


# ── Step 2.9.1: Constructor and fluent methods ────────────────


class TestModularApiConstructor:
    """Constructor accepts all config options."""

    def test_default_values(self) -> None:
        api = ModularApi()
        assert api.title == "Modular API"
        assert api.version == "0.0.0"

    def test_custom_values(self) -> None:
        api = _make_api(title="My API", version="2.0.0")
        assert api.title == "My API"
        assert api.version == "2.0.0"


class TestModularApiModule:
    """module() registers a module and returns self."""

    def test_module_returns_self(self) -> None:
        api = _make_api()
        result = api.module("test", lambda m: m.usecase("ping", _PingUseCase.from_json))
        assert result is api

    def test_module_registers_routes(self) -> None:
        api = _make_api()
        api.module("test", lambda m: m.usecase("ping", _PingUseCase.from_json))
        assert len(api_registry.routes) == 1
        assert api_registry.routes[0].path == "/api/test/ping"


class TestModularApiUse:
    """use() adds custom middleware and returns self."""

    def test_use_returns_self(self) -> None:
        api = _make_api()

        def _noop_middleware(app):
            return app

        result = api.use(_noop_middleware)
        assert result is api


class TestModularApiAddHealthCheck:
    """add_health_check() registers a check and returns self."""

    def test_add_health_check_returns_self(self) -> None:
        api = _make_api()
        result = api.add_health_check(_AlwaysHealthyCheck())
        assert result is api


class TestModularApiMetrics:
    """metrics property returns MetricsRegistrar when enabled."""

    def test_metrics_none_when_disabled(self) -> None:
        api = _make_api(metrics_enabled=False)
        assert api.metrics is None

    def test_metrics_registrar_when_enabled(self) -> None:
        api = _make_api(metrics_enabled=True)
        assert isinstance(api.metrics, MetricsRegistrar)


# ── Step 2.9.2: Auto-mounted endpoints ───────────────────────


class TestAutoMountedEndpoints:
    """serve() auto-mounts /health, /openapi.json, /openapi.yaml."""

    def _build_client(self, **api_options: object) -> TestClient:
        api = _make_api(**api_options)
        api.module("test", lambda m: m.usecase("ping", _PingUseCase.from_json))
        app = api.build()
        return TestClient(app)

    def test_health_endpoint_returns_ietf_response(self) -> None:
        client = self._build_client()
        response = client.get("/health")
        assert response.status_code == 200
        assert "application/health+json" in response.headers["content-type"]
        body = response.json()
        assert body["status"] in ("pass", "warn", "fail")

    def test_openapi_json_returns_spec(self) -> None:
        client = self._build_client()
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert "application/json" in response.headers["content-type"]
        spec = response.json()
        assert spec["openapi"] == "3.0.0"
        assert "/api/test/ping" in spec["paths"]

    def test_openapi_yaml_returns_spec(self) -> None:
        client = self._build_client()
        response = client.get("/openapi.yaml")
        assert response.status_code == 200
        assert "application/x-yaml" in response.headers["content-type"]
        assert "openapi: 3.0.0" in response.text

    def test_metrics_endpoint_when_enabled(self) -> None:
        client = self._build_client(metrics_enabled=True)
        response = client.get("/metrics")
        assert response.status_code == 200
        assert "text/plain" in response.headers["content-type"]

    def test_metrics_endpoint_404_when_disabled(self) -> None:
        client = self._build_client(metrics_enabled=False)
        response = client.get("/metrics")
        assert response.status_code == 404

    def test_use_case_endpoint_works(self) -> None:
        client = self._build_client()
        response = client.post("/api/test/ping", json={})
        assert response.status_code == 200
        assert response.json() == {"pong": True}

    def test_docs_endpoint_returns_swagger_ui_html(self) -> None:
        client = self._build_client()
        response = client.get("/docs")
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "swagger-ui-dist@5" in response.text
        assert "Test API" in response.text


# ── Step 2.9.3: Middleware pipeline order ─────────────────────


class TestMiddlewarePipelineOrder:
    """Logging middleware wraps everything, metrics is second, custom after."""

    def test_request_has_trace_id(self) -> None:
        """Logging middleware is active — X-Request-ID header is returned."""
        api = _make_api()
        api.module("test", lambda m: m.usecase("ping", _PingUseCase.from_json))
        client = TestClient(api.build())

        response = client.post("/api/test/ping", json={})
        assert "x-request-id" in response.headers

    def test_health_check_with_registered_check(self) -> None:
        """Health endpoint evaluates registered HealthChecks."""
        api = _make_api()
        api.add_health_check(_AlwaysHealthyCheck())
        client = TestClient(api.build())

        response = client.get("/health")
        body = response.json()
        assert body["status"] == "pass"
        assert "always-healthy" in body.get("checks", {})
