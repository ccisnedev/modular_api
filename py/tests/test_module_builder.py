"""Tests for ModuleBuilder schema extraction.

Verifies that _extract_schemas captures Input and Output schemas
independently — a failure in Output (e.g. uninitialized property)
must not destroy the already-computable Input schema.
"""

from __future__ import annotations

from modular_api.core.module_builder import ModuleBuilder
from modular_api.core.registry import api_registry
from modular_api.core.usecase import Input, Output, UseCase


# ── Stubs: Output uninitialized (mirrors real HelloWorld pattern) ─────────


class StubInput(Input):
    def __init__(self, *, name: str) -> None:
        self._name = name

    @classmethod
    def from_json(cls, json: dict) -> StubInput:
        return cls(name=str(json.get("name", "")))

    def to_json(self) -> dict:
        return {"name": self._name}

    def to_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Name to greet"},
            },
            "required": ["name"],
        }


class StubOutput(Output):
    def __init__(self, *, message: str) -> None:
        self._message = message

    @property
    def status_code(self) -> int:
        return 200

    def to_json(self) -> dict:
        return {"message": self._message}

    def to_schema(self) -> dict:
        return {
            "type": "object",
            "properties": {
                "message": {"type": "string", "description": "Greeting message"},
            },
            "required": ["message"],
        }


class UninitializedOutputUseCase(UseCase[StubInput, StubOutput]):
    """UseCase with output initialised to a default — matches Dart pattern."""

    def __init__(self, input_dto: StubInput) -> None:
        self._input = input_dto
        self._output = StubOutput(message="")

    @property
    def input(self) -> StubInput:
        return self._input

    @property
    def output(self) -> StubOutput:
        return self._output

    @output.setter
    def output(self, value: StubOutput) -> None:
        self._output = value

    @classmethod
    def from_json(cls, json: dict) -> UninitializedOutputUseCase:
        return cls(StubInput.from_json(json))

    def validate(self) -> str | None:
        if not self.input._name:
            return "name is required"
        return None

    async def execute(self) -> None:
        self.output = StubOutput(message=f"Hello, {self.input._name}!")

    def to_json(self) -> dict:
        return self.output.to_json()


# ── Tests ─────────────────────────────────────────────────────────────────


class TestExtractSchemas:
    """Schema extraction must capture Input and Output independently."""

    def setup_method(self) -> None:
        api_registry.clear()

    def teardown_method(self) -> None:
        api_registry.clear()

    def test_input_schema_has_properties_when_output_uninitialized(self) -> None:
        """Input schema must be captured even if Output extraction were to fail."""
        schemas = ModuleBuilder._extract_schemas(UninitializedOutputUseCase.from_json)
        assert "name" in schemas["input"].get("properties", {}), (
            "Input schema lost its properties"
        )

    def test_output_schema_has_properties(self) -> None:
        """Output schema must include properties.message when initialised to default."""
        schemas = ModuleBuilder._extract_schemas(UninitializedOutputUseCase.from_json)
        assert "message" in schemas["output"].get("properties", {}), (
            "Output schema must have properties.message"
        )

    def test_input_schema_name_type_is_string(self) -> None:
        """Input schema properties.name.type must be 'string'."""
        schemas = ModuleBuilder._extract_schemas(UninitializedOutputUseCase.from_json)
        name_prop = schemas["input"].get("properties", {}).get("name", {})
        assert name_prop.get("type") == "string"

    def test_output_schema_message_type_is_string(self) -> None:
        """Output schema properties.message.type must be 'string'."""
        schemas = ModuleBuilder._extract_schemas(UninitializedOutputUseCase.from_json)
        message_prop = schemas["output"].get("properties", {}).get("message", {})
        assert message_prop.get("type") == "string"
