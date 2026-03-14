import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Input/Output with @Field decorators — the new auto-schema pattern

import { Input, Output } from '../src/core/usecase';
import { Field } from '../src/core/schema/field';

class HelloInput extends Input {
  @Field.string({ description: 'Name to greet', example: 'World' })
  name!: string;

  static fromJson(json: Record<string, unknown>): HelloInput {
    const instance = new HelloInput();
    instance.name = (json['name'] ?? '').toString();
    return instance;
  }
}

class HelloOutput extends Output {
  @Field.string({ description: 'Greeting message', example: 'Hello, World!' })
  message!: string;

  get statusCode() {
    return 200;
  }

  static fromJson(json: Record<string, unknown>): HelloOutput {
    const instance = new HelloOutput();
    instance.message = (json['message'] ?? '').toString();
    return instance;
  }
}

const fixturesDir = resolve(__dirname, '../..', 'tests', 'fixtures');

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf-8'));
}

describe('Schema Conformance', () => {
  it('HelloInput schema matches shared fixture', () => {
    const fixture = loadFixture('hello_input_schema.json');
    const input = new HelloInput();
    expect(input.toSchema()).toEqual(fixture);
  });

  it('HelloOutput schema matches shared fixture', () => {
    const fixture = loadFixture('hello_output_schema.json');
    const output = new HelloOutput();
    expect(output.toSchema()).toEqual(fixture);
  });
});
