"""Opt-in JSON body limit, per instance and per use case; 413 when exceeded (#43)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import pytest
from starlette.testclient import TestClient

from modular_api.core.modular_api import ModularApi
from modular_api.core.module_builder import ModuleBuilder
from modular_api.core.usecase import Input, Output, UseCase


class EchoInput(Input):
    text: str = ""


class EchoOutput(Output):
    size: int = 0

    @property
    def status_code(self) -> int:
        return 200


class Echo(UseCase[EchoInput, EchoOutput]):
    def __init__(self, data: dict[str, Any]) -> None:
        self._input = EchoInput(text=str(data.get("text", "")))

    @property
    def input(self) -> EchoInput:
        return self._input

    def validate(self) -> str | None:
        return None

    async def execute(self) -> EchoOutput:
        return EchoOutput(size=len(self._input.text))


def echo_factory(data: dict[str, Any]) -> Echo:
    return Echo(data)


def body_of_size(n: int) -> bytes:
    """A valid JSON object of exactly ``n`` bytes."""
    overhead = len(b'{"text":""}')
    assert n >= overhead
    return b'{"text":"' + b"a" * (n - overhead) + b'"}'


def client(
    *, instance: int | str | None = None, per_usecase: int | str | None = None, other: int | str | None = None
) -> TestClient:
    api = ModularApi(base_path="/api", json_body_limit=instance)

    def build(m: ModuleBuilder) -> None:
        m.usecase("main", echo_factory, json_body_limit=per_usecase)
        m.usecase("other", echo_factory, json_body_limit=other)
        m.usecase("read", echo_factory, method="GET", json_body_limit=1)

    api.module("m", build)
    return TestClient(api.build(port=0))


def post(c: TestClient, path: str, body: bytes) -> Any:
    return c.post(f"/api/m/{path}", content=body, headers={"Content-Type": "application/json"})


def test_no_limit_configured_accepts_large_body() -> None:
    c = client()
    assert post(c, "main", body_of_size(1024 * 1024)).status_code == 200


def test_instance_limit_exact_accepted_and_one_over_rejected() -> None:
    c = client(instance=200)
    assert post(c, "main", body_of_size(200)).status_code == 200
    res = post(c, "main", body_of_size(201))
    assert res.status_code == 413
    assert res.json() == {"error": "Request body too large"}
    assert res.headers["content-type"] == "application/json; charset=utf-8"


def test_size_string_limit() -> None:
    c = client(instance="1kb")
    assert post(c, "main", body_of_size(1024)).status_code == 200
    assert post(c, "main", body_of_size(1025)).status_code == 413


def test_per_usecase_raises_instance_limit() -> None:
    c = client(instance=100, per_usecase=500)
    assert post(c, "main", body_of_size(500)).status_code == 200
    assert post(c, "main", body_of_size(501)).status_code == 413
    # another use case keeps the instance limit
    assert post(c, "other", body_of_size(100)).status_code == 200
    assert post(c, "other", body_of_size(101)).status_code == 413


def test_per_usecase_lowers_instance_limit() -> None:
    c = client(instance=500, per_usecase=100)
    assert post(c, "main", body_of_size(101)).status_code == 413
    assert post(c, "other", body_of_size(500)).status_code == 200


def test_per_usecase_limit_without_instance_limit() -> None:
    c = client(per_usecase=100)
    assert post(c, "main", body_of_size(101)).status_code == 413
    assert post(c, "other", body_of_size(5000)).status_code == 200


def test_zero_rejects_any_non_empty_body() -> None:
    c = client(per_usecase=0)
    assert post(c, "main", b"{}").status_code == 413


def test_content_length_over_limit_rejected() -> None:
    c = client(instance=100)
    res = post(c, "main", body_of_size(150))
    assert res.status_code == 413


def test_streamed_body_without_content_length_over_limit_rejected() -> None:
    c = client(instance=100)
    body = body_of_size(300)

    def chunks() -> Iterator[bytes]:
        for i in range(0, len(body), 50):
            yield body[i : i + 50]

    res = c.post("/api/m/main", content=chunks(), headers={"Content-Type": "application/json"})
    assert res.status_code == 413
    assert res.json() == {"error": "Request body too large"}


def test_streamed_body_within_limit_accepted() -> None:
    c = client(instance=300)
    body = body_of_size(300)

    def chunks() -> Iterator[bytes]:
        for i in range(0, len(body), 50):
            yield body[i : i + 50]

    res = c.post("/api/m/main", content=chunks(), headers={"Content-Type": "application/json"})
    assert res.status_code == 200


def test_limit_counts_bytes_not_characters() -> None:
    # "é" is 2 bytes in UTF-8
    body = json.dumps({"text": "é" * 10}, ensure_ascii=False).encode("utf-8")
    assert len(body) == len('{"text": ""}') + 20
    c = client(instance=len(body))
    assert post(c, "main", body).status_code == 200
    c = client(instance=len(body) - 1)
    assert post(c, "main", body).status_code == 413


def test_invalid_json_within_limit_keeps_400() -> None:
    c = client(instance=100)
    assert post(c, "main", b"{nope").status_code == 400
    assert post(c, "main", b"[1]").status_code == 400


def test_get_usecase_unaffected() -> None:
    c = client(instance=1)
    assert c.get("/api/m/read?text=hello").status_code == 200


def test_invalid_limits_raise_at_registration() -> None:
    with pytest.raises(ValueError):
        ModularApi(json_body_limit="lots")
    with pytest.raises(ValueError):
        ModularApi(json_body_limit=-1)
    api = ModularApi()
    with pytest.raises(ValueError):
        api.module("m", lambda m: m.usecase("x", echo_factory, json_body_limit="nope"))
