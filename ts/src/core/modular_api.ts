// ============================================================
// core/modular_api.ts
// ModularApi — main orchestrator.
// Mirror of ModularApi in Dart.
// ============================================================

import express, { type Express, type RequestHandler, type Router } from 'express';
import { ModuleBuilder } from './module_builder';
import { buildOpenApiSpec, openApiJsonHandler, openApiYamlHandler } from '../openapi/openapi';
import { swaggerDocsHandler } from '../openapi/swagger_docs';
import type { HealthCheck } from './health/health_check';
import { HealthService } from './health/health_service';
import { healthHandler } from './health/health_handler';
import { MetricRegistry, MetricsRegistrar } from './metrics/metric_registry';
import { metricsMiddleware, metricsHandler } from './metrics/metrics_middleware';
import { loggingMiddleware } from './logger/logging_middleware';
import { LogLevel } from './logger/logger';
import { apiRegistry } from './registry';
import type { Counter, Gauge, Histogram } from './metrics/metric';

export interface ModularApiOptions {
  /** Base path prefix for all module routes. Default: '/api' */
  basePath?: string;
  /** API title shown in Swagger UI. Default: 'API' */
  title?: string;
  /** API version string (e.g. '1.0.0'). Used in health check response. Default: '0.0.0' */
  version?: string;
  /**
   * Release identifier. Defaults to `version-debug`.
   * Override via `process.env.RELEASE_ID`.
   */
  releaseId?: string;
  /** Opt-in Prometheus metrics endpoint. Default: false */
  metricsEnabled?: boolean;
  /** Path for the metrics endpoint. Default: '/metrics' */
  metricsPath?: string;
  /** Routes excluded from instrumentation. Default: ['/metrics', '/health', '/docs'] */
  excludedMetricsRoutes?: string[];
  /**
   * Minimum log level for the structured JSON logger.
   * Default: LogLevel.info (emits emergency..info, suppresses debug).
   */
  logLevel?: LogLevel;
}

/**
 * Main entry point for modular_api.
 *
 * Dart equivalent:
 * ```dart
 * final api = ModularApi(basePath: '/api');
 * api.module('greetings', (m) => m.usecase('hello', SayHello.fromJson));
 * await api.serve(port: 8080);
 * ```
 *
 * TypeScript equivalent:
 * ```ts
 * const api = new ModularApi({ basePath: '/api' });
 * api.module('greetings', (m) => m.usecase('hello', SayHello.fromJson));
 * await api.serve({ port: 8080 });
 * ```
 *
 * Auto-mounted endpoints:
 *   GET /health  → 200/503 application/health+json (IETF draft)
 *   GET /docs    → Swagger UI
 */
export class ModularApi {
  private readonly app: Express;
  private readonly rootRouter: Router;
  private readonly basePath: string;
  private readonly title: string;
  private readonly middlewares: RequestHandler[] = [];
  private readonly healthService: HealthService;

  // Metrics
  private readonly metricsEnabled: boolean;
  private readonly metricsPath: string;
  private readonly excludedMetricsRoutes: string[];
  private readonly metricRegistry?: MetricRegistry;
  private readonly _metricsRegistrar?: MetricsRegistrar;
  private readonly httpRequestsTotal?: Counter;
  private readonly httpRequestsInFlight?: Gauge;
  private readonly httpRequestDuration?: Histogram;

  // Logging
  private readonly logLevel: LogLevel;

  /** Public accessor for custom-metric registration. Undefined when metrics are disabled. */
  get metrics(): MetricsRegistrar | undefined {
    return this._metricsRegistrar;
  }

  constructor(options: ModularApiOptions = {}) {
    this.basePath = options.basePath ?? '/api';
    this.title = options.title ?? 'Modular API';

    this.healthService = new HealthService({
      version: options.version ?? 'x.y.z',
      releaseId: options.releaseId,
    });

    // Metrics setup
    this.metricsEnabled = options.metricsEnabled ?? false;
    this.metricsPath = options.metricsPath ?? '/metrics';
    this.excludedMetricsRoutes = options.excludedMetricsRoutes ?? ['/metrics', '/health', '/docs'];

    // Logging
    this.logLevel = options.logLevel ?? LogLevel.info;

    if (this.metricsEnabled) {
      this.metricRegistry = new MetricRegistry();
      this._metricsRegistrar = new MetricsRegistrar(this.metricRegistry);
      this.httpRequestsTotal = this.metricRegistry.createCounter({
        name: 'http_requests_total',
        help: 'Total number of HTTP requests.',
        labelNames: ['method', 'route', 'status_code'] as const,
      });
      this.httpRequestsInFlight = this.metricRegistry.createGauge({
        name: 'http_requests_in_flight',
        help: 'Number of HTTP requests currently being processed.',
      });
      this.httpRequestDuration = this.metricRegistry.createHistogram({
        name: 'http_request_duration_seconds',
        help: 'HTTP request duration in seconds.',
        labelNames: ['method', 'route', 'status_code'] as const,
      });
    }

    this.app = express();
    this.app.use(express.json());

    this.rootRouter = express.Router();
  }

  /**
   * Register a {@link HealthCheck} to be evaluated on `GET /health`.
   * Returns `this` for method chaining.
   *
   * ```ts
   * api.addHealthCheck(new DatabaseHealthCheck());
   * ```
   */
  addHealthCheck(check: HealthCheck): this {
    this.healthService.addHealthCheck(check);
    return this;
  }

  /**
   * Registers a group of use cases under a named module.
   * Returns `this` for method chaining.
   *
   * ```ts
   * api
   *   .module('users', (m) => {
   *     m.usecase('create', CreateUser.fromJson);
   *     m.usecase('list',   ListUsers.fromJson, { method: 'GET' });
   *   })
   *   .module('products', buildProductsModule);
   * ```
   */
  module(name: string, build: (m: ModuleBuilder) => void): this {
    const builder = new ModuleBuilder(this.basePath, name, this.rootRouter);
    build(builder);
    builder._mount();
    return this;
  }

  /**
   * Adds an Express middleware to the pipeline.
   * Applied in the order they are registered, before any module handler.
   * Returns `this` for method chaining.
   *
   * ```ts
   * api.use(cors()).use(myAuthMiddleware);
   * ```
   */
  use(middleware: RequestHandler): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Starts the Express server on the given port.
   *
   * Auto-mounts:
   *   GET /health → 200 "ok"
   *   GET /docs   → Swagger UI (built from registered use cases)
   *
   * @returns The Node.js http.Server instance
   */
  serve(options: { port: number; host?: string }): Promise<import('http').Server> {
    const { port, host = '0.0.0.0' } = options;

    return new Promise((resolve) => {
      // Logging middleware FIRST — trace_id + structured JSON logs.
      const excludedLogRoutes = ['/health', this.metricsPath, '/docs', '/docs/'];
      this.app.use(
        loggingMiddleware({
          logLevel: this.logLevel,
          serviceName: this.title,
          excludedRoutes: excludedLogRoutes,
        }),
      );

      // Metrics middleware — before user middlewares & routes.
      // Created here so registeredPaths is populated from apiRegistry.
      if (
        this.metricsEnabled &&
        this.httpRequestsTotal &&
        this.httpRequestsInFlight &&
        this.httpRequestDuration
      ) {
        const registeredPaths = apiRegistry.routes.map((r) => r.path);
        this.app.use(
          metricsMiddleware({
            requestsTotal: this.httpRequestsTotal,
            requestsInFlight: this.httpRequestsInFlight,
            requestDuration: this.httpRequestDuration,
            excludedRoutes: this.excludedMetricsRoutes,
            registeredPaths,
          }),
        );
      }

      // Register middlewares before routes
      for (const mw of this.middlewares) {
        this.app.use(mw);
      }

      // Metrics endpoint (before rootRouter — its own handler).
      if (this.metricsEnabled && this.metricRegistry) {
        this.app.get(this.metricsPath, metricsHandler(this.metricRegistry));
      }

      // Health endpoint — IETF Health Check Response Format
      this.app.get('/health', healthHandler(this.healthService));

      // Module use case routes.
      this.app.use(this.rootRouter);

      // Swagger UI docs — inline HTML, no external dependency (PRD-003).
      this.app.get('/docs', swaggerDocsHandler({ title: this.title }));

      // Raw spec endpoints
      const spec = buildOpenApiSpec({ title: this.title, port });
      this.app.get('/openapi.json', openApiJsonHandler(spec));
      this.app.get('/openapi.yaml', openApiYamlHandler(spec));

      const server = this.app.listen(port, host, () => {
        console.log(`Docs  → http://localhost:${port}/docs`);
        console.log(`Health → http://localhost:${port}/health`);
        console.log(`OpenAPI JSON → http://localhost:${port}/openapi.json`);
        console.log(`OpenAPI YAML → http://localhost:${port}/openapi.yaml`);
        if (this.metricsEnabled) {
          console.log(`Metrics → http://localhost:${port}${this.metricsPath}`);
        }
        resolve(server);
      });
    });
  }
}
