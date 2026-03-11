// ============================================================
// core/module_builder.ts
// ModuleBuilder — collects use cases and mounts them on a Router.
// Mirror of ModuleBuilder in Dart.
// ============================================================

import { Router } from 'express';
import type { Input, Output, UseCaseFactory } from './usecase';
import { useCaseHandler } from './usecase_handler';
import { apiRegistry } from './registry';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UseCaseOptions {
  /** HTTP method. Defaults to POST (same as Dart version). */
  method?: HttpMethod;
  summary?: string;
  description?: string;
  /** Override input schema for OpenAPI (if fromJson fails with empty data) */
  inputSchema?: Record<string, unknown>;
  /** Override output schema for OpenAPI (if fromJson fails with empty data) */
  outputSchema?: Record<string, unknown>;
}

/**
 * Fluent builder that registers use cases on a module-scoped Express Router.
 * Returned and used inside the callback of `ModularApi.module()`.
 *
 * Dart equivalent:
 *   api.module('users', (m) {
 *     m.usecase('create', CreateUser.fromJson);
 *   });
 *
 * TypeScript:
 *   api.module('users', (m) => {
 *     m.usecase('create', CreateUser.fromJson);
 *   });
 */
export class ModuleBuilder {
  private readonly router: Router;

  constructor(
    private readonly basePath: string,
    private readonly moduleName: string,
    private readonly rootRouter: Router,
  ) {
    this.router = Router();
  }

  /**
   * Registers a use case as an HTTP endpoint.
   *
   * @param name     Route segment, e.g. 'create' → POST /api/users/create
   * @param factory  The static `fromJson` of your UseCase class
   * @param options  Optional HTTP method, summary and description for OpenAPI
   */
  usecase<I extends Input, O extends Output>(
    name: string,
    factory: UseCaseFactory<I, O>,
    options: UseCaseOptions = {},
  ): this {
    const { method = 'POST', summary, description, inputSchema, outputSchema } = options;

    // Normalize name: trim and remove leading slash
    const cleanName = name.trim().replace(/^\//, '');
    const subPath = `/${cleanName}`;
    const methodL = method.toLowerCase() as Lowercase<HttpMethod>;

    // Mount the Express handler
    this.router[methodL](subPath, useCaseHandler(factory));

    // Try to capture schemas via dummy factory call, or use overrides
    const extracted = this._extractSchemas(factory);
    const schemas = {
      input: inputSchema ?? extracted.input,
      output: outputSchema ?? extracted.output,
    };

    // Register in the global registry for OpenAPI generation
    apiRegistry.routes.push({
      module: this.moduleName,
      name: cleanName,
      method: method,
      path: `${this._normalizeBase(this.basePath)}/${this.moduleName}/${cleanName}`,
      factory: factory as UseCaseFactory<Input, Output>,
      schemas,
      doc: {
        summary: summary ?? `Use case ${cleanName} in module ${this.moduleName}`,
        description: description ?? `Auto-generated documentation for ${cleanName}`,
        tags: [this.moduleName],
      },
    });

    return this;
  }

  /**
   * Capture Input and Output schemas independently from a dummy factory call.
   *
   * Each DTO extraction has its own try/catch so a failure in one
   * (e.g. Output not yet initialised) does not destroy the other.
   * Matches Dart's separate _inferInputSchema/_inferOutputSchema pattern.
   */
  private _extractSchemas<I extends Input, O extends Output>(
    factory: UseCaseFactory<I, O>,
  ): { input: Record<string, unknown>; output: Record<string, unknown> } {
    let instance: UseCase<I, O>;
    try {
      instance = factory({});
    } catch {
      // Factory itself failed — both schemas fall back to empty.
      return { input: {}, output: {} };
    }

    let input: Record<string, unknown> = {};
    try {
      input = instance.input.toSchema();
    } catch {
      // Input DTO inaccessible or toSchema() failed — keep empty fallback.
    }

    let output: Record<string, unknown> = {};
    try {
      output = instance.output.toSchema();
    } catch {
      // Output not initialised until execute() — expected for most UseCases.
    }

    return { input, output };
  }

  /** @internal — called by ModularApi after the builder callback runs */
  _mount(): void {
    const mountPath = `${this._normalizeBase(this.basePath)}/${this.moduleName}`;
    this.rootRouter.use(mountPath, this.router);
  }

  private _normalizeBase(p: string): string {
    if (!p) return '';
    return p.startsWith('/') ? p : `/${p}`;
  }
}
