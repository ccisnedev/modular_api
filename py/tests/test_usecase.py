"""Tests for UseCase, Input, Output core contracts."""

from __future__ import annotations

import pytest

from modular_api.core.usecase import Input, Output, UseCase


# ── Concrete stubs for testing ──────────────────────────────────────


class SumInput(Input):
    """Two integers to sum."""

    def __init__(self, *, a: int | None, b: int | None) -> None:
        self.a = a
        self.b = b

    def to_json(self) -> dict[str, object]:
        return {"a": self.a, "b": self.b}

    def to_schema(self) -> dict[str, object]:
        return {
            "type": "object",
            "properties": {
                "a": {"type": "integer"},
                "b": {"type": "integer"},
            },
            "required": ["a", "b"],
        }


class SumOutput(Output):
    """Result of the sum operation."""

    def __init__(self, *, resultado: int) -> None:
        self.resultado = resultado

    @property
    def status_code(self) -> int:
        return 200

    def to_json(self) -> dict[str, object]:
        return {"resultado": self.resultado}

    def to_schema(self) -> dict[str, object]:
        return {
            "type": "object",
            "properties": {
                "resultado": {"type": "integer"},
            },
            "required": ["resultado"],
        }


class SumUseCase(UseCase[SumInput, SumOutput]):
    """Sums two integers."""

    def __init__(self, input_dto: SumInput) -> None:
        self._input = input_dto
        self._output = SumOutput(resultado=0)

    @property
    def input(self) -> SumInput:
        return self._input

    @property
    def output(self) -> SumOutput:
        return self._output

    def validate(self) -> str | None:
        if self._input.a is None:
            return "a is required"
        if self._input.b is None:
            return "b is required"
        return None

    async def execute(self) -> None:
        a = self._input.a or 0
        b = self._input.b or 0
        self._output = SumOutput(resultado=a + b)

    def to_json(self) -> dict[str, object]:
        return self._output.to_json()


# ── Input tests ─────────────────────────────────────────────────────


class TestInput:
    def test_cannot_instantiate_directly(self) -> None:
        with pytest.raises(TypeError):
            Input()  # type: ignore[abstract]

    def test_concrete_input_to_json(self) -> None:
        inp = SumInput(a=3, b=4)
        assert inp.to_json() == {"a": 3, "b": 4}

    def test_concrete_input_to_schema(self) -> None:
        inp = SumInput(a=1, b=2)
        schema = inp.to_schema()
        assert schema["type"] == "object"
        assert "a" in schema["properties"]  # type: ignore[operator]
        assert schema["required"] == ["a", "b"]


# ── Output tests ────────────────────────────────────────────────────


class TestOutput:
    def test_cannot_instantiate_directly(self) -> None:
        with pytest.raises(TypeError):
            Output()  # type: ignore[abstract]

    def test_concrete_output_to_json(self) -> None:
        out = SumOutput(resultado=7)
        assert out.to_json() == {"resultado": 7}

    def test_concrete_output_to_schema(self) -> None:
        out = SumOutput(resultado=0)
        schema = out.to_schema()
        assert schema["type"] == "object"
        assert "resultado" in schema["properties"]  # type: ignore[operator]

    def test_concrete_output_status_code(self) -> None:
        out = SumOutput(resultado=0)
        assert out.status_code == 200


# ── UseCase tests ───────────────────────────────────────────────────


class TestUseCase:
    def test_cannot_instantiate_directly(self) -> None:
        with pytest.raises(TypeError):
            UseCase()  # type: ignore[abstract]

    def test_validate_returns_none_when_valid(self) -> None:
        uc = SumUseCase(SumInput(a=3, b=4))
        assert uc.validate() is None

    def test_validate_returns_error_when_invalid(self) -> None:
        uc = SumUseCase(SumInput(a=5, b=None))
        assert uc.validate() is not None

    async def test_execute_sets_output(self) -> None:
        uc = SumUseCase(SumInput(a=3, b=4))
        assert uc.validate() is None
        await uc.execute()
        assert uc.output.resultado == 7

    async def test_to_json_returns_output_json(self) -> None:
        uc = SumUseCase(SumInput(a=10, b=20))
        await uc.execute()
        assert uc.to_json() == {"resultado": 30}

    def test_logger_defaults_to_none(self) -> None:
        uc = SumUseCase(SumInput(a=1, b=2))
        assert uc.logger is None
