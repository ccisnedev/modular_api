import { Input, Output, UseCase, Field, ModularLogger } from '../../../../src/index';

// ─── Input DTO ────────────────────────────────────────────────────────────────

export class HelloInput extends Input {
  @Field.string({ description: 'Name to greet', example: 'World' })
  name!: string;
}

// ─── Output DTO ───────────────────────────────────────────────────────────────

export class HelloOutput extends Output {
  @Field.string({ description: 'Greeting message', example: 'Hello, World!' })
  message!: string;

  get statusCode() {
    return 200;
  }
}

// ─── UseCase ──────────────────────────────────────────────────────────────────

export class HelloWorld implements UseCase<HelloInput, HelloOutput> {
  readonly input: HelloInput;
  logger?: ModularLogger;

  constructor(input: HelloInput) {
    this.input = input;
  }

  static fromJson(json: Record<string, unknown>): HelloWorld {
    const input = new HelloInput();
    input.name = json['name'] as string;
    return new HelloWorld(input);
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
