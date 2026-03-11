import { describe, it, expect, afterEach } from 'vitest';
import { Input, Output, UseCase, ModuleBuilder } from '../src';
import { apiRegistry } from '../src/core/registry';
import { Router } from 'express';

// ── Stubs: mirrors the example HelloWorld pattern ────────────

class GreetInput extends Input {
  constructor(readonly name: string) {
    super();
  }

  static fromJson(json: Record<string, unknown>): GreetInput {
    return new GreetInput((json['name'] ?? '').toString());
  }

  toJson() {
    return { name: this.name };
  }

  toSchema() {
    return {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name to greet' },
      },
      required: ['name'],
    };
  }
}

class GreetOutput extends Output {
  constructor(readonly message: string) {
    super();
  }

  get statusCode() {
    return 200;
  }

  toJson() {
    return { message: this.message };
  }

  toSchema() {
    return {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Greeting message' },
      },
      required: ['message'],
    };
  }
}

/**
 * UseCase with output initialised to a default in constructor — same pattern as
 * Dart's HelloWorld. Enables framework schema extraction via factory({}).
 */
class UninitOutputUseCase extends UseCase<GreetInput, GreetOutput> {
  readonly input: GreetInput;
  output: GreetOutput;

  constructor(input: GreetInput) {
    super();
    this.input = input;
    this.output = new GreetOutput('');
  }

  static fromJson(json: Record<string, unknown>): UninitOutputUseCase {
    return new UninitOutputUseCase(GreetInput.fromJson(json));
  }

  validate() {
    return null;
  }

  async execute() {
    this.output = new GreetOutput(`Hello, ${this.input.name}!`);
  }

  toJson() {
    return this.output.toJson();
  }
}

// ── Tests ────────────────────────────────────────────────────

describe('ModuleBuilder schema extraction', () => {
  afterEach(() => {
    apiRegistry.clear();
  });

  it('captures Input schema even when Output is uninitialized', () => {
    const builder = new ModuleBuilder('/api', 'greetings', Router());
    builder.usecase('hello', UninitOutputUseCase.fromJson);

    const registration = apiRegistry.routes[0];
    expect(registration.schemas.input).toHaveProperty('properties');
    expect(registration.schemas.input.properties).toHaveProperty('name');
  });

  it('input schema properties.name.type is string', () => {
    const builder = new ModuleBuilder('/api', 'greetings', Router());
    builder.usecase('hello', UninitOutputUseCase.fromJson);

    const inputSchema = apiRegistry.routes[0].schemas.input as Record<string, unknown>;
    const properties = inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties.name.type).toBe('string');
  });

  it('captures Output schema even when output is uninitialized in constructor', () => {
    const builder = new ModuleBuilder('/api', 'greetings', Router());
    builder.usecase('hello', UninitOutputUseCase.fromJson);

    const outputSchema = apiRegistry.routes[0].schemas.output as Record<string, unknown>;
    expect(outputSchema).toHaveProperty('properties');

    const properties = outputSchema.properties as Record<string, Record<string, unknown>>;
    expect(properties).toHaveProperty('message');
    expect(properties.message.type).toBe('string');
  });
});
