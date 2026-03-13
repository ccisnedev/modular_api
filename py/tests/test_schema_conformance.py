"""Conformance tests: HelloInput/HelloOutput schemas match shared fixtures."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

# Import the example DTOs directly from the example module
import sys

# Add the example directory so we can import from it
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
        instance = HelloInput(name="test")
        assert instance.to_schema() == fixture

    def test_hello_output_schema_matches_fixture(self) -> None:
        fixture = _load_fixture("hello_output_schema.json")
        instance = HelloOutput(message="test")
        assert instance.to_schema() == fixture
