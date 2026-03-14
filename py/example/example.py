# example/example.py — Minimal runnable example.

# Mirrors ``example/example.dart`` (Dart) and ``example/example.ts`` (TypeScript).

# Run::

#     python -m example.example

# Then test::

#     curl -X POST http://localhost:8080/api/v1/greetings/hello \
#          -H "Content-Type: application/json" \
#          -d '{"name":"World"}'
#     curl http://localhost:8080/api/v1/time/now?tz=utc-5

# Docs::

#     http://localhost:8080/docs

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
        base_path="/api/v1",
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

    api.serve(port=port)


if __name__ == "__main__":
    main()
