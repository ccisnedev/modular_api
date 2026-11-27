// ============================================================
// core/body_parser_error_handler.ts
// Express error middleware — catches SyntaxError from
// express.json() (body-parser) and returns a structured 400
// with scoped-logger warning (trace_id preserved).
//
// Must be mounted immediately after express.json() in serve().
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { LOGGER_LOCALS_KEY } from './logger/logging_middleware';
import type { ModularLogger } from './logger/logger';

/**
 * Express error-handling middleware for body-parser SyntaxErrors.
 *
 * When `express.json()` encounters malformed JSON, it calls `next(err)`
 * with a `SyntaxError` whose `type` is `'entity.parse.failed'`.
 * This handler intercepts that specific error, logs it through the
 * request-scoped logger (so it carries `trace_id`), and returns a
 * structured 400 response.
 *
 * Any other error is forwarded to the next error handler via `next(err)`.
 */
export function bodyParserErrorHandler(
  err: SyntaxError & { type?: string },
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    const logger = res.locals[LOGGER_LOCALS_KEY] as ModularLogger | undefined;
    logger?.warning('Invalid JSON in request body', {
      error: err.message,
      status: 400,
    });
    res.status(400).json({ error: 'Invalid JSON in request body' });
    return;
  }

  bodyTooLargeErrorHandler(err, req, res, next);
}

/** Body-parser's oversized-body error (`type: 'entity.too.large'`, status 413). */
function isEntityTooLarge(err: unknown): err is Error & {
  type: string;
  status?: number;
  limit?: number;
  length?: number;
} {
  return err instanceof Error && (err as { type?: string }).type === 'entity.too.large';
}

/**
 * Express error-handling middleware for bodies over the JSON limit.
 *
 * body-parser reports `entity.too.large`; without this handler it reached the generic
 * handler as a 500. It answers 413 with the same `{ error }` shape as every other error.
 */
function bodyTooLargeErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (isEntityTooLarge(err)) {
    const logger = res.locals[LOGGER_LOCALS_KEY] as ModularLogger | undefined;
    logger?.warning('Request body too large', {
      status: 413,
      limit: err.limit,
      length: err.length,
    });
    res.status(413).json({ error: 'Request body too large' });
    return;
  }

  next(err);
}
