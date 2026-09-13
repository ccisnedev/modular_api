import type { Server } from 'http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LogLevel, ModularApi, type ModularApiOptions } from '../../src';

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
  // Preserve the host's current error contract for oversized bodies.
  expect(response.status).toBe(500);
  expect(response.body).toEqual({ error: 'Internal server error' });
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

    it('rejects 102401 bytes with the existing error response', async () => {
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
