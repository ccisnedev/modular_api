"""Tests for auto-schema: Input and Output as BaseModel subclasses."""

from __future__ import annotations

from pydantic import BaseModel, Field

from modular_api.core.usecase import Input, Output


class TestInputIsBaseModel:
    """Input must inherit from BaseModel so Pydantic drives serialization."""

    def test_input_is_subclass_of_basemodel(self) -> None:
        assert issubclass(Input, BaseModel)

    def test_input_has_to_json(self) -> None:
        assert hasattr(Input, "to_json")

    def test_input_has_to_schema(self) -> None:
        assert hasattr(Input, "to_schema")

    def test_input_has_from_json(self) -> None:
        assert hasattr(Input, "from_json")

    def test_simple_input_auto_schema(self) -> None:
        """A minimal Input subclass derives its schema from field declarations."""

        class NameInput(Input):
            name: str = Field(description="Name to greet")

        schema = NameInput.to_schema()
        assert schema["type"] == "object"
        assert "name" in schema["properties"]
        assert schema["properties"]["name"]["type"] == "string"
        assert schema["properties"]["name"]["description"] == "Name to greet"
        assert "name" in schema["required"]

    def test_simple_input_from_json(self) -> None:
        """from_json() builds an Input instance from a plain dict."""

        class NameInput(Input):
            name: str

        instance = NameInput.from_json({"name": "Carlos"})
        assert instance.name == "Carlos"

    def test_simple_input_to_json(self) -> None:
        """to_json() serializes an Input to a plain dict."""

        class NameInput(Input):
            name: str

        instance = NameInput(name="Carlos")
        result = instance.to_json()
        assert result == {"name": "Carlos"}

    def test_optional_field_schema(self) -> None:
        """Optional fields are excluded from required[] and marked nullable."""

        class OptInput(Input):
            required_field: str
            optional_field: str | None = None

        schema = OptInput.to_schema()
        assert "required_field" in schema["required"]
        # optional_field should NOT be in required
        assert "optional_field" not in schema.get("required", [])
