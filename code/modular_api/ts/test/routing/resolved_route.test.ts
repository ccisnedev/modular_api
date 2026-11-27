// ============================================================
// routing/resolved_route.test.ts
// Middlewares can read the use case that will run, so access
// control does not have to compare the raw path (issue #47).
// ============================================================

import type { Server } from 'http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Field,
  Input,
  LogLevel,
  ModularApi,
  Output,
  UseCase,
  resolvedRoute,
  type ModularApiOptions,
  type ResolvedRoute,
} from '../../src';

class PayInput extends Input {
  @Field.optional(Field.string({ description: 'note' }))
  note?: string;
}

class PayOutput extends Output {
  @Field.boolean({ description: 'paid' })
  paid!: boolean;
  get statusCode() {
    return 200;
  }
}

class ExecutePayment extends UseCase<PayInput, PayOutput> {
  readonly input = new PayInput();
  static fromJson(): ExecutePayment {
    return new ExecutePayment();
  }
  validate() {
    return null;
  }
  async execute(): Promise<PayOutput> {
    const output = new PayOutput();
    output.paid = true;
    return output;
  }
}

const servers: Server[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

async function serve(options: ModularApiOptions = {}) {
  const seen: Array<ResolvedRoute | undefined> = [];
  const api = new ModularApi({ basePath: '/api/v1', logLevel: LogLevel.emergency, ...options });
  api.use((_req, res, next) => {
    seen.push(resolvedRoute(res));
    next();
  });
  api.module('payments', (m) => {
    m.usecase('execute', ExecutePayment.fromJson, { inputClass: PayInput, outputClass: PayOutput });
    m.usecase('list', ExecutePayment.fromJson, {
      method: 'GET',
      inputClass: PayInput,
      outputClass: PayOutput,
    });
  });
  const server = await api.serve({ port: 0 });
  servers.push(server);
  return { server, seen };
}

describe('resolvedRoute (issue #47)', () => {
  it('a middleware reads the resolved use case', async () => {
    const { server, seen } = await serve();
    await request(server).post('/api/v1/payments/execute').send({});

    expect(seen).toEqual([
      { module: 'payments', useCase: 'execute', method: 'POST', path: '/api/v1/payments/execute' },
    ]);
  });

  it('is absent on a 404', async () => {
    const { server, seen } = await serve();
    expect((await request(server).post('/api/v1/payments/missing').send({})).status).toBe(404);
    expect(seen).toEqual([undefined]);
  });

  it('is absent on a wrong method', async () => {
    const { server, seen } = await serve();
    await request(server).get('/api/v1/payments/execute');
    expect(seen).toEqual([undefined]);
  });

  it('is absent for operational endpoints', async () => {
    const { server, seen } = await serve();
    expect((await request(server).get('/api/v1/health')).status).toBe(200);
    expect(seen).toEqual([undefined]);
  });

  it('HEAD resolves to the GET use case', async () => {
    const { server, seen } = await serve();
    await request(server).head('/api/v1/payments/list');

    expect(seen).toEqual([
      { module: 'payments', useCase: 'list', method: 'GET', path: '/api/v1/payments/list' },
    ]);
  });

  it('with strictRouting: false a path variant is not resolved, so deny by default still holds', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { server, seen } = await serve({ strictRouting: false });

    expect((await request(server).post('/api/v1/payments/execute/').send({})).status).toBe(200);
    expect(seen).toEqual([undefined]);
  });
});
