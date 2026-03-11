/**
 * Tests for the Swagger UI docs handler at GET /docs.
 *
 * PRD-003 assertions:
 *   1. GET /docs returns HTTP 200.
 *   2. Content-Type header is text/html; charset=utf-8.
 *   3. Response body contains swagger-ui-dist@5 CDN references.
 *   4. Response body contains url: "/openapi.json" Swagger UI config.
 *   5. Response body does NOT contain "scalar" (regression guard).
 */

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';
import { ModularApi } from '../../src';
import { apiRegistry } from '../../src/core/registry';

describe('GET /docs — Swagger UI (PRD-003)', () => {
  let server: Server;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    apiRegistry.clear();
  });

  async function startServer(title = 'Test API'): Promise<Server> {
    const api = new ModularApi({ title });
    server = await api.serve({ port: 0 });
    return server;
  }

  it('returns HTTP 200', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.status).toBe(200);
  });

  it('returns Content-Type text/html', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('body contains swagger-ui-dist@5 CSS', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('swagger-ui-dist@5/swagger-ui.css');
  });

  it('body contains swagger-ui-dist@5 JS bundle', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('swagger-ui-dist@5/swagger-ui-bundle.js');
  });

  it('body contains url pointing to /openapi.json', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('url: "/openapi.json"');
  });

  it('body does NOT contain scalar (PRD-003 regression guard)', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text.toLowerCase()).not.toContain('scalar');
  });

  it('interpolates the API title in the HTML', async () => {
    await startServer('Pet Store');
    const res = await request(server).get('/docs');
    expect(res.text).toContain('Pet Store');
  });

  it('returns a complete HTML document', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('<!DOCTYPE html>');
    expect(res.text).toContain('</html>');
  });

  // ── PRD-004: System-aware dark mode ──────────────────────────

  it('contains prefers-color-scheme media query (PRD-004)', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('prefers-color-scheme: dark');
  });

  it('contains CSS custom properties for theming (PRD-004)', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('--bg-primary');
  });

  it('preserves HTTP method accent colors in dark mode (PRD-004)', async () => {
    await startServer();
    const res = await request(server).get('/docs');
    expect(res.text).toContain('#49cc90');
  });
});
