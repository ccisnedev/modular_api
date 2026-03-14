/**
 * RED — fromJson must validate required fields and types, returning 400.
 *
 * fromJson validates structure (field presence + JSON type correctness).
 * validate() handles only business rules.
 *
 * Error message contract (identical across all 3 SDKs for parity):
 *   - Missing required field: "Missing required field: {name}"
 *   - Wrong JSON type:        "Field '{name}' must be of type {type}"
 */

import { describe, it, expect } from 'vitest';
import { Input, Field, InputValidationError } from '../src/index';

// ── Stubs ────────────────────────────────────────────────────────────────

class StrictInput extends Input {
  @Field.string({ description: 'Name' })
  name!: string;

  @Field.integer({ description: 'Age' })
  age!: number;

  static fromJson(json: Record<string, unknown>): StrictInput {
    Input.validateJson(json, StrictInput);
    const instance = new StrictInput();
    instance.name = json['name'] as string;
    instance.age = json['age'] as number;
    return instance;
  }
}

// ── Unit: validateJson rejects missing fields and wrong types ────────────

describe('Input.validateJson', () => {
  it('throws InputValidationError for missing required field', () => {
    expect(() => Input.validateJson({}, StrictInput)).toThrow(
      InputValidationError,
    );
    expect(() => Input.validateJson({}, StrictInput)).toThrow(
      'Missing required field: name',
    );
  });

  it('throws InputValidationError for wrong type (int where string expected)', () => {
    expect(
      () => Input.validateJson({ name: 123, age: 25 }, StrictInput),
    ).toThrow(InputValidationError);
    expect(
      () => Input.validateJson({ name: 123, age: 25 }, StrictInput),
    ).toThrow("Field 'name' must be of type string");
  });

  it('throws InputValidationError for wrong type (string where integer expected)', () => {
    expect(
      () => Input.validateJson({ name: 'Alice', age: 'twenty-five' }, StrictInput),
    ).toThrow(InputValidationError);
    expect(
      () => Input.validateJson({ name: 'Alice', age: 'twenty-five' }, StrictInput),
    ).toThrow("Field 'age' must be of type integer");
  });

  it('does not throw for valid JSON', () => {
    expect(
      () => Input.validateJson({ name: 'Alice', age: 25 }, StrictInput),
    ).not.toThrow();
  });

  it('fromJson returns valid instance', () => {
    const input = StrictInput.fromJson({ name: 'Alice', age: 25 });
    expect(input.name).toBe('Alice');
    expect(input.age).toBe(25);
  });
});
