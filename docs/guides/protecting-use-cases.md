# Protecting use cases

How to write an authentication or authorization middleware that cannot be
bypassed by writing a path differently. Applies to the three SDKs since 0.8.0
(issue #47).

## Why comparing the raw path is unsafe

A guard like this one looks correct:

```ts
// DON'T: a list of protected paths
api.use((req, res, next) => {
  if (req.path === '/api/payments/execute' && !isAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});
```

It protects the path *as written in the condition*. Any other spelling that the
router still resolves to the same use case skips the check. Before 0.8.0 the
TypeScript SDK resolved `/api/payments/execute/`, `/API/Payments/Execute` and
`/api/payments//execute` to the use case, so this guard was an auth bypass.

Strict routing closes those variants in the three SDKs, but the pattern stays
fragile: it fails **open**. Every use case you add is public until someone
remembers to add its path to the list.

## Deny by default

Invert the list. Everything requires authentication unless it is explicitly
public, and decide by **what will run**, not by the raw path:

- For use cases, read the resolved route the framework attaches to every request
  before any plugin or custom middleware runs: `{ module, useCase, method, path }`,
  or nothing on a 404, a 405, or an endpoint that is not a use case.
- For the few non-use-case endpoints that must stay public (health for the
  orchestrator's probes, for example), an exact path comparison is fine **in an
  allow-list**: a variant is not in the list, so it is denied. Exact comparison
  fails closed in an allow-list and open in a deny-list.

| SDK | Read the resolved use case |
|---|---|
| TypeScript | `resolvedRoute(res)` (stored in `res.locals.modularRoute`) |
| Python | `resolved_route(request)` (stored in `scope["modular_api.route"]`) |
| Dart | `resolvedRoute(request)` (stored in `request.context['modular.route']`) |

A HEAD request resolves to the GET use case, because the three routers run the
GET handler for it.

### TypeScript

```ts
import type { RequestHandler } from 'express';
import { resolvedRoute } from '@macss/modular-api';

const PUBLIC_USE_CASES = new Set(['auth.login', 'catalog.list']); // module.useCase
const PUBLIC_PATHS = new Set(['/api/health']); // exact, allow-list only

const requireAuth: RequestHandler = (req, res, next) => {
  const route = resolvedRoute(res);
  const isPublic =
    (route !== undefined && PUBLIC_USE_CASES.has(`${route.module}.${route.useCase}`)) ||
    PUBLIC_PATHS.has(req.path);

  if (isPublic || isAuthenticated(req)) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
```

### Python

```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from modular_api import resolved_route

PUBLIC_USE_CASES = {("auth", "login"), ("catalog", "list")}
PUBLIC_PATHS = {"/api/health"}  # exact, allow-list only


class RequireAuth(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        route = resolved_route(request)
        is_public = (
            route is not None and (route.module, route.use_case) in PUBLIC_USE_CASES
        ) or request.url.path in PUBLIC_PATHS

        if is_public or is_authenticated(request):
            return await call_next(request)
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
```

### Dart

```dart
import 'package:modular_api/modular_api.dart';

const publicUseCases = {'auth.login', 'catalog.list'};
const publicPaths = {'/api/health'}; // exact, allow-list only

Middleware requireAuth() => (inner) => (request) {
      final route = resolvedRoute(request);
      final isPublic = (route != null &&
              publicUseCases.contains('${route.module}.${route.useCase}')) ||
          publicPaths.contains(request.requestedUri.path);

      if (isPublic || isAuthenticated(request)) return inner(request);
      return Response(401, body: '{"error":"Unauthorized"}');
    };
```

## Where to register the guard

Register it in the `preRouting` plugin slot to cover everything, including
routers mounted with `api.use()`. A guard in `preHandler`, or one registered with
`api.use()` after a router, does not run before those routers. See the
[security warning in the request lifecycle](../concepts/request-lifecycle.md#security-warning-prehandler-does-not-protect-apiuse-routers).

A deny-by-default guard also answers 401 to paths that do not exist. That is
intended: an unauthenticated client learns nothing about which paths exist.

## Strict routing

A use case is reachable only through its canonical path, the one in the OpenAPI
document:

| Request path | TypeScript | Python | Dart |
|---|---|---|---|
| `/api/payments/execute` (canonical) | use case | use case | use case |
| `/api/payments/execute/` (trailing slash) | 404 | 307 to the canonical path | 404 |
| `/API/Payments/Execute` (case) | 404 | 404 | 404 |
| `/api/payments//execute` (double slash) | 404 | 404 | 404 |

The table is a regression test in each SDK (`test/routing/` in TS and Dart,
`tests/test_routing.py` in Python).

In TypeScript, repeated slashes and a trailing slash are answered
`404 {"error":"Not found"}` right after the `preRouting` slot, before the
middlewares registered with `api.use()`; a different case falls through to the
router's 404. `new ModularApi({ strictRouting: false })` restores the permissive
routing of 0.7.x for a migration period and logs a deprecation warning at
startup. Even then `resolvedRoute(res)` matches only the canonical path, so a
deny-by-default guard keeps denying the variants.

## Checklist

- [ ] The guard decides by the resolved use case, not by `req.path`.
- [ ] The only path comparisons are in an allow-list of public endpoints.
- [ ] Nothing is public unless it is listed.
- [ ] The guard is in `preRouting` (or before every `api.use()` router).
- [ ] TypeScript: `strictRouting` is not set to `false`.
