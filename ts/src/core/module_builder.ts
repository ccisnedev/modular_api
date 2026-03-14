// ============================================================
// core/module_builder.ts
// ModuleBuilder — collects use cases and mounts them on a Router.
// Mirror of ModuleBuilder in Dart.
// ============================================================

import { Router } from 'express';
import type { Input, Output, UseCaseFactory } from './usecase';
import { UseCase } from './usecase';
import { useCaseHandler } from './usecase_handler';
import { apiRegistry } from './registry';
import { getFieldMetadata } from './schema/field';

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
  /** Input class for pre-validation and schema extraction (enables strict fromJson). */
  inputClass: abstract new (...args: unknown[]) => Input;
  /** Output class for schema extraction. */
  outputClass: abstract new (...args: unknown[]) => Output;
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
    options: UseCaseOptions,
  ): this {
    const { method = 'POST', summary, description, inputSchema, outputSchema, inputClass, outputClass } = options;

    // Normalize name: trim and remove leading slash
    const cleanName = name.trim().replace(/^\//g, '');
    const subPath = `/${cleanName}`;
    const methodL = method.toLowerCase() as Lowercase<HttpMethod>;

    // Mount the Express handler (with optional pre-validation)
    this.router[methodL](subPath, useCaseHandler(factory, { inputClass }));

    // Capture schemas from @Field decorator metadata
    const extracted = this._extractSchemas(inputClass, outputClass);
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
   * Capture Input and Output schemas from decorator metadata.
   *
   * Uses @Field metadata from inputClass/outputClass to build schemas.
   */
  private _extractSchemas<I extends Input, O extends Output>(
    inputClass: abstract new (...args: unknown[]) => Input,
    outputClass: abstract new (...args: unknown[]) => Output,
  ): { input: Record<string, unknown>; output: Record<string, unknown> } {
    let input: Record<string, unknown> = {};
    let output: Record<string, unknown> = {};

    const inputFields = getFieldMetadata(inputClass);
    if (inputFields.length > 0) {
      input = new (inputClass as new () => Input)().toSchema();
    }

    const outputFields = getFieldMetadata(outputClass);
    if (outputFields.length > 0) {
      output = new (outputClass as new () => Output)().toSchema();
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
