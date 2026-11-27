import type { Server } from 'http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Input, LogLevel, ModularApi, Output, UseCase, type ModularApiOptions } from '../../src';

const defaultLimit = 102_400;
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

// Include multibyte text so the boundary measures UTF-8 bytes, not characters.
function jsonOfSize(bytes: number): string {
  const remaining = bytes - Buffer.byteLength(JSON.stringify({ value: '' }), 'utf8');
  const json = JSON.stringify({
    value: 'é'.repeat(Math.floor(remaining / 2)) + 'a'.repeat(remaining % 2),
  });
  expect(Buffer.byteLength(json, 'utf8')).toBe(bytes);
  return json;
}

async function serve(options: ModularApiOptions = {}) {
  const handled = vi.fn();
  const api = new ModularApi({ logLevel: LogLevel.emergency, ...options });
  api.use((req, res) => {
    handled(req.body);
    res.json(req.body);
  });
  const server = await api.serve({ port: 0 });
  servers.push(server);
  return { server, handled };
}

function postJson(server: Server, json: string) {
  return request(server).post('/echo').set('Content-Type', 'application/json').send(json);
}

function expectRejected(response: request.Response) {
  expect(response.status).toBe(413);
  expect(response.body).toEqual({ error: 'Request body too large' });
  expect(response.headers['content-type']).toMatch(/^application\/json\b/);
}

describe('ModularApi JSON body limit through serve()', () => {
  describe.each<{ label: string; options: ModularApiOptions }>([
    { label: 'omitted', options: {} },
    { label: 'undefined', options: { jsonBodyLimit: undefined } },
  ])('default with jsonBodyLimit $label', ({ options }) => {
    it('accepts exactly 102400 bytes', async () => {
      const { server, handled } = await serve(options);
      const json = jsonOfSize(defaultLimit);
      const response = await postJson(server, json);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(JSON.parse(json));
      expect(handled).toHaveBeenCalledExactlyOnceWith(JSON.parse(json));
    });

    it('rejects 102401 bytes with 413', async () => {
      const { server, handled } = await serve(options);
      expectRejected(await postJson(server, jsonOfSize(defaultLimit + 1)));
      expect(handled).not.toHaveBeenCalled();
    });
  });

  describe.each([
    { jsonBodyLimit: '1mb', bytes: 1_048_576 },
    { jsonBodyLimit: 204_800, bytes: 204_800 },
  ])('opt-in jsonBodyLimit $jsonBodyLimit', ({ jsonBodyLimit, bytes }) => {
    it.each([
      { label: 'above the default', size: defaultLimit + 1 },
      { label: 'exactly at the configured limit', size: bytes },
    ])('accepts a body $label', async ({ size }) => {
      const { server, handled } = await serve({ jsonBodyLimit });
      const json = jsonOfSize(size);
      const response = await postJson(server, json);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(JSON.parse(json));
      expect(handled).toHaveBeenCalledExactlyOnceWith(JSON.parse(json));
    });

    it('rejects one byte over the configured limit', async () => {
      const { server, handled } = await serve({ jsonBodyLimit });
      expectRejected(await postJson(server, jsonOfSize(bytes + 1)));
      expect(handled).not.toHaveBeenCalled();
    });
  });

  it.each([true, false])(
    'keeps instance limits isolated (default started first: %s)',
    async (defaultFirst) => {
      const first = await serve(defaultFirst ? {} : { jsonBodyLimit: '1mb' });
      const second = await serve(defaultFirst ? { jsonBodyLimit: '1mb' } : {});
      const normal = defaultFirst ? first : second;
      const large = defaultFirst ? second : first;
      const json = jsonOfSize(defaultLimit + 1);

      expect((await postJson(large.server, json)).status).toBe(200);
      expectRejected(await postJson(normal.server, json));
      expect((await postJson(large.server, json)).status).toBe(200);
      expect(normal.handled).not.toHaveBeenCalled();
      expect(large.handled).toHaveBeenCalledTimes(2);
    },
  );

  it('preserves a numeric zero limit instead of replacing it with the default', async () => {
    const { server, handled } = await serve({ jsonBodyLimit: 0 });
    expectRejected(await postJson(server, '{}'));
    expect(handled).not.toHaveBeenCalled();
  });
});

// ── Per-use-case limit (issue #43) ───────────────────────────

class EchoInput extends Input {
  constructor(readonly data: Record<string, unknown> = {}) {
    super();
  }
  toJson() {
    return this.data;
  }
  toSchema() {
    return { type: 'object', properties: {} };
  }
}

class EchoOutput extends Output {
  get statusCode() {
    return 200;
  }
  toJson() {
    return { ok: true };
  }
  toSchema() {
    return { type: 'object', properties: { ok: { type: 'boolean' } } };
  }
}

class EchoUseCase extends UseCase<EchoInput, EchoOutput> {
  readonly input: EchoInput;
  constructor(input: EchoInput) {
    super();
    this.input = input;
  }
  static fromJson(json: Record<string, unknown>) {
    return new EchoUseCase(new EchoInput(json));
  }
  validate() {
    return null;
  }
  async execute() {
    return new EchoOutput();
  }
}

const echoClasses = { inputClass: EchoInput, outputClass: EchoOutput };

async function serveUseCases(
  configure: (api: ModularApi) => void,
  options: ModularApiOptions = {},
) {
  const api = new ModularApi({ logLevel: LogLevel.emergency, ...options });
  configure(api);
  const server = await api.serve({ port: 0 });
  servers.push(server);
  return server;
}

function post(server: Server, path: string, json: string) {
  return request(server).post(path).set('Content-Type', 'application/json').send(json);
}

describe('per-use-case jsonBodyLimit', () => {
  describe.each([
    { jsonBodyLimit: '1mb', bytes: 1_048_576 },
    { jsonBodyLimit: 204_800, bytes: 204_800 },
  ])('use case with $jsonBodyLimit', ({ jsonBodyLimit, bytes }) => {
    const configure = (api: ModularApi) => {
      api.module('m', (m) => {
        m.usecase('big', EchoUseCase.fromJson, { ...echoClasses, jsonBodyLimit });
        m.usecase('plain', EchoUseCase.fromJson, echoClasses);
      });
      api.use((req, res, next) => {
        if (req.path === '/echo') {
          res.json(req.body);
          return;
        }
        next();
      });
    };

    it('accepts exactly its limit and rejects limit + 1 with 413', async () => {
      const server = await serveUseCases(configure);
      expect((await post(server, '/api/m/big', jsonOfSize(bytes))).status).toBe(200);
      expectRejected(await post(server, '/api/m/big', jsonOfSize(bytes + 1)));
    });

    it('keeps the instance default for other use cases and use() routes', async () => {
      const server = await serveUseCases(configure);
      expect((await post(server, '/api/m/plain', jsonOfSize(defaultLimit))).status).toBe(200);
      expectRejected(await post(server, '/api/m/plain', jsonOfSize(defaultLimit + 1)));
      expect((await post(server, '/echo', jsonOfSize(defaultLimit))).status).toBe(200);
      expectRejected(await post(server, '/echo', jsonOfSize(defaultLimit + 1)));
    });
  });

  it('honours a limit smaller than the instance default', async () => {
    const server = await serveUseCases(
      (api) =>
        api.module('m', (m) => {
          m.usecase('small', EchoUseCase.fromJson, { ...echoClasses, jsonBodyLimit: 1024 });
        }),
      { jsonBodyLimit: '1mb' },
    );
    expect((await post(server, '/api/m/small', jsonOfSize(1024))).status).toBe(200);
    expectRejected(await post(server, '/api/m/small', jsonOfSize(1025)));
  });

  it('does not share limits between instances with the same path', async () => {
    const make = (jsonBodyLimit?: string) =>
      serveUseCases((api) =>
        api.module('m', (m) => {
          m.usecase('x', EchoUseCase.fromJson, {
            ...echoClasses,
            ...(jsonBodyLimit === undefined ? {} : { jsonBodyLimit }),
          });
        }),
      );
    const large = await make('1mb');
    const normal = await make();
    const json = jsonOfSize(defaultLimit + 1);
    expect((await post(large, '/api/m/x', json)).status).toBe(200);
    expectRejected(await post(normal, '/api/m/x', json));
    expect((await post(large, '/api/m/x', json)).status).toBe(200);
  });

  it('does not affect a GET use case', async () => {
    const server = await serveUseCases((api) =>
      api.module('m', (m) => {
        m.usecase('g', EchoUseCase.fromJson, { ...echoClasses, method: 'GET', jsonBodyLimit: '1mb' });
      }),
    );
    expect((await request(server).get('/api/m/g')).status).toBe(200);
  });

  it('gives a non-canonical path variant the instance default', async () => {
    const server = await serveUseCases((api) =>
      api.module('m', (m) => {
        m.usecase('big', EchoUseCase.fromJson, { ...echoClasses, jsonBodyLimit: '1mb' });
      }),
    );
    expectRejected(await post(server, '/api/m/big/', jsonOfSize(defaultLimit + 1)));
  });
});
