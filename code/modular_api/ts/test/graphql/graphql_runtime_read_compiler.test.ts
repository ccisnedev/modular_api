import type { Server } from 'http';

import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import {
  GraphqlCatalogBuildMode,
  GraphqlCatalogFieldVisibility,
  GraphqlCatalogIdentityMode,
  GraphqlCatalogOrigin,
  GraphqlCatalogPaginationMode,
  GraphqlOptions,
  ModularApi,
  PhysicalObjectKind,
  PostgresReadCompiler,
  ReadExecutionContext,
  RowSet,
  SqlReadCommandPurpose,
  SqlServerReadCompiler,
  type GraphqlCatalog,
  type ReadExecutor,
  type SqlReadCommand,
  type SqlReadCompiler,
} from '../../src';
import { apiRegistry } from '../../src/core/registry';

describe('GraphQL runtime read compiler selection', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      const open = server;
      server = undefined;
      await new Promise<void>((resolve, reject) => open.close((error) => (error ? reject(error) : resolve())));
    }
    apiRegistry.clear();
  });

  async function run(options: {
    engine: string;
    readCompiler?: SqlReadCompiler;
    totalCount?: unknown;
  }): Promise<{ commands: SqlReadCommand[]; body: any }> {
    const commands: SqlReadCommand[] = [];
    const executor: ReadExecutor = {
      async execute(command: SqlReadCommand, _context: ReadExecutionContext): Promise<RowSet> {
        commands.push(command);
        if (command.purpose === SqlReadCommandPurpose.Count) {
          return new RowSet({ rows: [{ totalCount: options.totalCount ?? 1 }], rowCount: 1 });
        }
        return new RowSet({ rows: [{ customerId: 1 }], rowCount: 1 });
      },
      async close() {},
    };
    const api = new ModularApi({
      basePath: '/api',
      title: 'GraphQL Runtime API',
      version: '1.0.0',
      graphql: new GraphqlOptions({
        catalogFactory: async () => catalogFixture(options.engine),
        executor,
        readCompiler: options.readCompiler,
      }),
    });
    server = await api.serve({ port: 0 });
    const response = await request(server)
      .post('/api/graphql')
      .set('Content-Type', 'application/json')
      .send({ query: '{ customerRecordList { items { customerId } totalCount } }' });
    expect(response.status).toBe(200);
    return { commands, body: response.body };
  }

  it('picks the PostgreSQL compiler for a postgres catalog', async () => {
    const { commands, body } = await run({ engine: 'postgres' });

    expect(commands.map((command) => command.engine)).toEqual(['postgres', 'postgres']);
    expect(commands.find((c) => c.purpose === SqlReadCommandPurpose.Collection)?.sql).toContain(
      'FROM "sales"."Customer"',
    );
    expect(commands.find((c) => c.purpose === SqlReadCommandPurpose.Count)?.sql).toBe(
      'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer"',
    );
    expect(body.data.customerRecordList.totalCount).toBe(1);
  });

  it('keeps SQL Server SQL for a sqlserver catalog', async () => {
    const { commands } = await run({ engine: 'sqlserver' });

    expect(commands.map((command) => command.engine)).toEqual(['sqlserver', 'sqlserver']);
    expect(commands.find((c) => c.purpose === SqlReadCommandPurpose.Count)?.sql).toBe(
      'SELECT COUNT_BIG(1) AS [totalCount] FROM [sales].[Customer]',
    );
  });

  it('keeps SQL Server SQL for any other catalog engine', async () => {
    const { commands } = await run({ engine: 'something-else' });
    expect(commands.every((command) => command.engine === 'sqlserver')).toBe(true);
  });

  it('uses the readCompiler option over the catalog engine', async () => {
    const forced = await run({ engine: 'sqlserver', readCompiler: new PostgresReadCompiler() });
    expect(forced.commands.every((command) => command.engine === 'postgres')).toBe(true);

    const reverse = await run({ engine: 'postgres', readCompiler: new SqlServerReadCompiler() });
    expect(reverse.commands.every((command) => command.engine === 'sqlserver')).toBe(true);
  });

  it('accepts a custom compiler implementing SqlReadCompiler', async () => {
    const inner = new PostgresReadCompiler();
    const seen: string[] = [];
    const custom: SqlReadCompiler = {
      compileItem: (o) => inner.compileItem(o),
      compileCollection: (o) => {
        seen.push('collection');
        return inner.compileCollection(o);
      },
      compileCount: (o) => {
        seen.push('count');
        return inner.compileCount(o);
      },
      compileRelationBatch: (o) => inner.compileRelationBatch(o),
    };

    await run({ engine: 'sqlserver', readCompiler: custom });
    expect(seen.sort()).toEqual(['collection', 'count']);
  });

  it.each([
    ['decimal string (node-pg bigint)', '42', 42],
    ['bigint', 42n, 42],
    ['number', 42, 42],
  ])('normalises totalCount from a %s', async (_label, raw, expected) => {
    const { body } = await run({ engine: 'postgres', totalCount: raw });
    expect(body.data.customerRecordList.totalCount).toBe(expected);
  });
});

function catalogFixture(engine: string): GraphqlCatalog {
  return {
    catalogVersion: '1.0.0',
    provider: { kind: 'sql', engine, providerVersion: '0.0.0-test' },
    build: { mode: GraphqlCatalogBuildMode.Runtime, sourceRoot: 'db/src', sourceDigest: 'read-compiler-digest' },
    objects: [
      {
        id: 'sales.Customer',
        kind: PhysicalObjectKind.Table,
        readonly: true,
        source: { schemaName: 'sales', objectName: 'Customer' },
        graphql: { typeName: 'CustomerRecord', collectionField: 'customerRecordList', itemField: 'customerRecord' },
        identity: {
          mode: GraphqlCatalogIdentityMode.Single,
          fields: ['CustomerId'],
          origin: GraphqlCatalogOrigin.Inferred,
        },
        fields: [
          {
            column: 'CustomerId',
            publicName: 'customerId',
            type: 'Int',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.Public,
            filterable: true,
            sortable: true,
            sensitive: false,
            origin: GraphqlCatalogOrigin.Inferred,
          },
        ],
        relations: [],
        capabilities: {
          item: true,
          collection: true,
          filter: true,
          sort: true,
          pagination: { mode: GraphqlCatalogPaginationMode.Offset, defaultLimit: 25, maxLimit: 100 },
        },
      },
    ],
    diagnostics: [],
  };
}
