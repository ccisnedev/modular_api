// ============================================================
// handler/malformed_body.test.ts
// A body that cannot become the use case input is a client
// error: 400, not 500 (issue #44).
// ============================================================

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Input, Output, UseCase, type UseCaseFactory } from '../../src/core/usecase';
import { Field } from '../../src/core/schema/field';
import { useCaseHandler } from '../../src/core/usecase_handler';
import { bodyParserErrorHandler } from '../../src/core/body_parser_error_handler';
import { loggingMiddleware } from '../../src/core/logger/logging_middleware';
import { LogLevel } from '../../src/core/logger/logger';
import { UseCaseException } from '../../src/core/use_case_exception';

class CountInput extends Input {
  @Field.string({ description: 'count' })
  count!: string;
}

class CountOutput extends Output {
  @Field.string({ description: 'count' })
  count!: string;
  get statusCode() {
    return 200;
  }
}

/** A hand-written fromJson that trusts the shape of the body, as fromJson code often does. */
class CountUseCase extends UseCase<CountInput, CountOutput> {
  readonly input: CountInput;
  constructor(input: CountInput) {
    super();
    this.input = input;
  }

  static fromJson(json: Record<string, unknown>): CountUseCase {
    const raw = (json['count'] as string).trim(); // TypeError when missing or not a string
    if (raw === 'boom') {
      throw new UseCaseException({ statusCode: 422, message: 'No boom', errorCode: 'BOOM' });
    }
    const input = new CountInput();
    input.count = BigInt(raw).toString(); // SyntaxError when not an integer
    return new CountUseCase(input);
  }

  validate() {
    return null;
  }

  async execute(): Promise<CountOutput> {
    const output = new CountOutput();
    output.count = this.input.count;
    return output;
  }
}

/** The same order as ModularApi: logging, then the JSON parser and its error handler. */
function buildApp(logLines: string[] = []) {
  const app = express();
  app.use(
    loggingMiddleware({
      logLevel: LogLevel.debug,
      serviceName: 'test-svc',
      writeFn: (line: string) => logLines.push(line),
    }),
  );
  app.use(express.json());
  app.use(bodyParserErrorHandler);
  app.post('/count', useCaseHandler(CountUseCase.fromJson as UseCaseFactory));
  return app;
}

function post(app: express.Express, body: string) {
  return request(app).post('/count').set('Content-Type', 'application/json').send(body);
}

describe('malformed request bodies (issue #44)', () => {
  it.each(['{not json', '{', 'nul', '"text"', '42', 'null', 'true'])(
    'unparseable or non-container JSON %j returns 400',
    async (body) => {
      const res = await post(buildApp(), body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Invalid JSON in request body' });
    },
  );

  it.each(['[1, 2]', '[]'])('a JSON array %j returns 400', async (body) => {
    const res = await post(buildApp(), body);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Request body must be a JSON object' });
  });

  it.each([
    ['missing field', {}],
    ['wrong type', { count: 5 }],
    ['unparseable value', { count: 'abc' }],
  ])('an error inside fromJson (%s) returns 400 without details', async (_, payload) => {
    const logLines: string[] = [];
    const res = await post(buildApp(logLines), JSON.stringify(payload));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request body' });
    const levels = logLines.map((l) => JSON.parse(l)['level']);
    expect(levels).toContain('warning');
    expect(levels).not.toContain('error');
  });

  it('a UseCaseException inside fromJson keeps its status', async () => {
    const res = await post(buildApp(), JSON.stringify({ count: 'boom' }));
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('BOOM');
  });

  it('a well-formed body still succeeds', async () => {
    const res = await post(buildApp(), JSON.stringify({ count: '7' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: '7' });
  });
});
