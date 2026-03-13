// ============================================================
// core/usecase.ts
// Base classes: Input, Output, UseCase<I, O>
// Mirror of the Dart abstract classes in usecase.dart
// ============================================================

import type { ModularLogger } from './logger/logger';
import { getFieldMetadata, type FieldMeta } from './schema/field';

/**
 * Build an OpenAPI 3.0.3 JSON Schema from `@Field` decorator metadata.
 * Shared by both Input and Output base classes.
 */
function buildSchemaFromMetadata(fields: FieldMeta[]): Record<string, unknown> {
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const field of fields) {
    const prop: Record<string, unknown> = { type: field.type };
    if (field.description) prop.description = field.description;
    if (field.nullable) prop.nullable = true;
    if (field.items) prop.items = field.items;
    properties[field.name] = prop;

    if (field.required) {
      required.push(field.name);
    }
  }

  const schema: Record<string, unknown> = { type: 'object', properties };
  if (required.length > 0) {
    schema.required = required;
  }
  return schema;
}

/**
 * Serialize decorated fields from an instance to a plain object.
 * Shared by both Input and Output base classes.
 */
function serializeFromMetadata(instance: Record<string, unknown>, fields: FieldMeta[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    const value = instance[field.name];
    if (value !== undefined) {
      result[field.name] = value;
    }
  }
  return result;
}

/**
 * **Contract** — use `extends Input`.
 *
 * When subclass fields are decorated with `@Field`, `toJson()` and
 * `toSchema()` are provided automatically. Manual overrides still work
 * (deprecated — will be removed in v0.5.0).
 *
 * ```ts
 * class HelloInput extends Input {
 *   @Field.string({ description: 'Name to greet' })
 *   name!: string;
 *
 *   static fromJson(json: Record<string, unknown>) {
 *     const instance = new HelloInput();
 *     instance.name = (json['name'] ?? '').toString();
 *     return instance;
 *   }
 * }
 * ```
 */
export abstract class Input {
  toJson(): Record<string, unknown> {
    const fields = getFieldMetadata(this.constructor as abstract new (...args: unknown[]) => unknown);
    if (fields.length > 0) {
      return serializeFromMetadata(this as unknown as Record<string, unknown>, fields);
    }
    // No decorator metadata — subclass must override (legacy path)
    throw new Error(`${this.constructor.name}.toJson() not implemented. Use @Field decorators or override toJson().`);
  }

  /**
   * Returns an OpenAPI-compatible JSON Schema describing this input.
   * Derived automatically from `@Field` decorators when present.
   */
  toSchema(): Record<string, unknown> {
    const fields = getFieldMetadata(this.constructor as abstract new (...args: unknown[]) => unknown);
    if (fields.length > 0) {
      return buildSchemaFromMetadata(fields);
    }
    // No decorator metadata — subclass must override (legacy path)
    throw new Error(`${this.constructor.name}.toSchema() not implemented. Use @Field decorators or override toSchema().`);
  }
}

/**
 * **Contract** — use `extends Output`.
 *
 * When subclass fields are decorated with `@Field`, `toJson()` and
 * `toSchema()` are provided automatically. The implementor must define
 * `statusCode` explicitly — this forces developers to think about
 * HTTP status codes for every response.
 *
 * ```ts
 * class HelloOutput extends Output {
 *   @Field.string({ description: 'Greeting message' })
 *   message!: string;
 *
 *   get statusCode() { return 200; }
 * }
 * ```
 */
export abstract class Output {
  toJson(): Record<string, unknown> {
    const fields = getFieldMetadata(this.constructor as abstract new (...args: unknown[]) => unknown);
    if (fields.length > 0) {
      return serializeFromMetadata(this as unknown as Record<string, unknown>, fields);
    }
    throw new Error(`${this.constructor.name}.toJson() not implemented. Use @Field decorators or override toJson().`);
  }

  toSchema(): Record<string, unknown> {
    const fields = getFieldMetadata(this.constructor as abstract new (...args: unknown[]) => unknown);
    if (fields.length > 0) {
      return buildSchemaFromMetadata(fields);
    }
    throw new Error(`${this.constructor.name}.toSchema() not implemented. Use @Field decorators or override toSchema().`);
  }

  /**
   * HTTP status code for the response.
   * Must be implemented explicitly (e.g. 200, 201, 400, 404).
   */
  abstract get statusCode(): number;
}

/**
 * Factory function type — the signature every UseCase class must expose
 * as a static method `fromJson`.
 *
 * Dart equivalent:
 *   static MyUseCase fromJson(Map<String, dynamic> json) { ... }
 */
export type UseCaseFactory<I extends Input = Input, O extends Output = Output> = (
  json: Record<string, unknown>,
) => UseCase<I, O>;

/**
 * **Contract** — use `implements UseCase<I, O>`.
 *
 * Pure interface: all members must be provided by the implementor.
 * This mirrors the Dart version where UseCase is 100% abstract.
 *
 * Lifecycle (handled by the framework):
 *   1. `fromJson(json)`    — static factory, builds the use case
 *   2. `validate()`        — return error string or null
 *   3. `execute()`         — run business logic, set `this.output`
 *   4. `output.toJson()`   — serialize and return to HTTP client
 *
 * ```ts
 * class SayHello implements UseCase<HelloInput, HelloOutput> {
 *   input: HelloInput;
 *   output!: HelloOutput;
 *
 *   constructor(input: HelloInput) { this.input = input; }
 *
 *   static fromJson(json: Record<string, unknown>) {
 *     return new SayHello(HelloInput.fromJson(json));
 *   }
 *
 *   validate(): string | null {
 *     if (!this.input.name) return 'name is required';
 *     return null;
 *   }
 *
 *   async execute(): Promise<void> {
 *     this.output = new HelloOutput(`Hello, ${this.input.name}!`);
 *   }
 *
 *   toJson() { return this.output.toJson(); }
 * }
 * ```
 */
export abstract class UseCase<I extends Input, O extends Output> {
  /** Input DTO — set in constructor. */
  abstract readonly input: I;

  /** Output DTO — set in execute(). */
  abstract output: O;

  /**
   * Request-scoped logger injected by the framework's logging middleware.
   * Available inside `execute()`. Undefined when running without middleware
   * or in tests that don't provide one.
   */
  logger?: ModularLogger;

  /**
   * Synchronous validation.
   * Return a human-readable error string to abort execution with HTTP 400.
   * Return null to proceed.
   */
  abstract validate(): string | null;

  /**
   * Business logic. Must set `this.output` before returning.
   * Keep this method free of HTTP concerns.
   */
  abstract execute(): Promise<void>;

  /**
   * Serializes the output DTO to a plain object for the HTTP response.
   * Typically implemented as `return this.output.toJson();`
   */
  abstract toJson(): Record<string, unknown>;
}
