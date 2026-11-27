"""413 logging and a hostile Content-Length for the JSON body limit (#43)."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.routing import Route
from starlette.testclient import TestClient

from modular_api.core.usecase_handler import (
    _declared_length,  # pyright: ignore[reportPrivateUsage]
    usecase_handler,
)
from .test_json_body_limit import body_of_size, echo_factory


class _SpyLogger:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, object] | None]] = []

    def __getattr__(self, level: str) -> Any:
        def log(msg: str, *, fields: dict[str, object] | None = None) -> None:
            self.calls.append((level, msg, fields))

        return log


def _spy_app(limit: int, spy: _SpyLogger) -> TestClient:
    handler = usecase_handler(echo_factory, body_limit=limit)

    async def with_logger(request: Any) -> Any:
        request.state.modular_logger = spy
        return await handler(request)

    return TestClient(Starlette(routes=[Route("/e", with_logger, methods=["POST"])]))


def test_413_is_logged_as_warning_with_status_limit_and_length() -> None:
    spy = _SpyLogger()
    res = _spy_app(100, spy).post("/e", content=body_of_size(150), headers={"Content-Type": "application/json"})
    assert res.status_code == 413
    assert spy.calls == [("warning", "Request body too large", {"status": 413, "limit": 100, "length": 150})]


def test_413_log_omits_length_when_unknown() -> None:
    spy = _SpyLogger()
    body = body_of_size(300)

    def chunks() -> Iterator[bytes]:
        yield body

    res = _spy_app(100, spy).post("/e", content=chunks(), headers={"Content-Type": "application/json"})
    assert res.status_code == 413
    assert spy.calls == [("warning", "Request body too large", {"status": 413, "limit": 100})]


def test_non_ascii_digit_content_length_is_ignored() -> None:
    scope = {"type": "http", "headers": [(b"content-length", "²".encode())]}
    assert _declared_length(Request(scope)) is None
