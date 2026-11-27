// The use case a request resolves to, readable by every middleware (#47).
//
// A middleware that protects use cases should decide by what will run, not by
// comparing the raw path. The framework resolves the request against its own
// route table before any plugin or custom middleware runs and stores the result
// in the request context.
//
// Mirrors `resolved_route` in Python and `resolvedRoute` in TypeScript.

import 'package:shelf/shelf.dart';

/// Request context key under which the resolved use case is stored.
const resolvedRouteContextKey = 'modular.route';

/// A registered use case: its module, command, HTTP method and canonical path.
class ResolvedRoute {
  final String module;
  final String useCase;
  final String method;
  final String path;

  const ResolvedRoute({
    required this.module,
    required this.useCase,
    required this.method,
    required this.path,
  });

  @override
  bool operator ==(Object other) =>
      other is ResolvedRoute &&
      other.module == module &&
      other.useCase == useCase &&
      other.method == method &&
      other.path == path;

  @override
  int get hashCode => Object.hash(module, useCase, method, path);

  @override
  String toString() => 'ResolvedRoute($method $path → $module.$useCase)';
}

/// The use case [request] will run, or `null`.
///
/// `null` means no use case matches the method and path: a 404, a 405, or an
/// operational endpoint such as `/health`. Deny by default: treat `null` as
/// "not a public use case".
ResolvedRoute? resolvedRoute(Request request) {
  final route = request.context[resolvedRouteContextKey];
  return route is ResolvedRoute ? route : null;
}

/// Middleware that stores the resolved use case under [resolvedRouteContextKey].
///
/// Matching is exact on method and path, the same rule the router applies.
/// HEAD resolves to the GET use case, because shelf_router runs the GET handler
/// for it.
Middleware routeResolverMiddleware(Iterable<ResolvedRoute> routes) {
  final table = {for (final r in routes) '${r.method} ${r.path}': r};
  return (inner) => (request) {
        final path = request.requestedUri.path;
        final method = request.method.toUpperCase();
        final route = table['$method $path'] ??
            (method == 'HEAD' ? table['GET $path'] : null);
        if (route == null) return inner(request);
        return inner(request.change(context: {resolvedRouteContextKey: route}));
      };
}
