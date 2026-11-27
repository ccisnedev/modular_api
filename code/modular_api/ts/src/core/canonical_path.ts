// ============================================================
// core/canonical_path.ts
// Rejects non-canonical paths before any user middleware runs (issue #47).
// ============================================================

import type { RequestHandler } from 'express';

/**
 * Options for every router ModularApi creates when strict routing is on: a path that differs in
 * case or by a trailing slash does not resolve to a route.
 */
export const STRICT_ROUTER_OPTIONS = { caseSensitive: true, strict: true } as const;

/**
 * Answers 404 to a path with repeated slashes or a trailing slash (except `/`), the same way Dart
 * does. Express would otherwise resolve some of those variants to a route while a middleware that
 * compares `req.path` exactly does not recognize them.
 */
export const canonicalPathMiddleware: RequestHandler = (req, res, next) => {
  if (isCanonicalPath(req.path)) {
    next();
    return;
  }
  res.status(404).json({ error: 'Not found' });
};

/** True when the path has no empty segment: no `//` and no trailing slash, except the root. */
export function isCanonicalPath(path: string): boolean {
  if (path === '/') return true;
  return !path.includes('//') && !path.endsWith('/');
}

export const STRICT_ROUTING_DEPRECATION =
  '[modular_api] strictRouting: false is deprecated and will be removed in a future minor. ' +
  'It lets case, trailing-slash and double-slash variants of a path reach a use case, so a ' +
  'middleware that compares req.path exactly can be bypassed (issue #47).';
