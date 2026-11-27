# Pitfalls

Real traps reported by the first production consumers of modular_api, with the
symptom you will actually see, the root cause, and the verified fix.

| # | Symptom | Cause | Solution |
|---|---|---|---|
| 1 | `Error: <Name>.toJson() not implemented. Use @Field decorators or override toJson().` at runtime/production, even though the DTO has `@Field` decorators. Since 0.7.3 it fails earlier, when the class is defined: `TypeError: @Field on '<field>' was not called as a TC39 Stage 3 decorator` | `experimentalDecorators: true` in the **consumer's** tsconfig. `@Field` is a TC39 Stage 3 decorator; the legacy flag compiles it with the legacy calling convention, `context.metadata` is never populated, and the field metadata is never registered | Remove `experimentalDecorators` from ALL tsconfig files in the project (including any tsconfig the project `extends`, and `tsconfig.test.json`) |
| 2 | `SyntaxError: Invalid or unexpected token` importing a DTO under vitest, or `TypeError` mentioning `Symbol(FieldMeta)` when `@Field` runs | rolldown-vite (vite 8) transforms TS with OXC: OXC cannot parse Stage 3 decorators, and `OxcOptions` omits `tsconfig`, so the previously documented workaround is silently ignored; `decorator.legacy: true` changes the calling convention and breaks `@Field` | Use vitest 4.0.x with standard vite 7 (esbuild), no transform options, and no `experimentalDecorators` anywhere. See the [testing guide](guides/testing.md) (closes issue #19) |
| 3 | A security guard (auth middleware) registered in the `preHandler` plugin slot does not protect routes mounted with `api.use(router)` — they respond without ever hitting the guard | User middlewares registered via `api.use()` run **before** the `preHandler` slot in the pipeline | Register the guard in the `preRouting` slot to protect everything. See [request lifecycle](concepts/request-lifecycle.md) |
| 4 | After upgrading from <= 0.4.4, container/orchestrator healthchecks against `/health` fail (404) and the service is killed/marked unhealthy | Operational endpoints (health, metrics, docs, openapi) moved under the configured `basePath` in the 0.4.x line (since 0.4.7) | Point healthchecks to `{basePath}/health` (e.g. `/api/v1/health`); same for `/metrics` scrape configs. See [operational plugins](concepts/operational-plugins.md) |
| 5 | A plugin middleware intended for one route runs on **every** request (or appears to "leak" into unrelated endpoints) | Plugin middlewares are global by contract — there is no per-route registration in the plugin host | The plugin must self-filter and call `next()` for everything else. Filter use cases by the resolved route (`resolvedRoute(res)` / `resolved_route(request)` / `resolvedRoute(request)`), not by the raw path. See [plugin host](concepts/plugin-host.md) |
| 6 | An auth middleware that checks `req.path === '/api/x/y'` lets `/api/x/y/`, `/API/X/Y` or `/api/x//y` through to the use case (TypeScript up to 0.7.x) | Express routers were permissive (case-insensitive, non-strict); the middleware compared the raw path while the router resolved the variant. Since 0.8.0 routing is strict in the three SDKs, but a list of protected paths still fails open | Deny by default and decide by the resolved route; exact path comparison only in an allow-list of public endpoints. See [Protecting use cases](guides/protecting-use-cases.md) (issue #47) |

Notes:

- Pitfalls 1 and 2 share the same root cause (legacy decorator compilation of a
  Stage 3 decorator) with different symptoms depending on where the code runs
  (Node runtime vs vitest transform).
- When in doubt about pipeline ordering questions (pitfall 3), the authoritative
  diagram is in [concepts/request-lifecycle.md](concepts/request-lifecycle.md),
  verified against `ModularApi.serve()`.
