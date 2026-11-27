"""The use case a request resolves to, readable by every middleware (#47).

A middleware that protects use cases should decide by what will run, not by comparing the raw
path. The framework resolves the request against its own route table before any plugin or
custom middleware runs and stores the result in the ASGI scope.

Mirrors ``resolvedRoute`` in Dart and TypeScript.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from starlette.requests import HTTPConnection
from starlette.types import ASGIApp, Receive, Scope, Send

ROUTE_SCOPE_KEY = "modular_api.route"


@dataclass(frozen=True)
class ResolvedRoute:
    """A registered use case: its module, command, HTTP method and canonical path."""

    module: str
    use_case: str
    method: str
    path: str


def resolved_route(connection: HTTPConnection | Scope) -> ResolvedRoute | None:
    """Return the use case this request will run, or ``None``.

    ``None`` means no use case matches the method and path: a 404, a 405, or an operational
    endpoint such as ``/health``. Deny by default: treat ``None`` as "not a public use case".
    """
    scope = connection.scope if isinstance(connection, HTTPConnection) else connection
    route = scope.get(ROUTE_SCOPE_KEY)
    return route if isinstance(route, ResolvedRoute) else None


def route_resolver_middleware(routes: Iterable[ResolvedRoute]) -> type:
    """ASGI middleware that stores the resolved use case under ``ROUTE_SCOPE_KEY``.

    Matching is exact on method and path, the same rule the router applies. HEAD resolves to the
    GET use case, because Starlette runs the GET handler for it.
    """
    table = {(route.method, route.path): route for route in routes}

    class _RouteResolverMiddleware:
        def __init__(self, app: ASGIApp) -> None:
            self.app = app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] == "http":
                method = scope["method"]
                path = scope["path"]
                route = table.get((method, path))
                if route is None and method == "HEAD":
                    route = table.get(("GET", path))
                if route is not None:
                    scope[ROUTE_SCOPE_KEY] = route
                else:
                    scope.pop(ROUTE_SCOPE_KEY, None)
            await self.app(scope, receive, send)

    return _RouteResolverMiddleware
