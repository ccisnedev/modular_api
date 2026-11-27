"""Routing is strict, and middlewares can read the use case that will run (#47).

The variant table from the issue is kept as a regression test: a middleware that compares the
path exactly must not be bypassed by writing the path differently.
"""

from __future__ import annotations

from typing import Any

import pytest
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.testclient import TestClient

from modular_api import ModularApi, ResolvedRoute, resolved_route
from modular_api.core.logger.logger import LogLevel
from modular_api.core.usecase import Input, Output, UseCase

CANONICAL = "/api/v1/payments/execute"
executions: list[str] = []
seen: list[ResolvedRoute | None] = []


class PayInput(Input):
    note: str = ""


class PayOutput(Output):
    paid: bool = True

    @property
    def status_code(self) -> int:
        return 200


class ExecutePayment(UseCase[PayInput, PayOutput]):
    def __init__(self, data: dict[str, Any]) -> None:
        self._input = PayInput(note=str(data.get("note", "")))

    @property
    def input(self) -> PayInput:
        return self._input

    def validate(self) -> str | None:
        return None

    async def execute(self) -> PayOutput:
        executions.append(self._input.note)
        return PayOutput()


class ListPayments(ExecutePayment):
    pass


class RequireToken(BaseHTTPMiddleware):
    """The pattern the issue reproduces: protect one path by comparing it exactly."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        seen.append(resolved_route(request))
        if request.url.path == CANONICAL and request.headers.get("x-token") != "secret":
            return JSONResponse({"error": "Unauthorized"}, status_code=401)
        return await call_next(request)


@pytest.fixture
def client() -> TestClient:
    executions.clear()
    seen.clear()
    api = ModularApi(base_path="/api/v1", log_level=LogLevel.emergency)
    api.use(RequireToken)
    api.module(
        "payments",
        lambda m: (
            m.usecase("execute", ExecutePayment),
            m.usecase("list", ListPayments, method="GET"),
        ),
    )
    return TestClient(api.build(port=0), raise_server_exceptions=False)


def _post(client: TestClient, path: str, token: str | None = None) -> Any:
    headers = {"content-type": "application/json"}
    if token is not None:
        headers["x-token"] = token
    return client.post(path, content="{}", headers=headers, follow_redirects=False)


def test_canonical_path_runs_behind_the_middleware(client: TestClient) -> None:
    assert _post(client, CANONICAL).status_code == 401
    assert executions == []

    resp = _post(client, CANONICAL, "secret")
    assert resp.status_code == 200
    assert executions == [""]


@pytest.mark.parametrize(
    "path",
    [
        f"{CANONICAL}/",
        "/API/v1/Payments/Execute",
        "/api/v1/payments/Execute",
        "/api/v1/payments//execute",
        "/api/v1//payments/execute",
        f"{CANONICAL}//",
        "/api/v1/payments/%65xecute",
        "/api/v1/payments%2Fexecute",
        f"{CANONICAL};x",
        "/api/v1/payments/./execute",
    ],
)
def test_path_variant_does_not_reach_the_use_case_without_the_token(
    client: TestClient, path: str
) -> None:
    resp = _post(client, path)

    # 307 is Starlette's trailing-slash redirect: the handler does not run.
    assert resp.status_code in (401, 404, 307)
    assert executions == []


def test_middleware_reads_the_resolved_use_case(client: TestClient) -> None:
    _post(client, CANONICAL, "secret")

    assert seen == [
        ResolvedRoute(module="payments", use_case="execute", method="POST", path=CANONICAL)
    ]


def test_resolved_route_is_absent_on_a_404(client: TestClient) -> None:
    resp = _post(client, "/api/v1/payments/missing", "secret")

    assert resp.status_code == 404
    assert seen == [None]


def test_resolved_route_is_absent_on_a_wrong_method(client: TestClient) -> None:
    resp = client.get(CANONICAL, headers={"x-token": "secret"})

    assert resp.status_code == 405
    assert seen == [None]


def test_resolved_route_is_absent_for_operational_endpoints(client: TestClient) -> None:
    assert client.get("/api/v1/health").status_code == 200
    assert seen == [None]


def test_head_resolves_to_the_get_use_case(client: TestClient) -> None:
    """HEAD runs the GET handler, so a guard must see the same route for it."""
    client.head("/api/v1/payments/list")

    assert seen == [
        ResolvedRoute(module="payments", use_case="list", method="GET", path="/api/v1/payments/list")
    ]
