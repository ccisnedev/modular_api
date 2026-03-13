import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Import example DTOs — we need their toSchema() output
// The example file doesn't export, so we replicate the DTO definitions here
// to test against the shared fixture. Once auto-schema lands, these become
// the @Field-decorated versions.

import { Input, Output } from '../../src/core/usecase';

class HelloInput implements Input {
  constructor(readonly name: string) {}

  static fromJson(json: Record<string, unknown>): HelloInput {
    return new HelloInput((json['name'] ?? '').toString());
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

class HelloOutput implements Output {
  constructor(readonly message: string) {}

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

const fixturesDir = resolve(__dirname, '../..', 'tests', 'fixtures');

function loadFixture(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(fixturesDir, name), 'utf-8'));
}

describe('Schema Conformance', () => {
  it('HelloInput schema matches shared fixture', () => {
    const fixture = loadFixture('hello_input_schema.json');
    const input = new HelloInput('test');
    expect(input.toSchema()).toEqual(fixture);
  });

  it('HelloOutput schema matches shared fixture', () => {
    const fixture = loadFixture('hello_output_schema.json');
    const output = new HelloOutput('test');
    expect(output.toSchema()).toEqual(fixture);
  });
});
