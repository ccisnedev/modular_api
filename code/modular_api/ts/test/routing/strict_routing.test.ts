// ============================================================
// routing/strict_routing.test.ts
// A use case is reachable only through its canonical path, so a
// middleware that compares req.path exactly cannot be bypassed
// by writing the path differently (issue #47).
// ============================================================

import type { Server } from 'http';
import type { RequestHandler } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Field,
  Input,
  LogLevel,
  ModularApi,
  Output,
  UseCase,
  type ModularApiOptions,
  type Plugin,
  type PluginHost,
} from '../../src';

const executions = vi.fn();

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
  readonly input: PayInput;
  constructor(input: PayInput) {
    super();
    this.input = input;
  }

  static fromJson(json: Record<string, unknown>): ExecutePayment {
    const input = new PayInput();
    input.note = json['note'] as string | undefined;
    return new ExecutePayment(input);
  }

  validate() {
    return null;
  }

  async execute(): Promise<PayOutput> {
    executions();
    const output = new PayOutput();
    output.paid = true;
    return output;
  }
}

const CANONICAL = '/api/v1/payments/execute';

/** The pattern the issue reproduces: protect one path by comparing req.path exactly. */
const requireToken: RequestHandler = (req, res, next) => {
  if (req.path === CANONICAL && req.headers['x-token'] !== 'secret') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

const servers: Server[] = [];

afterEach(async () => {
  executions.mockClear();
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

type GuardSlot = 'use' | 'preRouting' | 'preHandler';

/** Registers requireToken as a plugin middleware in the given slot. */
function guardPlugin(slot: 'preRouting' | 'preHandler'): Plugin {
  return {
    manifest: {
      id: `test.guard.${slot}`,
      displayName: 'Guard',
      version: '0.1.0',
      hostApiVersion: '>=0.1.0 <0.2.0',
    },
    setup(host: PluginHost) {
      host.registerMiddleware({ id: `test.guard.${slot}.mw`, slot, handler: requireToken });
    },
  };
}

async function serve(options: ModularApiOptions = {}, guard: GuardSlot = 'use'): Promise<Server> {
  const api = new ModularApi({ basePath: '/api/v1', logLevel: LogLevel.emergency, ...options });
  if (guard === 'use') api.use(requireToken);
  else api.plugin(guardPlugin(guard));
  api.module('payments', (m) => {
    m.usecase('execute', ExecutePayment.fromJson, { inputClass: PayInput, outputClass: PayOutput });
  });
  const server = await api.serve({ port: 0 });
  servers.push(server);
  return server;
}

function post(server: Server, path: string, token?: string) {
  const req = request(server).post(path).set('Content-Type', 'application/json');
  if (token !== undefined) req.set('x-token', token);
  return req.send('{}');
}

const VARIANTS = [
  `${CANONICAL}/`,
  '/API/v1/Payments/Execute',
  '/api/v1/payments/Execute',
  '/api/v1/payments//execute',
  '/api/v1//payments/execute',
  `${CANONICAL}//`,
  '/api/v1/payments/%65xecute',
  '/api/v1/payments%2Fexecute',
  `${CANONICAL};x`,
  '/api/v1/payments/./execute',
];

describe('strict routing (issue #47)', () => {
  it('the canonical path reaches the use case, behind the middleware', async () => {
    const server = await serve();

    const denied = await post(server, CANONICAL);
    expect(denied.status).toBe(401);
    expect(executions).not.toHaveBeenCalled();

    const allowed = await post(server, CANONICAL, 'secret');
    expect(allowed.status).toBe(200);
    expect(allowed.body).toEqual({ paid: true });
    expect(executions).toHaveBeenCalledOnce();
  });

  describe.each<GuardSlot>(['use', 'preRouting', 'preHandler'])(
    'guard registered in %s',
    (guard) => {
      it('protects the canonical path', async () => {
        const server = await serve({}, guard);
        expect((await post(server, CANONICAL)).status).toBe(401);
        expect((await post(server, CANONICAL, 'secret')).status).toBe(200);
        expect(executions).toHaveBeenCalledOnce();
      });

      it.each(VARIANTS)('%s does not reach the use case without the token', async (path) => {
        const server = await serve({}, guard);
        const response = await post(server, path);

        expect([401, 404]).toContain(response.status);
        expect(executions).not.toHaveBeenCalled();
      });
    },
  );

  it.each([`${CANONICAL}/`, '/api/v1/payments//execute', `${CANONICAL}//`])(
    '%s is answered 404 before any middleware registered with use() runs',
    async (path) => {
      const server = await serve();
      const response = await post(server, path, 'secret');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
      expect(executions).not.toHaveBeenCalled();
    },
  );

  it.each(['/API/v1/Payments/Execute', '/api/v1/payments/Execute'])(
    '%s is not resolved to the use case even with the token',
    async (path) => {
      const server = await serve();
      const response = await post(server, path, 'secret');

      expect(response.status).toBe(404);
      expect(executions).not.toHaveBeenCalled();
    },
  );

  it('operational endpoints keep working on their canonical path only', async () => {
    const server = await serve();

    expect((await request(server).get('/api/v1/health')).status).toBe(200);
    expect((await request(server).get('/api/v1/health/')).status).toBe(404);
    expect((await request(server).get('/api/v1/HEALTH')).status).toBe(404);
  });

  it('the root path is not a trailing-slash variant', async () => {
    const api = new ModularApi({ basePath: '/api', logLevel: LogLevel.emergency });
    api.use((req, res, next) => (req.path === '/' ? res.json({ root: true }) : next()));
    const server = await api.serve({ port: 0 });
    servers.push(server);

    const response = await request(server).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ root: true });
  });
});

describe('strictRouting: false (deprecated opt-out)', () => {
  it('restores the permissive routing of 0.7.x', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const server = await serve({ strictRouting: false });

    // Trailing slash and case resolve on Express 4 and 5; `//` resolves only on some versions.
    for (const path of [`${CANONICAL}/`, '/API/v1/Payments/Execute']) {
      const response = await post(server, path);
      expect(response.status, path).toBe(200);
    }
    expect(executions).toHaveBeenCalledTimes(2);
  });

  it('logs a deprecation warning at startup', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await serve({ strictRouting: false });

    expect(warn).toHaveBeenCalledOnce();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/strictRouting: false is deprecated/);
  });

  it('strict routing does not warn', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await serve();

    expect(warn).not.toHaveBeenCalled();
  });
});
