// ============================================================
// routing/internal_middlewares.test.ts
// Logging, metrics and tracing treat path variants consistently (issue #47).
//
// The rule: an operational endpoint is excluded only on its exact path. A
// variant such as /health/ or /HEALTH is not that endpoint — with strict
// routing it is a 404 like any other, so it is logged, traced and counted
// under route="UNMATCHED".
// ============================================================

import type { Server } from 'http';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LogLevel, ModularApi, TracingOptions } from '../../src';

const exporter = new InMemorySpanExporter();
let tracing: TracingOptions;
const servers: Server[] = [];
let logs: Array<Record<string, unknown>>;

beforeAll(() => {
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  tracing = new TracingOptions({ tracerProvider: provider });
});

beforeEach(() => {
  exporter.reset();
  logs = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    for (const line of String(chunk).split('\n')) {
      if (line.startsWith('{')) logs.push(JSON.parse(line) as Record<string, unknown>);
    }
    return true;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

async function serve(): Promise<Server> {
  const api = new ModularApi({
    basePath: '/api',
    logLevel: LogLevel.info,
    metricsEnabled: true,
    tracing,
  });
  const server = await api.serve({ port: 0 });
  servers.push(server);
  return server;
}

const completed = () => logs.filter((l) => l['msg'] === 'request completed');

async function metricsFor(server: Server): Promise<string[]> {
  const text = (await request(server).get('/api/metrics')).text;
  return text.split('\n').filter((line) => line.startsWith('http_requests_total{'));
}

describe('internal middlewares and path variants (issue #47)', () => {
  it('the exact operational path stays excluded from logs, traces and metrics', async () => {
    const server = await serve();
    expect((await request(server).get('/api/health')).status).toBe(200);

    expect(completed()).toEqual([]);
    expect(exporter.getFinishedSpans()).toEqual([]);
    expect(await metricsFor(server)).toEqual([]);
  });

  it.each(['/api/health/', '/api/HEALTH', '/api//health'])(
    '%s is a 404 like any other: logged, traced and UNMATCHED',
    async (path) => {
      const server = await serve();
      expect((await request(server).get(path)).status).toBe(404);

      expect(completed()).toHaveLength(1);
      expect(completed()[0]).toMatchObject({ status: 404 });
      expect(exporter.getFinishedSpans()).toHaveLength(1);
      expect(await metricsFor(server)).toEqual([
        'http_requests_total{method="GET",route="UNMATCHED",status_code="404"} 1',
      ]);
    },
  );
});
