import 'dart:io';
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/logger/logging_middleware.dart';
import 'package:modular_api/src/core/metrics/metric_registry.dart';
import 'package:modular_api/src/core/metrics/metrics_middleware.dart';
import 'package:modular_api/src/core/usecase/usecase_http_handler.dart';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart';

final apiRegistry = _ApiRegistry();

typedef UseCaseFactory = UseCase Function(Map<String, dynamic> json);

class ModularApi {
  final Router _root = Router();
  final List<Middleware> _middlewares = [];
  final String basePath;
  final String title;
  final HealthService _healthService;

  // ── Logger ──
  final LogLevel logLevel;

  // ── Metrics ──
  final bool metricsEnabled;
  final String metricsPath;
  final List<String> _excludedMetricsRoutes;
  MetricRegistry? _metricRegistry;
  MetricsRegistrar? _metricsRegistrar;

  // Built-in metrics (initialised lazily when metricsEnabled).
  Counter? _httpRequestsTotal;
  Gauge? _httpRequestsInFlight;
  Histogram? _httpRequestDuration;

  /// Public accessor for custom-metric registration.
  /// Returns `null` when metrics are disabled.
  MetricsRegistrar? get metrics => _metricsRegistrar;

  /// Creates a new ModularApi instance.
  ///
  /// [version] — API version (e.g. '1.0.0'). Used in health check response.
  /// [releaseId] — Defaults to `version-debug`. Override at compile time:
  ///   `dart compile exe --define=RELEASE_ID=1.2.3 bin/main.dart`
  /// [metricsEnabled] — Opt-in Prometheus metrics at [metricsPath].
  /// [metricsPath] — Path for the metrics endpoint (default `/metrics`).
  /// [excludedMetricsRoutes] — Routes excluded from instrumentation.
  /// [logLevel] — Minimum RFC 5424 severity to emit (default `LogLevel.info`).
  ModularApi({
    this.basePath = '/api',
    this.title = 'Modular API',
    String version = 'x.y.z',
    String? releaseId,
    this.metricsEnabled = false,
    this.metricsPath = '/metrics',
    List<String>? excludedMetricsRoutes,
    this.logLevel = LogLevel.info,
  })  : _healthService = HealthService(
          version: version,
          releaseId: releaseId,
        ),
        _excludedMetricsRoutes = excludedMetricsRoutes ??
            ['/metrics', '/health', '/docs', '/docs/'] {
    if (metricsEnabled) {
      _metricRegistry = MetricRegistry();
      _metricsRegistrar = MetricsRegistrar(_metricRegistry!);
      _httpRequestsTotal = _metricRegistry!.createCounter(
        name: 'http_requests_total',
        help: 'Total number of HTTP requests.',
      );
      _httpRequestsInFlight = _metricRegistry!.createGauge(
        name: 'http_requests_in_flight',
        help: 'Number of HTTP requests currently being processed.',
      );
      _httpRequestDuration = _metricRegistry!.createHistogram(
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds.',
      );
    }
  }

  /// Register a [HealthCheck] to be evaluated on `GET /health`.
  ///
  /// ```dart
  /// api.addHealthCheck(DatabaseHealthCheck());
  /// ```
  ModularApi addHealthCheck(HealthCheck check) {
    _healthService.addHealthCheck(check);
    return this;
  }

  ModularApi module(String name, void Function(ModuleBuilder) build) {
    final m = ModuleBuilder(
      basePath: basePath,
      moduleName: name,
      root: _root,
    );

    build(m);
    m._mount();

    return this;
  }

  ModularApi use(Middleware middleware) {
    _middlewares.add(middleware);
    return this;
  }

  Future<HttpServer> serve({
    InternetAddress? ip,
    required int port,
    Future<void> Function(Router root)? onBeforeServe,
  }) async {
    _root.get('/health', healthHandler(_healthService));

    // Mount /metrics endpoint if enabled.
    if (metricsEnabled && _metricRegistry != null) {
      _root.get(metricsPath, metricsHandler(_metricRegistry!));
    }

    await OpenApi.init(
      title: title,
      port: port,
      // Customize as needed
      // servers: [
      //   {
      //     'url': 'http://192.168.10.18:$port',
      //     'description': 'PROD'
      //   }
      // ],
    );
    // Swagger UI docs — inline HTML, no external dependency (PRD-003).
    _root.get('/docs', swaggerDocsHandler(title: title));
    _root.get('/docs/', swaggerDocsHandler(title: title));
    _root.get('/openapi.json', OpenApi.openapiJson);
    _root.get('/openapi.yaml', OpenApi.openapiYaml);

    if (onBeforeServe != null) {
      await onBeforeServe(_root);
    }

    var pipeline = const Pipeline();

    // Logging middleware FIRST (outermost) to capture full lifecycle
    // including all subsequent middlewares.
    pipeline = pipeline.addMiddleware(
      loggingMiddleware(
        logLevel: logLevel,
        serviceName: title,
        excludedRoutes: ['/health', metricsPath, '/docs', '/docs/'],
      ),
    );

    // Metrics middleware second to capture request lifecycle.
    if (metricsEnabled &&
        _httpRequestsTotal != null &&
        _httpRequestsInFlight != null &&
        _httpRequestDuration != null) {
      pipeline = pipeline.addMiddleware(
        metricsMiddleware(
          requestsTotal: _httpRequestsTotal!,
          requestsInFlight: _httpRequestsInFlight!,
          requestDuration: _httpRequestDuration!,
          excludedRoutes: _excludedMetricsRoutes,
          registeredPaths: apiRegistry.routes.map((r) => r.path).toList(),
        ),
      );
    }

    for (final m in _middlewares) {
      pipeline = pipeline.addMiddleware(m);
    }

    final handler = pipeline.addHandler(_root.call);
    final server = await shelf_io.serve(
      handler,
      ip ?? InternetAddress.anyIPv4,
      port,
    );

    /// Print info
    stdout.writeln('Docs on http://localhost:$port/docs');
    stdout.writeln('Health on http://localhost:$port/health');
    stdout.writeln('OpenAPI JSON on http://localhost:$port/openapi.json');
    stdout.writeln('OpenAPI YAML on http://localhost:$port/openapi.yaml');
    if (metricsEnabled) {
      stdout.writeln('Metrics on http://localhost:$port$metricsPath');
    }

    /// Return server
    return server;
  }
}

class ModuleBuilder {
  final String basePath;
  final String moduleName;
  final Router _root;
  final Router _module = Router();

  ModuleBuilder({
    required this.basePath,
    required this.moduleName,
    required Router root,
  }) : _root = root;

  /// POST by default
  ModuleBuilder usecase(
    String usecaseName,
    UseCaseFactory usecaseFactory, {
    String method = 'POST',
    String? summary,
    String? description,
  }) {
    Handler h = useCaseHttpHandler(usecaseFactory);

    /// Clean usecase name
    usecaseName = usecaseName.trim();

    /// if starts with '/', remove it
    if (usecaseName.startsWith('/')) {
      usecaseName = usecaseName.substring(1);
    }

    final String subPath = '/$usecaseName';
    final String methodU = method.toUpperCase();

    switch (methodU) {
      case 'GET':
        _module.get(subPath, h);
        break;
      case 'PUT':
        _module.put(subPath, h);
        break;
      case 'PATCH':
        _module.patch(subPath, h);
        break;
      case 'DELETE':
        _module.delete(subPath, h);
        break;
      default:
        _module.post(subPath, h);
    }

    // Register metadata for Swagger
    UseCaseDocMeta doc = UseCaseDocMeta(
      summary: summary ?? 'Use case $usecaseName in module $moduleName',
      description:
          description ?? 'Auto-generated documentation for $usecaseName',
      tags: [moduleName],
    );

    apiRegistry.routes.add(
      UseCaseRegistration(
        module: moduleName,
        name: usecaseName,
        method: methodU,
        path: '${_normalizeBase(basePath)}/$moduleName/$usecaseName',
        factory: usecaseFactory,
        doc: doc,
      ),
    );

    return this;
  }

  void _mount() {
    _root.mount('${_normalizeBase(basePath)}/$moduleName', _module.call);
  }

  String _normalizeBase(String p) {
    if (p.isEmpty) return '';
    return p.startsWith('/') ? p : '/$p';
  }
}

class UseCaseDocMeta {
  /// (Optional) summary/description/tags to enrich Swagger
  final String? summary;
  final String? description;

  /// Tags for grouping in Swagger by module
  /// should be the same as the module name
  final List<String>? tags;

  const UseCaseDocMeta({this.summary, this.description, this.tags});
}

class UseCaseRegistration {
  final String module;
  final String name;
  final String method; // "POST" | "GET" | ...
  final String path; // p.ej. "/api/ligo/example"
  final UseCaseFactory factory;
  final UseCaseDocMeta? doc;

  UseCaseRegistration({
    required this.module,
    required this.name,
    required this.method,
    required this.path,
    required this.factory,
    this.doc,
  });
}

class _ApiRegistry {
  final List<UseCaseRegistration> routes = [];
}
