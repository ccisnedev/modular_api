"""example/example.py — Minimal runnable example.

Mirrors ``example/example.dart`` (Dart) and ``example/example.ts`` (TypeScript).

Run::

    python -m example.example

Then test::

    curl -X POST http://localhost:8080/api/greetings/hello \
         -H "Content-Type: application/json" \
         -d '{"name":"World"}'

Docs::

    http://localhost:8080/docs
"""

from __future__ import annotations

import sys

from modular_api import (
    HealthCheck,
    HealthCheckResult,
    HealthStatus,
    Input,
    LogLevel,
    ModularApi,
    ModuleBuilder,
    Output,
    UseCase,
    Field,
)


# ── Module builder ────────────────────────────────────────────


def build_greetings_module(m: ModuleBuilder) -> None:
    m.usecase("hello", HelloWorld.from_json)


# ── Input DTO ─────────────────────────────────────────────────


class HelloInput(Input):
    name: str = Field(description="Name to greet")


# ── Output DTO ────────────────────────────────────────────────


class HelloOutput(Output):
    message: str = Field(description="Greeting message")

    @property
    def status_code(self) -> int:
        return 200


# ── UseCase ───────────────────────────────────────────────────


class HelloWorld(UseCase[HelloInput, HelloOutput]):
    def __init__(self, input_dto: HelloInput) -> None:
        self._input = input_dto
        self._output = HelloOutput(message="")

    @property
    def input(self) -> HelloInput:
        return self._input

    @property
    def output(self) -> HelloOutput:
        return self._output

    @output.setter
    def output(self, value: HelloOutput) -> None:
        self._output = value

    @classmethod
    def from_json(cls, json: dict[str, object]) -> HelloWorld:
        return cls(HelloInput.from_json(json))

    def validate(self) -> str | None:
        if not self.input.name:
            return "name is required"
        return None

    async def execute(self) -> None:
        self.logger.info(f"Greeting user: {self.input.name}")
        self.output = HelloOutput(message=f"Hello, {self.input.name}!")

    def to_json(self) -> dict[str, object]:
        return self.output.to_json()


# ── Health check ──────────────────────────────────────────────


class AlwaysPassHealthCheck(HealthCheck):
    @property
    def name(self) -> str:
        return "example"

    async def check(self) -> HealthCheckResult:
        return HealthCheckResult(status=HealthStatus.PASS)


# ── Server ────────────────────────────────────────────────────


def main() -> None:
    # First CLI arg overrides the default port (e.g. `python -m example.example 9090`).
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080

    api = ModularApi(
        base_path="/api",
        title="Modular API",
        version="1.0.0",
        metrics_enabled=True,
        log_level=LogLevel.debug,
    )

    api.add_health_check(AlwaysPassHealthCheck())

    if api.metrics:
        api.metrics.create_counter(
            name="greetings_total",
            help="Total number of greetings sent.",
        )

    api.module("greetings", build_greetings_module)

    print("====================================")
    print(f"API  → http://localhost:{port}/api/greetings/hello")
    print(f"Docs → http://localhost:{port}/docs")
    print("====================================")

    api.serve(port=port)


if __name__ == "__main__":
    main()
