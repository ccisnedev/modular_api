// ============================================================
// core/module_builder.ts
// ModuleBuilder — collects use cases and mounts them on a Router.
// Mirror of ModuleBuilder in Dart.
// ============================================================

import { Router } from 'express';
import type { Input, Output, UseCaseFactory } from './usecase';
import { UseCase, buildSchemaFromMetadata } from './usecase';
import { useCaseHandler } from './usecase_handler';
import { apiRegistry } from './registry';
import { getFieldMetadata } from './schema/field';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface UseCaseOptions {
  /** HTTP method. Defaults to POST (same as Dart version). */
  method?: HttpMethod;
  summary?: string;
  description?: string;

  /**
   * Input DTO class constructor (e.g. `HelloInput`).
   * When provided, schema is extracted from `@Field` decorator metadata
   * without calling `factory({})` — zero instantiation, zero concurrency risk.
   *
   * Required when `fromJson` validates input (the recommended pattern).
   */
  inputType?: abstract new (...args: unknown[]) => Input;
  /**
   * Output DTO class constructor (e.g. `HelloOutput`).
   * Same benefit as `inputType` — schema extracted from class metadata.
   */
  outputType?: abstract new (...args: unknown[]) => Output;

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
    const { method = 'POST', summary, description, inputType, outputType, inputSchema, outputSchema } = options;

    // Normalize name: trim and remove leading slash
    const cleanName = name.trim().replace(/^\//, '');
    const subPath = `/${cleanName}`;
    const methodL = method.toLowerCase() as Lowercase<HttpMethod>;

    // Mount the Express handler
    this.router[methodL](subPath, useCaseHandler(factory));

    // Try to capture schemas: explicit types → decorator metadata → factory({}) fallback
    const extracted = this._extractSchemas(factory, inputType, outputType);
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
   * Capture Input and Output schemas from decorator metadata or a dummy factory call.
   *
   * Strategy (in order of preference):
   * 1. Class metadata: use `@Field` decorator metadata from the explicit
   *    inputType/outputType class constructors — no instantiation needed.
   *    Required when `fromJson` validates input (the recommended pattern).
   * 2. Fallback: call factory({}) and invoke toSchema() on the result.
   *    Works when `fromJson` is tolerant of empty data (legacy pattern).
   */
  private _extractSchemas<I extends Input, O extends Output>(
    factory: UseCaseFactory<I, O>,
    inputType?: abstract new (...args: unknown[]) => Input,
    outputType?: abstract new (...args: unknown[]) => Output,
  ): { input: Record<string, unknown>; output: Record<string, unknown> } {
    let input: Record<string, unknown> = {};
    let output: Record<string, unknown> = {};

    // --- Strategy 1: class metadata — zero instantiation, zero concurrency risk ---
    if (inputType) {
      const fields = getFieldMetadata(inputType);
      if (fields.length > 0) input = buildSchemaFromMetadata(fields);
    }
    if (outputType) {
      const fields = getFieldMetadata(outputType);
      if (fields.length > 0) output = buildSchemaFromMetadata(fields);
    }

    // --- Strategy 2: factory({}) fallback for backward compatibility ---
    if (Object.keys(input).length === 0 || Object.keys(output).length === 0) {
      let instance: UseCase<I, O> | undefined;
      try {
        instance = factory({});
      } catch {
        // factory({}) failed — keep partial results from Strategy 1.
      }

      if (instance) {
        if (Object.keys(input).length === 0) {
          try { input = instance.input.toSchema(); } catch { /* keep empty */ }
        }
        if (Object.keys(output).length === 0) {
          try { output = instance.output.toSchema(); } catch { /* keep empty */ }
        }
      }
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
