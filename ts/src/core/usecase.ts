// ============================================================
// core/usecase.ts
// Base classes: Input, Output, UseCase<I, O>
// Mirror of the Dart abstract classes in usecase.dart
// ============================================================

import type { ModularLogger } from './logger/logger';

/**
 * **Contract** — use `implements Input`.
 *
 * Pure interface: all members must be provided by the implementor.
 * No default behavior is inherited — every Input is self-contained.
 *
 * ```ts
 * class HelloInput implements Input {
 *   constructor(readonly name: string) {}
 *   toJson()   { return { name: this.name }; }
 *   toSchema() { return { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }; }
 * }
 * ```
 */
export abstract class Input {
  abstract toJson(): Record<string, unknown>;

  /**
   * Returns an OpenAPI-compatible JSON Schema describing this input.
   * Used to auto-generate Swagger documentation.
   */
  abstract toSchema(): Record<string, unknown>;
}

/**
 * **Contract** — use `implements Output`.
 *
 * Pure interface: all members must be provided by the implementor.
 * The implementor must define `statusCode` explicitly — this forces
 * developers to think about HTTP status codes for every response.
 *
 * ```ts
 * class HelloOutput implements Output {
 *   constructor(readonly message: string) {}
 *   get statusCode() { return 200; }
 *   toJson()   { return { message: this.message }; }
 *   toSchema() { return { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] }; }
 * }
 * ```
 */
export abstract class Output {
  abstract toJson(): Record<string, unknown>;
  abstract toSchema(): Record<string, unknown>;

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
