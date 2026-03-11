"""Starlette endpoint factory for any UseCase.

Mirrors ``useCaseHttpHandler()`` (Dart/Shelf) and ``useCaseHandler()``
(TypeScript/Express).  Returns an async Starlette endpoint that drives
the full use-case lifecycle: parse → validate → execute → respond.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Callable

from starlette.requests import Request
from starlette.responses import Response

from modular_api.core.use_case_exception import UseCaseException
from modular_api.core.usecase import Input, Output, UseCase

# Key used by LoggingMiddleware to store the request-scoped logger.
LOGGER_STATE_KEY = "modular_logger"

_JSON_CONTENT_TYPE = "application/json; charset=utf-8"

# Type for the factory function that builds a UseCase from parsed JSON.
UseCaseFactory = Callable[[dict[str, Any]], UseCase[Any, Any]]


def usecase_handler(factory: UseCaseFactory) -> Any:
    """Wraps a UseCase factory into an async Starlette endpoint.

    Lifecycle:
      1. Parse body (POST/PUT/PATCH) or query + path params (GET/DELETE).
      2. Build UseCase via ``factory(data)``.
      3. Call ``validate()`` — return 400 if an error string is returned.
      4. Call ``execute()``.
      5. Return ``use_case.to_json()`` with ``output.statusCode``.

    Errors:
      - ``UseCaseException`` → status from exception, structured JSON body.
      - Any other exception  → 500 with generic error (no stack trace).
    """

    async def endpoint(request: Request) -> Response:
        try:
            # 1. Extract payload
            method = request.method.upper()
            if method in ("GET", "DELETE"):
                data: dict[str, Any] = {**dict(request.query_params), **request.path_params}
            else:
                data = await request.json()

                # Guard: request.json() decodes any valid JSON — including bare
                # strings, arrays, or numbers.  Our factories expect a dict.
                if not isinstance(data, dict):
                    return Response(
                        content=json.dumps({"error": "Request body must be a JSON object"}),
                        status_code=400,
                        media_type=_JSON_CONTENT_TYPE,
                    )

            # 2. Build use case
            use_case = factory(data)

            # 2b. Inject request-scoped logger (if logging middleware placed one)
            logger = getattr(request.state, LOGGER_STATE_KEY, None)
            if logger is not None:
                use_case.logger = logger

            # 3. Validate
            validation_error = use_case.validate()
            if validation_error is not None:
                return Response(
                    content=json.dumps({"error": validation_error}),
                    status_code=400,
                    media_type=_JSON_CONTENT_TYPE,
                )

            # 4. Execute
            await use_case.execute()

            # 5. Respond
            return Response(
                content=json.dumps(use_case.to_json()),
                status_code=use_case.output.status_code,
                media_type=_JSON_CONTENT_TYPE,
            )

        except UseCaseException as exc:
            print(f"UseCaseException: {exc}", file=sys.stderr)
            return Response(
                content=json.dumps(exc.to_json()),
                status_code=exc.status_code,
                media_type=_JSON_CONTENT_TYPE,
            )
        except Exception as exc:
            print(f"usecase_handler unexpected error: {exc}", file=sys.stderr)
            return Response(
                content=json.dumps({"error": "Internal server error"}),
                status_code=500,
                media_type=_JSON_CONTENT_TYPE,
            )

    return endpoint
