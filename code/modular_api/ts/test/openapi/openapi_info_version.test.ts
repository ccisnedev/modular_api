import { describe, expect, it } from 'vitest';
import request from 'supertest';

import { ModularApi } from '../../src';

/**
 * `info.version` must reflect the `version` given to `ModularApi` (#38).
 *
 * Two instances with different versions must produce different documents: a test that checks a
 * single value would also pass with the field hard-coded to that value.
 */
describe('OpenAPI info.version', () => {
  it.each(['2.0.0', '9.9.9'])('openapi.json and openapi.yaml carry %s', async (version) => {
    const api = new ModularApi({ basePath: '/api', title: 'Versioned', version });
    const server = await api.serve({ port: 0 });
    try {
      const json = await request(server).get('/api/openapi.json');
      expect(json.status).toBe(200);
      expect(json.body.info.version).toBe(version);

      const yaml = await request(server).get('/api/openapi.yaml');
      expect(yaml.status).toBe(200);
      const escaped = version.replace(/\./g, '\\.');
      expect(yaml.text).toMatch(new RegExp(`^  version: "?${escaped}"?$`, 'm'));
    } finally {
      server.close();
    }
  });
});
