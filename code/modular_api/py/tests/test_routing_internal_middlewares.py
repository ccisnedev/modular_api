"""Logging, metrics and tracing treat path variants consistently (#47).

The rule: an operational endpoint is excluded only on its exact path. A variant such as
``/health/`` or ``/HEALTH`` is not that endpoint — the router rejects it (404, or Starlette's
trailing-slash redirect 307), so it is logged, traced and counted under ``route="UNMATCHED"``.
"""

from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from starlette.testclient import TestClient

from modular_api import ModularApi
from modular_api.core.logger.logger import LogLevel
from modular_api.core.tracing.tracing_options import TracingOptions

_exporter = InMemorySpanExporter()
_provider = TracerProvider()
_provider.add_span_processor(SimpleSpanProcessor(_exporter))
_tracing = TracingOptions(tracer_provider=_provider)


@pytest.fixture(autouse=True)
def _clear_spans() -> Iterator[None]:
    _exporter.clear()
    yield


@pytest.fixture
def client() -> TestClient:
    api = ModularApi(
        base_path="/api", log_level=LogLevel.info, metrics_enabled=True, tracing=_tracing
    )
    return TestClient(api.build(port=0), raise_server_exceptions=False)


def _completed(capsys: pytest.CaptureFixture[str]) -> list[dict[str, object]]:
    lines = [line for line in capsys.readouterr().out.splitlines() if line.startswith("{")]
    logs = [json.loads(line) for line in lines]
    return [log for log in logs if log.get("msg") == "request completed"]


def _request_metrics(client: TestClient) -> list[str]:
    text = client.get("/api/metrics").text
    return [line for line in text.splitlines() if line.startswith("http_requests_total{")]


def test_exact_operational_path_stays_excluded(
    client: TestClient, capsys: pytest.CaptureFixture[str]
) -> None:
    assert client.get("/api/health").status_code == 200

    assert _completed(capsys) == []
    assert _exporter.get_finished_spans() == ()
    assert _request_metrics(client) == []


@pytest.mark.parametrize(
    ("path", "status"),
    [("/api/health/", 307), ("/api/HEALTH", 404), ("/api//health", 404)],
)
def test_variant_is_logged_traced_and_unmatched(
    client: TestClient, capsys: pytest.CaptureFixture[str], path: str, status: int
) -> None:
    assert client.get(path, follow_redirects=False).status_code == status

    completed = _completed(capsys)
    assert len(completed) == 1
    assert completed[0]["status"] == status
    assert len(_exporter.get_finished_spans()) == 1
    assert _request_metrics(client) == [
        f'http_requests_total{{method="GET",route="UNMATCHED",status_code="{status}"}} 1'
    ]
