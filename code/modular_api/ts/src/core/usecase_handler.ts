// ============================================================
// core/usecase_handler.ts
// Express RequestHandler adapter for any UseCase.
// Mirror of useCaseHttpHandler() in Dart (Shelf).
// ============================================================

import type { Request, Response, RequestHandler } from 'express';
import type { UseCase, UseCaseFactory, Output } from './usecase';
import { Input } from './usecase';
import { UseCaseException } from './use_case_exception';
import { InputValidationError } from './input_validation_error';
import { LOGGER_LOCALS_KEY } from './logger/logging_middleware';
import type { ModularLogger } from './logger/logger';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export interface UseCaseHandlerOptions {
  /** Input class for pre-validation before fromJson (enables strict factories). */
  inputClass?: abstract new (...args: never[]) => Input;
}

/**
 * Wraps any UseCase factory into an Express RequestHandler.
 *
 * Lifecycle (mirrors Dart useCaseHttpHandler):
 *   1. Parse body (POST/PUT/PATCH) or query params (GET/DELETE)
 *   2. Pre-validate against @Field metadata (when inputClass provided)
 *   3. Build UseCase via factory(json)
 *   4. Post-validate (legacy fallback when no inputClass)
 *   5. Call validate() — return 400 if error string returned
 *   6. Call execute()
 *   7. Return output.toJson() with output.statusCode
 *
 * Errors:
 *   - Body that is not a JSON object, or a TypeError/SyntaxError/RangeError thrown by fromJson
 *                          → 400 (the cause is logged at warning level, not returned)
 *   - InputValidationError → 400 with structured error message
 *   - UseCaseException     → statusCode from exception, structured JSON body
 *   - Any other Error      → 500 Internal Server Error
 *
 * Usage:
 * ```ts
 * router.post('/hello', useCaseHandler(SayHello.fromJson, { inputClass: HelloInput }));
 * ```
 */
export function useCaseHandler<I extends Input, O extends Output>(
  factory: UseCaseFactory<I, O>,
  options: UseCaseHandlerOptions = {},
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Extract payload
      const isQuery = req.method.toUpperCase() === 'GET' || req.method.toUpperCase() === 'DELETE';
      const body: unknown = isQuery ? undefined : req.body;
      // express.json() accepts objects and arrays; only an object can be the use case input.
      if (!isQuery && (Array.isArray(body) || (body !== undefined && typeof body !== 'object'))) {
        badRequest(res, 'Request body must be a JSON object');
        return;
      }
      const data: Record<string, unknown> = isQuery
        ? { ...req.query, ...req.params }
        : ((body as Record<string, unknown> | null) ?? {});

      // 2. Pre-validate BEFORE fromJson (when inputClass provided)
      if (options.inputClass) {
        Input.validateJson(data, options.inputClass);
      }

      // 3. Build use case. fromJson only maps untrusted input into the use case input, so a
      //    TypeError, SyntaxError or RangeError thrown there means the body has the wrong shape:
      //    a client error. UseCaseException and InputValidationError keep their own handling.
      let useCase: UseCase<I, O>;
      try {
        useCase = factory(data);
      } catch (err) {
        if (err instanceof TypeError || err instanceof SyntaxError || err instanceof RangeError) {
          badRequest(res, 'Invalid request body', err);
          return;
        }
        throw err;
      }

      // 3a. Post-validate for legacy path (no inputClass)
      if (!options.inputClass) {
        Input.validateJson(
          data,
          useCase.input.constructor as abstract new (...args: never[]) => unknown,
        );
      }

      // 2b. Inject request-scoped logger (if logging middleware is active)
      const logger = res.locals[LOGGER_LOCALS_KEY] as ModularLogger | undefined;
      if (logger) {
        useCase.logger = logger;
      }

      // 3. Validate
      const validationError = useCase.validate();
      if (validationError !== null) {
        res.status(400).set(JSON_HEADERS).json({ error: validationError });
        return;
      }

      // 4. Execute
      const output = await useCase.execute();

      // 5. Respond
      res.status(output.statusCode).set(JSON_HEADERS).json(output.toJson());
    } catch (err) {
      const logger = res.locals[LOGGER_LOCALS_KEY] as ModularLogger | undefined;

      if (err instanceof InputValidationError) {
        res.status(400).set(JSON_HEADERS).json({ error: err.message });
        return;
      }
      if (err instanceof UseCaseException) {
        logger?.error('UseCaseException', { error: err.toString(), status: err.statusCode });
        res.status(err.statusCode).set(JSON_HEADERS).json(err.toJson());
        return;
      }
      logger?.error('Unexpected error in use case handler', { error: String(err) });
      res.status(500).set(JSON_HEADERS).json({ error: 'Internal server error' });
    }
  };
}

/** A 400 for a body that cannot become the use case input; the cause is logged, never returned. */
function badRequest(res: Response, message: string, cause?: Error): void {
  const logger = res.locals[LOGGER_LOCALS_KEY] as ModularLogger | undefined;
  logger?.warning(message, {
    status: 400,
    ...(cause ? { error: `${cause.name}: ${cause.message}` } : {}),
  });
  res.status(400).set(JSON_HEADERS).json({ error: message });
}
