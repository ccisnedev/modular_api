"""Conformance tests: HelloInput/HelloOutput schemas match shared fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import sys

_EXAMPLE_DIR = Path(__file__).resolve().parent.parent / "example"
sys.path.insert(0, str(_EXAMPLE_DIR))

from example import HelloInput, HelloOutput  # type: ignore[import-untyped]

_FIXTURES = Path(__file__).resolve().parent.parent.parent / "tests" / "fixtures"


def _load_fixture(name: str) -> dict[str, object]:
    return json.loads((_FIXTURES / name).read_text(encoding="utf-8"))


class TestSchemaConformance:
    """Verify our example DTOs produce schemas identical to the shared fixtures."""

    def test_hello_input_schema_matches_fixture(self) -> None:
        fixture = _load_fixture("hello_input_schema.json")
        # to_schema() is now a classmethod — call on class, not instance
        assert HelloInput.to_schema() == fixture

    def test_hello_output_schema_matches_fixture(self) -> None:
        fixture = _load_fixture("hello_output_schema.json")
        assert HelloOutput.to_schema() == fixture

    def test_hello_input_from_json(self) -> None:
        """from_json populates fields correctly."""
        instance = HelloInput.from_json({"name": "Carlos"})
        assert instance.name == "Carlos"

    def test_hello_input_to_json(self) -> None:
        """to_json serializes correctly."""
        instance = HelloInput(name="Carlos")
        assert instance.to_json() == {"name": "Carlos"}

    def test_hello_output_from_json(self) -> None:
        instance = HelloOutput.from_json({"message": "Hello!"})
        assert instance.message == "Hello!"

    def test_hello_output_to_json(self) -> None:
        instance = HelloOutput(message="Hello!")
        assert instance.to_json() == {"message": "Hello!"}
