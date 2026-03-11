"""Fluent builder that registers use cases on a Starlette Router.

Returned by ``ModularApi.module()`` inside the callback:

    api.module("users", lambda m: (
        m.usecase("create", CreateUser.from_json),
        m.usecase("list", ListUsers.from_json, method="GET"),
    ))

Each ``usecase()`` call mounts an endpoint on the module's Router
and stores metadata in ``api_registry`` for OpenAPI generation.

Mirror of ``ModuleBuilder`` in Dart and TypeScript.
"""

from __future__ import annotations

from typing import Any, Callable

from starlette.routing import Route, Router

from modular_api.core.registry import (
    UseCaseDocMeta,
    UseCaseFactory,
    UseCaseRegistration,
    api_registry,
)
from modular_api.core.usecase import Input, Output, UseCase
from modular_api.core.usecase_handler import usecase_handler


class ModuleBuilder:
    """Collects use cases for one module and mounts them on a Starlette Router.

    The builder provides a fluent API — every ``usecase()`` returns ``self``
    so multiple registrations can be chained.
    """

    def __init__(self, base_path: str, module_name: str) -> None:
        self._base_path = base_path
        self._module_name = module_name
        self._routes: list[Route] = []

    # ── Public API ────────────────────────────────────────────

    def usecase(
        self,
        name: str,
        factory: UseCaseFactory,
        *,
        method: str = "POST",
        summary: str | None = None,
        description: str | None = None,
    ) -> ModuleBuilder:
        """Register a use case as an HTTP endpoint on this module.

        Returns ``self`` for fluent chaining.
        """
        clean_name = name.strip().lstrip("/")
        method_upper = method.upper()
        full_path = f"{self._normalize_base(self._base_path)}/{self._module_name}/{clean_name}"

        # Mount endpoint on internal route list
        self._routes.append(
            Route(f"/{clean_name}", endpoint=usecase_handler(factory), methods=[method_upper]),
        )

        # Capture schemas via a dummy factory call (fail-safe)
        schemas = self._extract_schemas(factory)

        # Register metadata for OpenAPI generation
        doc = UseCaseDocMeta(
            summary=summary or f"Use case {clean_name} in module {self._module_name}",
            description=description or f"Auto-generated documentation for {clean_name}",
            tags=[self._module_name],
        )

        api_registry.routes.append(
            UseCaseRegistration(
                module=self._module_name,
                name=clean_name,
                method=method_upper,
                path=full_path,
                factory=factory,
                schemas=schemas,
                doc=doc,
            ),
        )

        return self

    def build_router(self) -> Router:
        """Create a Starlette Router containing all registered use-case routes."""
        return Router(routes=list(self._routes))

    # ── Private helpers ───────────────────────────────────────

    @staticmethod
    def _extract_schemas(factory: UseCaseFactory) -> dict[str, dict[str, Any]]:
        """Capture Input and Output schemas independently from a dummy factory call.

        Each DTO extraction has its own try/except so a failure in one
        (e.g. Output not yet initialised) does not destroy the other.
        This matches Dart's separate _inferInputSchema/_inferOutputSchema pattern.
        """
        input_schema: dict[str, Any] = {}
        output_schema: dict[str, Any] = {}

        try:
            instance = factory({})
        except Exception:
            # Factory itself failed — both schemas fall back to empty.
            return {"input": input_schema, "output": output_schema}

        try:
            input_schema = instance.input.to_schema()
        except Exception:
            # Input DTO inaccessible or to_schema() failed — keep empty fallback.
            pass

        try:
            output_schema = instance.output.to_schema()
        except Exception:
            # Output not initialised until execute() — expected for most UseCases.
            pass

        return {"input": input_schema, "output": output_schema}

    @staticmethod
    def _normalize_base(path: str) -> str:
        """Ensure base_path starts with '/' (or is empty)."""
        if not path:
            return ""
        return path if path.startswith("/") else f"/{path}"
