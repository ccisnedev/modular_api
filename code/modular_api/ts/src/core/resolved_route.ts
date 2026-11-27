// ============================================================
// core/resolved_route.ts
// The use case a request resolves to, readable by every middleware (issue #47).
//
// A middleware that protects use cases should decide by what will run, not by
// comparing the raw path. The framework resolves the request against its own
// route table before any plugin or custom middleware runs and stores the result
// in res.locals.
//
// Mirrors `resolved_route` in Python and `resolvedRoute` in Dart.
// ============================================================

import type { RequestHandler, Response } from 'express';

/** `res.locals` key under which the resolved use case is stored. */
export const RESOLVED_ROUTE_LOCALS_KEY = 'modularRoute';

/** A registered use case: its module, command, HTTP method and canonical path. */
export interface ResolvedRoute {
  readonly module: string;
  readonly useCase: string;
  readonly method: string;
  readonly path: string;
}

/**
 * The use case this request will run, or `undefined`.
 *
 * `undefined` means no use case matches the method and path: a 404, a 405, or an operational
 * endpoint such as `/health`. Deny by default: treat `undefined` as "not a public use case".
 */
export function resolvedRoute(res: Response): ResolvedRoute | undefined {
  return res.locals[RESOLVED_ROUTE_LOCALS_KEY] as ResolvedRoute | undefined;
}

/**
 * Stores the resolved use case under {@link RESOLVED_ROUTE_LOCALS_KEY}.
 *
 * Matching is exact on method and path, whatever `strictRouting` says, so a path variant never
 * resolves. HEAD resolves to the GET use case, because Express runs the GET handler for it.
 */
export function routeResolverMiddleware(routes: readonly ResolvedRoute[]): RequestHandler {
  const table = new Map<string, ResolvedRoute>();
  for (const route of routes) table.set(`${route.method} ${route.path}`, route);

  return (req, res, next) => {
    const method = req.method.toUpperCase();
    const route =
      table.get(`${method} ${req.path}`) ??
      (method === 'HEAD' ? table.get(`GET ${req.path}`) : undefined);
    if (route !== undefined) {
      res.locals[RESOLVED_ROUTE_LOCALS_KEY] = route;
    }
    next();
  };
}
