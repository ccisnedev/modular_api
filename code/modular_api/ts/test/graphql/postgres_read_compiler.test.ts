import { describe, expect, it } from 'vitest';

import {
  GraphqlCatalogBuildMode,
  GraphqlCatalogFieldVisibility,
  GraphqlCatalogIdentityMode,
  GraphqlCatalogOrigin,
  GraphqlCatalogPaginationMode,
  GraphqlCatalogRelationCardinality,
  PhysicalObjectKind,
  PostgresReadCompiler,
  ReadExecutionContext,
  RowSet,
  SqlCatalogReadDispatcher,
  SqlCollectionSelection,
  SqlCountSelection,
  SqlFilterCondition,
  SqlFilterGroup,
  SqlFilterOperator,
  SqlItemSelection,
  SqlOrderByClause,
  SqlPage,
  SqlReadCommandPurpose,
  SqlRelationBatchSelection,
  SqlSortDirection,
  type GraphqlCatalog,
  type ReadExecutor,
  type SqlReadCommand,
} from '../../src';

const compiler = new PostgresReadCompiler();

function collect(filter: SqlFilterCondition | SqlFilterGroup, fields: string[] = ['customerId']) {
  return compiler.compileCollection({
    catalog: catalogFixture(),
    selection: new SqlCollectionSelection({
      objectId: 'sales.Customer',
      projectedFields: fields,
      filter,
      orderBy: [],
    }),
  });
}

function cond(field: string, operator: SqlFilterOperator, value: unknown) {
  return new SqlFilterCondition({ field, operator, value });
}

describe('PostgresReadCompiler', () => {
  it('compiles an item by single key', () => {
    const command = compiler.compileItem({
      catalog: catalogFixture(),
      selection: new SqlItemSelection({
        objectId: 'sales.Customer',
        projectedFields: ['customerId', 'customerCode'],
        key: { customerId: 42 },
      }),
    });

    expect(command.engine).toBe('postgres');
    expect(command.purpose).toBe(SqlReadCommandPurpose.Item);
    expect(command.sql).toBe(
      'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" FROM "sales"."Customer" WHERE "CustomerId" = $1 LIMIT 1',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([['p1', 42]]);
  });

  it('compiles an item by composite key', () => {
    const command = compiler.compileItem({
      catalog: catalogFixture(),
      selection: new SqlItemSelection({
        objectId: 'sales.OrderLine',
        projectedFields: ['orderId', 'lineNo'],
        key: { orderId: 1, lineNo: 2 },
      }),
    });

    expect(command.sql).toBe(
      'SELECT "OrderId" AS "orderId", "LineNo" AS "lineNo" FROM "sales"."OrderLine" WHERE "OrderId" = $1 AND "LineNo" = $2 LIMIT 1',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', 1],
      ['p2', 2],
    ]);
  });

  it('rejects an item with a missing key component', () => {
    expect(() =>
      compiler.compileItem({
        catalog: catalogFixture(),
        selection: new SqlItemSelection({
          objectId: 'sales.OrderLine',
          projectedFields: ['orderId'],
          key: { orderId: 1 },
        }),
      }),
    ).toThrowError('Missing key component lineNo.');
  });

  it('compiles a collection with no filter, order or page', () => {
    const command = compiler.compileCollection({
      catalog: catalogFixture(),
      selection: new SqlCollectionSelection({
        objectId: 'sales.Customer',
        projectedFields: ['customerId'],
        orderBy: [],
      }),
    });

    expect(command.purpose).toBe(SqlReadCommandPurpose.Collection);
    expect(command.sql).toBe('SELECT "CustomerId" AS "customerId" FROM "sales"."Customer"');
    expect(command.parameters).toEqual([]);
  });

  it.each([
    [SqlFilterOperator.Eq, '"CustomerCode" = $1'],
    [SqlFilterOperator.Ne, '"CustomerCode" <> $1'],
    [SqlFilterOperator.Lt, '"CustomerCode" < $1'],
    [SqlFilterOperator.Lte, '"CustomerCode" <= $1'],
    [SqlFilterOperator.Gt, '"CustomerCode" > $1'],
    [SqlFilterOperator.Gte, '"CustomerCode" >= $1'],
  ])('compiles comparison operator %s', (operator, expected) => {
    const command = collect(cond('customerCode', operator, 'A'));
    expect(command.sql).toBe(`SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE ${expected}`);
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([['p1', 'A']]);
  });

  it('compiles inList with positional parameters', () => {
    const command = collect(cond('customerId', SqlFilterOperator.InList, [1, 2, 3]));
    expect(command.sql).toBe(
      'SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerId" IN ($1, $2, $3)',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', 1],
      ['p2', 2],
      ['p3', 3],
    ]);
  });

  it('compiles an empty inList to 1 = 0 like the SQL Server compiler', () => {
    const command = collect(cond('customerId', SqlFilterOperator.InList, []));
    expect(command.sql).toBe('SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE 1 = 0');
    expect(command.parameters).toEqual([]);
  });

  it('compiles isNull true and false without parameters', () => {
    expect(collect(cond('customerCode', SqlFilterOperator.IsNull, true)).sql).toBe(
      'SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerCode" IS NULL',
    );
    const notNull = collect(cond('customerCode', SqlFilterOperator.IsNull, false));
    expect(notNull.sql).toBe(
      'SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerCode" IS NOT NULL',
    );
    expect(notNull.parameters).toEqual([]);
    expect(() => collect(cond('customerCode', SqlFilterOperator.IsNull, 'x'))).toThrowError(
      'isNull expects a boolean for customerCode.',
    );
  });

  it('rejects eq and ne with null', () => {
    expect(() => collect(cond('customerCode', SqlFilterOperator.Eq, null))).toThrowError();
    expect(() => collect(cond('customerCode', SqlFilterOperator.Ne, null))).toThrowError();
  });

  it('compiles contains, startsWith and endsWith with LIKE and an explicit escape', () => {
    const contains = collect(cond('customerCode', SqlFilterOperator.Contains, 'AC'));
    expect(contains.sql).toBe(
      `SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerCode" LIKE '%' || $1 || '%' ESCAPE '\\'`,
    );
    expect(contains.parameters.map((p) => p.value)).toEqual(['AC']);

    const starts = collect(cond('customerCode', SqlFilterOperator.StartsWith, 'AC'));
    expect(starts.sql).toBe(
      `SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerCode" LIKE $1 || '%' ESCAPE '\\'`,
    );

    const ends = collect(cond('customerCode', SqlFilterOperator.EndsWith, 'AC'));
    expect(ends.sql).toBe(
      `SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE "CustomerCode" LIKE '%' || $1 ESCAPE '\\'`,
    );
  });

  it('escapes %, _ and backslash in LIKE values so input matches literally', () => {
    expect(collect(cond('customerCode', SqlFilterOperator.Contains, '50%')).parameters[0]?.value).toBe('50\\%');
    expect(collect(cond('customerCode', SqlFilterOperator.StartsWith, 'a_b')).parameters[0]?.value).toBe('a\\_b');
    expect(collect(cond('customerCode', SqlFilterOperator.EndsWith, 'a\\b')).parameters[0]?.value).toBe('a\\\\b');
    expect(collect(cond('customerCode', SqlFilterOperator.Contains, '\\%_')).parameters[0]?.value).toBe(
      '\\\\\\%\\_',
    );
  });

  it('does not escape non-LIKE string values', () => {
    expect(collect(cond('customerCode', SqlFilterOperator.Eq, '50%_\\')).parameters[0]?.value).toBe('50%_\\');
  });

  it('compiles nested and/or/not groups with parameters numbered in order', () => {
    const command = collect(
      SqlFilterGroup.and([
        cond('customerCode', SqlFilterOperator.Eq, 'A'),
        SqlFilterGroup.or([
          cond('customerId', SqlFilterOperator.Gt, 10),
          SqlFilterGroup.not(cond('isActive', SqlFilterOperator.Eq, false)),
        ]),
      ]),
    );

    expect(command.sql).toBe(
      'SELECT "CustomerId" AS "customerId" FROM "sales"."Customer" WHERE ("CustomerCode" = $1 AND ("CustomerId" > $2 OR NOT ("IsActive" = $3)))',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', 'A'],
      ['p2', 10],
      ['p3', false],
    ]);
  });

  it('omits empty groups', () => {
    const command = collect(SqlFilterGroup.and([]));
    expect(command.sql).toBe('SELECT "CustomerId" AS "customerId" FROM "sales"."Customer"');
  });

  it('compiles order by multiple fields and offset paging with LIMIT then OFFSET', () => {
    const command = compiler.compileCollection({
      catalog: catalogFixture(),
      selection: new SqlCollectionSelection({
        objectId: 'sales.Customer',
        projectedFields: ['customerId', 'customerCode'],
        filter: cond('isActive', SqlFilterOperator.Eq, true),
        orderBy: [
          new SqlOrderByClause({ field: 'customerCode', direction: SqlSortDirection.Asc }),
          new SqlOrderByClause({ field: 'customerId', direction: SqlSortDirection.Desc }),
        ],
        page: new SqlPage({ limit: 25, offset: 50 }),
      }),
    });

    expect(command.sql).toBe(
      'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" FROM "sales"."Customer" WHERE "IsActive" = $1 ORDER BY "CustomerCode" ASC, "CustomerId" DESC LIMIT $2 OFFSET $3',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', true],
      ['p2', 25],
      ['p3', 50],
    ]);
  });

  it('compiles count without a filter', () => {
    const command = compiler.compileCount({
      catalog: catalogFixture(),
      selection: new SqlCountSelection({ objectId: 'sales.Customer' }),
    });

    expect(command.purpose).toBe(SqlReadCommandPurpose.Count);
    expect(command.engine).toBe('postgres');
    expect(command.sql).toBe('SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer"');
    expect(command.parameters).toEqual([]);
  });

  it('compiles count with a filter', () => {
    const command = compiler.compileCount({
      catalog: catalogFixture(),
      selection: new SqlCountSelection({
        objectId: 'sales.Customer',
        filter: cond('isActive', SqlFilterOperator.Eq, true),
      }),
    });

    expect(command.sql).toBe('SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer" WHERE "IsActive" = $1');
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([['p1', true]]);
  });

  it('compiles a relation batch with a single key', () => {
    const command = compiler.compileRelationBatch({
      catalog: catalogFixture(),
      selection: new SqlRelationBatchSelection({
        sourceObjectId: 'sales.Order',
        relationName: 'customer',
        projectedFields: ['customerId', 'customerCode'],
        parentKeys: [{ customerId: 1 }, { customerId: 2 }],
      }),
    });

    expect(command.purpose).toBe(SqlReadCommandPurpose.RelationBatch);
    expect(command.sql).toBe(
      'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" FROM "sales"."Customer" WHERE "CustomerId" IN ($1, $2)',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', 1],
      ['p2', 2],
    ]);
  });

  it('compiles a relation batch with a composite key', () => {
    const command = compiler.compileRelationBatch({
      catalog: catalogFixture(),
      selection: new SqlRelationBatchSelection({
        sourceObjectId: 'sales.Order',
        relationName: 'lines',
        projectedFields: ['orderId', 'lineNo'],
        parentKeys: [
          { orderId: 1, customerId: 7 },
          { orderId: 2, customerId: 8 },
        ],
      }),
    });

    expect(command.sql).toBe(
      'SELECT "OrderId" AS "orderId", "LineNo" AS "lineNo" FROM "sales"."OrderLine" WHERE ("OrderId" = $1 AND "LineNo" = $2) OR ("OrderId" = $3 AND "LineNo" = $4)',
    );
    expect(command.parameters.map((p) => [p.name, p.value])).toEqual([
      ['p1', 1],
      ['p2', 7],
      ['p3', 2],
      ['p4', 8],
    ]);
  });

  it('rejects unknown relations, objects and fields', () => {
    expect(() =>
      compiler.compileRelationBatch({
        catalog: catalogFixture(),
        selection: new SqlRelationBatchSelection({
          sourceObjectId: 'sales.Order',
          relationName: 'nope',
          projectedFields: ['customerId'],
          parentKeys: [],
        }),
      }),
    ).toThrowError('Unknown relation nope for sales.Order.');
    expect(() =>
      compiler.compileCount({ catalog: catalogFixture(), selection: new SqlCountSelection({ objectId: 'x.Y' }) }),
    ).toThrowError('Unknown catalog object x.Y.');
    expect(() => collect(cond('missing', SqlFilterOperator.Eq, 1))).toThrowError(
      'Unknown public field missing for sales.Customer.',
    );
  });

  it('always double-quotes identifiers, preserves mixed case and doubles embedded quotes', () => {
    const command = compiler.compileCollection({
      catalog: catalogFixture(),
      selection: new SqlCollectionSelection({
        objectId: 'we"ird.Mixed"Table',
        projectedFields: ['oddName'],
        filter: cond('oddName', SqlFilterOperator.Eq, 1),
        orderBy: [new SqlOrderByClause({ field: 'oddName', direction: SqlSortDirection.Asc })],
      }),
    });

    expect(command.sql).toBe(
      'SELECT "Od""d Col" AS "oddName" FROM "we""ird"."Mixed""Table" WHERE "Od""d Col" = $1 ORDER BY "Od""d Col" ASC',
    );
  });

  it('dispatcher executes Postgres commands through the ReadExecutor', async () => {
    const commands: SqlReadCommand[] = [];
    const executor: ReadExecutor = {
      async execute(command) {
        commands.push(command);
        return new RowSet({ rows: [], rowCount: 0 });
      },
      async close() {},
    };
    const dispatcher = new SqlCatalogReadDispatcher({ compiler, executor });

    await dispatcher.readCount({
      catalog: catalogFixture(),
      selection: new SqlCountSelection({ objectId: 'sales.Customer' }),
      context: new ReadExecutionContext({ requestId: 'req-1' }),
    });

    expect(commands).toHaveLength(1);
    expect(commands[0]?.engine).toBe('postgres');
  });
});

type FieldSpec = [column: string, publicName: string, type: string];

function objectFixture(options: {
  schemaName: string;
  objectName: string;
  fields: FieldSpec[];
  identity: string[];
  relations?: GraphqlCatalog['objects'][number]['relations'];
}): GraphqlCatalog['objects'][number] {
  return {
    id: `${options.schemaName}.${options.objectName}`,
    kind: PhysicalObjectKind.Table,
    readonly: true,
    source: { schemaName: options.schemaName, objectName: options.objectName },
    graphql: {
      typeName: `${options.objectName.replace(/\W/g, '')}Record`,
      collectionField: 'list',
      itemField: 'item',
    },
    identity: {
      mode: options.identity.length === 1 ? GraphqlCatalogIdentityMode.Single : GraphqlCatalogIdentityMode.Composite,
      fields: options.identity,
      origin: GraphqlCatalogOrigin.Inferred,
    },
    fields: options.fields.map(([column, publicName, type]) => ({
      column,
      publicName,
      type,
      nullable: false,
      visibility: GraphqlCatalogFieldVisibility.Public,
      filterable: true,
      sortable: true,
      sensitive: false,
      origin: GraphqlCatalogOrigin.Inferred,
    })),
    relations: options.relations ?? [],
    capabilities: {
      item: true,
      collection: true,
      filter: true,
      sort: true,
      pagination: { mode: GraphqlCatalogPaginationMode.Offset, defaultLimit: 25, maxLimit: 100 },
    },
  };
}

function catalogFixture(): GraphqlCatalog {
  return {
    catalogVersion: '1.0.0',
    provider: { kind: 'sql', engine: 'postgres', providerVersion: '0.0.0-test' },
    build: { mode: GraphqlCatalogBuildMode.Runtime, sourceRoot: 'db/src', sourceDigest: 'test-digest' },
    objects: [
      objectFixture({
        schemaName: 'sales',
        objectName: 'Customer',
        identity: ['CustomerId'],
        fields: [
          ['CustomerCode', 'customerCode', 'String'],
          ['CustomerId', 'customerId', 'Int'],
          ['IsActive', 'isActive', 'Boolean'],
        ],
      }),
      objectFixture({
        schemaName: 'sales',
        objectName: 'OrderLine',
        identity: ['OrderId', 'LineNo'],
        fields: [
          ['OrderId', 'orderId', 'Int'],
          ['LineNo', 'lineNo', 'Int'],
        ],
      }),
      objectFixture({
        schemaName: 'sales',
        objectName: 'Order',
        identity: ['OrderId'],
        fields: [
          ['OrderId', 'orderId', 'Int'],
          ['CustomerId', 'customerId', 'Int'],
        ],
        relations: [
          {
            name: 'customer',
            target: 'sales.Customer',
            cardinality: GraphqlCatalogRelationCardinality.One,
            sourceFields: ['CustomerId'],
            targetFields: ['CustomerId'],
            origin: GraphqlCatalogOrigin.Inferred,
          },
          {
            name: 'lines',
            target: 'sales.OrderLine',
            cardinality: GraphqlCatalogRelationCardinality.Many,
            sourceFields: ['OrderId', 'CustomerId'],
            targetFields: ['OrderId', 'LineNo'],
            origin: GraphqlCatalogOrigin.Inferred,
          },
        ],
      }),
      objectFixture({
        schemaName: 'we"ird',
        objectName: 'Mixed"Table',
        identity: ['Od"d Col'],
        fields: [['Od"d Col', 'oddName', 'Int']],
      }),
    ],
    diagnostics: [],
  };
}
