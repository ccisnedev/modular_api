"""A body that cannot become the use case input is a client error: 400, not 500 (#44)."""

from __future__ import annotations

import json
from typing import Any

import pytest
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.testclient import TestClient

from modular_api.core.use_case_exception import UseCaseException
from modular_api.core.usecase import Input, Output, UseCase
from modular_api.core.usecase_handler import usecase_handler


class CountInput(Input):
    count: int = 0


class CountOutput(Output):
    count: int = 0

    @property
    def status_code(self) -> int:
        return 200


class CountUseCase(UseCase[CountInput, CountOutput]):
    """A hand-written from_json that trusts the shape of the body, as fromJson code often does."""

    def __init__(self, data: dict[str, Any]) -> None:
        raw = data["count"]  # KeyError when missing
        if raw == "boom":
            raise UseCaseException(status_code=422, message="No boom", error_code="BOOM")
        self._input = CountInput(count=int(raw))  # ValueError / TypeError on a bad shape

    @property
    def input(self) -> CountInput:
        return self._input

    def validate(self) -> str | None:
        return None

    async def execute(self) -> CountOutput:
        return CountOutput(count=self._input.count)


class _SpyLogger:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, object] | None]] = []

    def __getattr__(self, level: str) -> Any:
        def log(msg: str, *, fields: dict[str, object] | None = None) -> None:
            self.calls.append((level, msg, fields))

        return log


def _client(logger: _SpyLogger | None = None) -> TestClient:
    async def with_logger(request: Any) -> Any:
        if logger is not None:
            request.state.modular_logger = logger
        return await usecase_handler(CountUseCase)(request)

    app = Starlette(routes=[Route("/count", with_logger, methods=["POST"])])
    return TestClient(app, raise_server_exceptions=False)


def _post(client: TestClient, body: str) -> Any:
    return client.post("/count", content=body, headers={"content-type": "application/json"})


@pytest.mark.parametrize("body", ["{not json", "", "{", "nul"])
def test_unparseable_body_returns_400(body: str) -> None:
    resp = _post(_client(), body)
    assert resp.status_code == 400
    assert resp.json() == {"error": "Invalid JSON in request body"}


@pytest.mark.parametrize("body", ["[1, 2]", '"text"', "42", "null", "true"])
def test_json_that_is_not_an_object_returns_400(body: str) -> None:
    resp = _post(_client(), body)
    assert resp.status_code == 400
    assert resp.json() == {"error": "Request body must be a JSON object"}


@pytest.mark.parametrize(
    "payload",
    [
        {},  # KeyError: missing field
        {"count": "abc"},  # ValueError: int("abc")
        {"count": [1]},  # TypeError: int([1])
    ],
)
def test_error_inside_from_json_returns_400_without_details(payload: dict[str, Any]) -> None:
    logger = _SpyLogger()
    resp = _post(_client(logger), json.dumps(payload))

    assert resp.status_code == 400
    assert resp.json() == {"error": "Invalid request body"}
    levels = [level for level, _, _ in logger.calls]
    assert "warning" in levels
    assert "error" not in levels


def test_use_case_exception_inside_from_json_keeps_its_status() -> None:
    resp = _post(_client(), json.dumps({"count": "boom"}))
    assert resp.status_code == 422
    assert resp.json()["error"] == "BOOM"


def test_well_formed_body_still_succeeds() -> None:
    resp = _post(_client(), json.dumps({"count": "7"}))
    assert resp.status_code == 200
    assert resp.json() == {"count": 7}
