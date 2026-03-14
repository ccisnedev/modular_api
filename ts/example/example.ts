/**
 * example/example.ts
 * Minimal runnable example — mirrors example/example.dart from the Dart version.
 *
 * Run:
 *   npx ts-node example/example.ts
 *
 * Then test:
 *   curl -X POST http://localhost:8080/api/greetings/hello \
 *        -H "Content-Type: application/json" \
 *        -d '{"name":"World"}'
 *
 * Docs:
 *   http://localhost:8080/docs
 */

import {
  Input,
  Output,
  UseCase,
  ModularApi,
  ModuleBuilder,
  HealthCheck,
  HealthCheckResult,
  LogLevel,
  Field,
} from '../src/index';

// ─── Module Builder ───────────────────────────────────────────────────────────
// In a real project, this would live in its own file:
//   src/modules/greetings/greetings_builder.ts

function buildGreetingsModule(m: ModuleBuilder): void {
  m.usecase('hello', HelloWorld.fromJson, {
    inputClass: HelloInput,
    outputClass: HelloOutput,
  });
}

// ─── Input DTO ────────────────────────────────────────────────────────────────

class HelloInput extends Input {
  @Field.string({ description: 'Name to greet', example: 'World' })
  name!: string;

  /// Strict factory — no coercion, no defaults.
  /// Pre-validation in the handler ensures data is valid before this runs.
  static fromJson(json: Record<string, unknown>): HelloInput {
    const instance = new HelloInput();
    instance.name = json['name'] as string;
    return instance;
  }
}

// ─── Output DTO ───────────────────────────────────────────────────────────────

class HelloOutput extends Output {
  @Field.string({ description: 'Greeting message', example: 'Hello, World!' })
  message!: string;

  get statusCode() {
    return 200;
  }
}

// ─── UseCase ──────────────────────────────────────────────────────────────────

class HelloWorld implements UseCase<HelloInput, HelloOutput> {
  readonly input: HelloInput;
  logger?: import('../src/core/logger/logger').ModularLogger;

  constructor(input: HelloInput) {
    this.input = input;
  }

  static fromJson(json: Record<string, unknown>): HelloWorld {
    return new HelloWorld(HelloInput.fromJson(json));
  }

  validate(): string | null {
    if (!this.input.name) {
      return 'name is required';
    }
    return null;
  }

  async execute(): Promise<HelloOutput> {
    this.logger?.info(`Greeting user: ${this.input.name}`);
    const output = new HelloOutput();
    output.message = `Hello, ${this.input.name}!`;
    return output;
  }
}

// ─── Example Health Check ─────────────────────────────────────────────────────
// In a real project you'd check a database connection, external service, etc.

class AlwaysPassHealthCheck extends HealthCheck {
  readonly name = 'example';

  async check(): Promise<HealthCheckResult> {
    return new HealthCheckResult('pass');
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

// First CLI arg overrides the default port (e.g. `npx tsx example/example.ts 9090`).
const port = Number(process.argv[2]) || 8080;

const api = new ModularApi({
  basePath: '/api',
  title: 'Modular API',
  version: '1.0.0',
  metricsEnabled: true,
  logLevel: LogLevel.debug,
});

// Register health checks (optional — /health works without any checks)
api.addHealthCheck(new AlwaysPassHealthCheck());

// Register a custom metric (optional).
if (api.metrics) {
  api.metrics.createCounter({
    name: 'greetings_total',
    help: 'Total number of greetings sent.',
  });
}

api.module('greetings', buildGreetingsModule);

api.serve({ port });
