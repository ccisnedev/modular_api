"""Starlette endpoint factory for any UseCase.

Mirrors ``useCaseHttpHandler()`` (Dart/Shelf) and ``useCaseHandler()``
(TypeScript/Express).  Returns an async Starlette endpoint that drives
the full use-case lifecycle: parse → validate → execute → respond.
"""

from __future__ import annotations

import json
from typing import Any, Callable, cast

from pydantic import ValidationError
from starlette.requests import Request
from starlette.responses import Response

from modular_api.core.use_case_exception import UseCaseException
from modular_api.core.usecase import UseCase

# Key used by LoggingMiddleware to store the request-scoped logger.
LOGGER_STATE_KEY = "modular_logger"

_JSON_CONTENT_TYPE = "application/json; charset=utf-8"

# Type for the factory function that builds a UseCase from parsed JSON.
UseCaseFactory = Callable[[dict[str, Any]], UseCase[Any, Any]]

# Maps Pydantic error types to OpenAPI type names for the error message
# "Field '{name}' must be of type {openapi_type}".
_PYDANTIC_ERROR_TO_OPENAPI_TYPE: dict[str, str] = {
    "string_type": "string",
    "int_type": "integer",
    "int_parsing": "integer",
    "float_type": "number",
    "float_parsing": "number",
    "bool_type": "boolean",
    "bool_parsing": "boolean",
    "list_type": "array",
}


def _format_validation_message(field: str, error_type: str) -> str:
    """Produce a parity-safe error message from a Pydantic validation error.

    Returns one of two canonical forms (identical across all 3 SDKs):
      - ``"Missing required field: {name}"``
      - ``"Field '{name}' must be of type {type}"``
    """
    if error_type == "missing":
        return f"Missing required field: {field}"
    openapi_type = _PYDANTIC_ERROR_TO_OPENAPI_TYPE.get(error_type, "the correct type")
    return f"Field '{field}' must be of type {openapi_type}"


def _bad_request(request: Request, message: str, cause: BaseException | None) -> Response:
    """A 400 for a body that cannot become the use case input.

    The cause goes to the log at warning level, never into the response: it is a client error,
    not an unexpected server failure.
    """
    logger = getattr(request.state, LOGGER_STATE_KEY, None)
    if logger is not None:
        fields: dict[str, object] = {"status": 400}
        if cause is not None:
            fields["error"] = f"{type(cause).__name__}: {cause}"
        logger.warning(message, fields=fields)
    return Response(
        content=json.dumps({"error": message}),
        status_code=400,
        media_type=_JSON_CONTENT_TYPE,
    )


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
                # Typed `object`, not `dict[str, Any]`. `request.json()` decodes any valid JSON —
                # a bare string, an array, a number — so the guard below is load-bearing. Declaring
                # the result a dict made a type checker call that guard dead code, which is exactly
                # backwards: the annotation was the thing that was wrong.
                try:
                    payload: object = await request.json()
                except ValueError:  # json.JSONDecodeError, also for an empty body
                    return _bad_request(request, "Invalid JSON in request body", None)

                if not isinstance(payload, dict):
                    return Response(
                        content=json.dumps({"error": "Request body must be a JSON object"}),
                        status_code=400,
                        media_type=_JSON_CONTENT_TYPE,
                    )

                data = cast("dict[str, Any]", payload)

            # 2. Build use case. `from_json` only maps untrusted input into the use case input, so a
            #    TypeError, KeyError or ValueError raised there means the body has the wrong shape:
            #    a client error. Pydantic's ValidationError and UseCaseException keep their own
            #    handling below.
            try:
                use_case = factory(data)
            except (UseCaseException, ValidationError):
                raise
            except (TypeError, KeyError, ValueError) as exc:
                return _bad_request(request, "Invalid request body", exc)

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
            output = await use_case.execute()

            # 5. Respond
            return Response(
                content=json.dumps(output.to_json()),
                status_code=output.status_code,
                media_type=_JSON_CONTENT_TYPE,
            )

        except UseCaseException as exc:
            logger = getattr(request.state, LOGGER_STATE_KEY, None)
            if logger is not None:
                logger.error("UseCaseException", fields={"error": str(exc), "status": exc.status_code})
            return Response(
                content=json.dumps(exc.to_json()),
                status_code=exc.status_code,
                media_type=_JSON_CONTENT_TYPE,
            )
        except ValidationError as exc:
            # Pydantic validation failure during from_json — missing or wrong type.
            first_error = exc.errors()[0]
            field = ".".join(str(loc) for loc in first_error["loc"])
            message = _format_validation_message(field, first_error["type"])
            return Response(
                content=json.dumps({"error": message}),
                status_code=400,
                media_type=_JSON_CONTENT_TYPE,
            )
        except Exception as exc:
            logger = getattr(request.state, LOGGER_STATE_KEY, None)
            if logger is not None:
                logger.error("Unexpected error in use case handler", fields={"error": str(exc)})
            return Response(
                content=json.dumps({"error": "Internal server error"}),
                status_code=500,
                media_type=_JSON_CONTENT_TYPE,
            )

    return endpoint
