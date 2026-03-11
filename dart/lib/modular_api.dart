/// Public library for modular_api package.
/// Use-case centric API toolkit for Dart — Shelf + OpenAPI, nothing more.

library;

// Shelf types
export 'package:shelf/shelf.dart' show Middleware, Handler, Request, Response;

// Core
export 'src/core/modular_api.dart' show ModularApi, ModuleBuilder;
export 'src/core/usecase/usecase.dart' show UseCase, Input, Output;
export 'src/core/usecase/use_case_exception.dart' show UseCaseException;
// Logger
export 'src/core/logger/logger.dart' show LogLevel, ModularLogger;

// Health
export 'src/core/health/health_check.dart'
    show HealthCheck, HealthCheckResult, HealthStatus;
export 'src/core/health/health_service.dart' show HealthService, HealthResponse;
export 'src/core/health/health_handler.dart' show healthHandler;

// Metrics
export 'src/core/metrics/metric.dart'
    show Counter, Gauge, Histogram, MetricSample;
export 'src/core/metrics/metric_registry.dart' show MetricsRegistrar;

// Middlewares
export 'src/middlewares/cors.dart' show exampleCorsMiddleware;

// OpenAPI
export 'src/openapi/openapi.dart' show OpenApi;
export 'src/openapi/swagger_docs.dart' show swaggerDocsHandler;
