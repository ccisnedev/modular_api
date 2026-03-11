"""Main orchestrator — wires modules, middleware, health, metrics, and OpenAPI.

Mirror of ``ModularApi`` in Dart and TypeScript.

Usage::

    from modular_api import ModularApi

    api = ModularApi(base_path="/api", title="My API")
    api.module("users", lambda m: (
        m.usecase("create", CreateUser.from_json),
        m.usecase("list", ListUsers.from_json, method="GET"),
    ))
    api.add_health_check(DatabaseHealthCheck())

    # Build the ASGI app (for testing or custom entrypoint)
    app = api.build()

    # Or start directly with Uvicorn
    api.serve(port=8080)
"""

from __future__ import annotations

from typing import Any, Callable

from starlette.applications import Starlette
from starlette.routing import Mount, Route, Router

from modular_api.core.health.health_check import HealthCheck
from modular_api.core.health.health_handler import health_handler
from modular_api.core.health.health_service import HealthService
from modular_api.core.logger.logger import LogLevel
from modular_api.core.logger.logging_middleware import logging_middleware
from modular_api.core.metrics.metric_registry import MetricRegistry, MetricsRegistrar
from modular_api.core.metrics.metrics_middleware import metrics_handler, metrics_middleware
from modular_api.core.module_builder import ModuleBuilder
from modular_api.core.registry import api_registry
from modular_api.openapi.openapi import (
    build_openapi_spec,
    json_to_yaml,
    openapi_json_handler,
    openapi_yaml_handler,
)
from modular_api.openapi.swagger_docs import swagger_docs_handler


class ModularApi:
    """Assembles modules, middleware, health, metrics, and docs into a Starlette app.

    Provides a fluent builder API — every configuration method returns ``self``
    so calls can be chained.
    """

    def __init__(
        self,
        *,
        base_path: str = "/api",
        title: str = "Modular API",
        version: str = "0.0.0",
        release_id: str | None = None,
        metrics_enabled: bool = False,
        metrics_path: str = "/metrics",
        log_level: LogLevel = LogLevel.info,
    ) -> None:
        self._base_path = base_path
        self._title = title
        self._version = version
        self._release_id = release_id or f"{version}-debug"
        self._metrics_enabled = metrics_enabled
        self._metrics_path = metrics_path
        self._log_level = log_level

        self._health_service = HealthService(version=version, release_id=self._release_id)
        self._module_routers: list[tuple[str, Router]] = []
        self._custom_middlewares: list[type] = []

        # Metrics infrastructure (only when enabled)
        self._metric_registry: MetricRegistry | None = None
        self._metrics_registrar: MetricsRegistrar | None = None
        if metrics_enabled:
            self._metric_registry = MetricRegistry()
            self._metrics_registrar = MetricsRegistrar(self._metric_registry)

    # ── Public properties ─────────────────────────────────────

    @property
    def title(self) -> str:
        return self._title

    @property
    def version(self) -> str:
        return self._version

    @property
    def metrics(self) -> MetricsRegistrar | None:
        """Return the MetricsRegistrar for custom metric creation, or None when disabled."""
        return self._metrics_registrar

    # ── Fluent configuration API ──────────────────────────────

    def module(self, name: str, build: Callable[[ModuleBuilder], Any]) -> ModularApi:
        """Register a group of use cases under a named module."""
        builder = ModuleBuilder(base_path=self._base_path, module_name=name)
        build(builder)
        mount_path = f"{self._normalize_base(self._base_path)}/{name}"
        self._module_routers.append((mount_path, builder.build_router()))
        return self

    def use(self, middleware_factory: Any) -> ModularApi:
        """Add a custom ASGI middleware class (or factory returning one)."""
        self._custom_middlewares.append(middleware_factory)
        return self

    def add_health_check(self, check: HealthCheck) -> ModularApi:
        """Register a HealthCheck to be evaluated on GET /health."""
        self._health_service.add_health_check(check)
        return self

    # ── Application assembly ──────────────────────────────────

    def build(self, *, port: int = 8000) -> Starlette:
        """Assemble and return the Starlette ASGI application.

        Auto-mounts /health, /openapi.json, /openapi.yaml, and
        (when metrics are enabled) the metrics endpoint.
        """
        routes = self._collect_routes(port=port)
        app = Starlette(routes=routes)

        # Middleware pipeline (LIFO — last added is outermost)
        # 1. Custom middlewares (innermost)
        for mw in reversed(self._custom_middlewares):
            app.add_middleware(mw)

        # 2. Metrics middleware (wraps custom + routes)
        if self._metrics_enabled and self._metric_registry is not None:
            requests_total = self._metric_registry.create_counter(
                name="http_requests_total",
                help="Total number of HTTP requests.",
            )
            requests_in_flight = self._metric_registry.create_gauge(
                name="http_requests_in_flight",
                help="Number of HTTP requests currently being processed.",
            )
            request_duration = self._metric_registry.create_histogram(
                name="http_request_duration_seconds",
                help="HTTP request duration in seconds.",
            )
            registered_paths = [r.path for r in api_registry.routes]
            app.add_middleware(
                metrics_middleware(
                    requests_total=requests_total,
                    requests_in_flight=requests_in_flight,
                    request_duration=request_duration,
                    excluded_routes=[self._metrics_path, "/health", "/docs"],
                    registered_paths=registered_paths,
                ),
            )

        # 3. Logging middleware (outermost — wraps everything)
        excluded_log_routes = ["/health", self._metrics_path, "/docs"]
        app.add_middleware(
            logging_middleware(
                log_level=self._log_level,
                service_name=self._title,
                excluded_routes=excluded_log_routes,
            ),
        )

        return app

    def serve(self, *, port: int = 8000, host: str = "0.0.0.0") -> None:
        """Start the server with Uvicorn (blocking call)."""
        import uvicorn  # noqa: PLC0415 — lazy import, only needed at runtime

        app = self.build(port=port)
        uvicorn.run(app, host=host, port=port)

    # ── Private helpers ───────────────────────────────────────

    def _collect_routes(self, *, port: int) -> list[Route | Mount]:
        """Collect all auto-mounted + module routes."""
        routes: list[Route | Mount] = []

        # Health endpoint
        routes.append(Route("/health", endpoint=health_handler(self._health_service)))

        # OpenAPI endpoints
        spec_kwargs: dict[str, Any] = {"title": self._title, "port": port, "version": self._version}
        routes.append(Route("/openapi.json", endpoint=openapi_json_handler(**spec_kwargs)))
        routes.append(Route("/openapi.yaml", endpoint=openapi_yaml_handler(**spec_kwargs)))

        # Swagger UI docs (PRD-003)
        routes.append(Route("/docs", endpoint=swagger_docs_handler(title=self._title)))

        # Metrics endpoint (only when enabled)
        if self._metrics_enabled and self._metric_registry is not None:
            routes.append(Route(self._metrics_path, endpoint=metrics_handler(self._metric_registry)))

        # Module use-case routes
        for mount_path, router in self._module_routers:
            routes.append(Mount(mount_path, app=router))

        return routes

    @staticmethod
    def _normalize_base(path: str) -> str:
        if not path:
            return ""
        return path if path.startswith("/") else f"/{path}"
