from __future__ import annotations

from modular_api import Input, Output, UseCase, Field


# ── Input DTO ─────────────────────────────────────────────────


class HelloInput(Input):
    name: str = Field(description="Name to greet", examples=["World"])


# ── Output DTO ────────────────────────────────────────────────


class HelloOutput(Output):
    message: str = Field(description="Greeting message", examples=["Hello, World!"])

    @property
    def status_code(self) -> int:
        return 200


# ── UseCase ───────────────────────────────────────────────────


class HelloWorld(UseCase[HelloInput, HelloOutput]):
    def __init__(self, input_dto: HelloInput) -> None:
        self._input = input_dto

    @property
    def input(self) -> HelloInput:
        return self._input

    @classmethod
    def from_json(cls, json: dict[str, object]) -> HelloWorld:
        return cls(HelloInput.from_json(json))

    def validate(self) -> str | None:
        if not self.input.name:
            return "name is required"
        return None

    async def execute(self) -> HelloOutput:
        self.logger.info(f"Greeting user: {self.input.name}")
        return HelloOutput(message=f"Hello, {self.input.name}!")
