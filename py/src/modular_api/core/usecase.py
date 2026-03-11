"""Core contracts: UseCase, Input, Output.

Lifecycle (handled by the framework):
  1. ``from_json(json)``    — static factory, builds the use case
  2. ``validate()``         — return error string or ``None``
  3. ``execute()``          — run business logic, set output
  4. ``output.to_json()``   — serialize and return to HTTP client
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, TypeVar


class Input(ABC):
    """Contract for use-case input DTOs.

    Every implementor must provide ``to_json`` and ``to_schema``.
    No default behavior is inherited — every Input is self-contained.
    """

    @abstractmethod
    def to_json(self) -> dict[str, object]:
        ...

    @abstractmethod
    def to_schema(self) -> dict[str, object]:
        """Return an OpenAPI-compatible JSON Schema describing this input."""
        ...


class Output(ABC):
    """Contract for use-case output DTOs.

    The implementor must define ``status_code`` explicitly — this forces
    developers to think about HTTP status codes for every response.
    """

    @abstractmethod
    def to_json(self) -> dict[str, object]:
        ...

    @abstractmethod
    def to_schema(self) -> dict[str, object]:
        """Return an OpenAPI-compatible JSON Schema describing this output."""
        ...

    @property
    @abstractmethod
    def status_code(self) -> int:
        """HTTP status code to return (e.g. 200, 201, 400, 404)."""
        ...


I = TypeVar("I", bound=Input)
O = TypeVar("O", bound=Output)


class UseCase(ABC, Generic[I, O]):
    """Contract for business logic units.

    Pure interface: all members must be provided by the implementor.
    No default behavior is inherited — every UseCase is self-contained.
    """

    # Request-scoped logger injected by the framework before execute().
    # Available inside execute(). None when running without middleware.
    logger: object | None = None

    @property
    @abstractmethod
    def input(self) -> I:
        """Input DTO — set in constructor."""
        ...

    @property
    @abstractmethod
    def output(self) -> O:
        """Output DTO — set in ``execute()``."""
        ...

    @abstractmethod
    def validate(self) -> str | None:
        """Validate the input. Return an error message or ``None``."""
        ...

    @abstractmethod
    async def execute(self) -> None:
        """Run the business logic and set ``self.output``."""
        ...

    @abstractmethod
    def to_json(self) -> dict[str, object]:
        """Serialize the output for the HTTP response body."""
        ...
