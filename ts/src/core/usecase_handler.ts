// ============================================================
// core/usecase_handler.ts
// Express RequestHandler adapter for any UseCase.
// Mirror of useCaseHttpHandler() in Dart (Shelf).
// ============================================================

import type { Request, Response, RequestHandler } from 'express';
import type { UseCaseFactory, Input, Output } from './usecase';
import { UseCaseException } from './use_case_exception';
import { LOGGER_LOCALS_KEY } from './logger/logging_middleware';
import type { ModularLogger } from './logger/logger';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

/**
 * Wraps any UseCase factory into an Express RequestHandler.
 *
 * Lifecycle (mirrors Dart useCaseHttpHandler):
 *   1. Parse body (POST/PUT/PATCH) or query params (GET/DELETE)
 *   2. Build UseCase via factory(json)
 *   3. Call validate() — return 400 if error string returned
 *   4. Call execute()
 *   5. Return output.toJson() with output.statusCode
 *
 * Errors:
 *   - UseCaseException  → statusCode from exception, structured JSON body
 *   - Any other Error   → 500 Internal Server Error
 *
 * Usage:
 * ```ts
 * router.post('/hello', useCaseHandler(SayHello.fromJson));
 * ```
 */
export function useCaseHandler<I extends Input, O extends Output>(
  factory: UseCaseFactory<I, O>,
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Extract payload
      const data: Record<string, unknown> =
        req.method.toUpperCase() === 'GET' || req.method.toUpperCase() === 'DELETE'
          ? { ...req.query, ...req.params }
          : ((req.body as Record<string, unknown>) ?? {});

      // 2. Build use case
      const useCase = factory(data);

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
      await useCase.execute();

      // 5. Respond
      res.status(useCase.output.statusCode).set(JSON_HEADERS).json(useCase.toJson());
    } catch (err) {
      if (err instanceof UseCaseException) {
        console.error('UseCaseException:', err.toString());
        res.status(err.statusCode).set(JSON_HEADERS).json(err.toJson());
        return;
      }
      console.error('useCaseHandler unexpected error:', err);
      res.status(500).set(JSON_HEADERS).json({ error: 'Internal server error' });
    }
  };
}
