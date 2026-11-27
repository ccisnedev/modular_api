import 'package:modular_api/src/graphql/catalog/graphql_catalog_builder.dart';
import 'package:modular_api/src/graphql/read/postgres_read_compiler.dart';
import 'package:modular_api/src/graphql/read/sql_read_contract.dart';
import 'package:modular_api/src/graphql/sqlserver/physical_model.dart';
import 'package:test/test.dart';

List<Object?> _values(SqlReadCommand c) =>
    c.parameters.map((p) => p.value).toList();

void main() {
  const compiler = PostgresReadCompiler();
  final catalog = _catalog();

  SqlReadCommand collection({
    SqlFilterNode? filter,
    List<SqlOrderByClause> orderBy = const [],
    SqlPage? page,
    String objectId = 'sales.Customer',
    List<String> fields = const ['customerId', 'customerCode'],
  }) =>
      compiler.compileCollection(
        catalog: catalog,
        selection: SqlCollectionSelection(
          objectId: objectId,
          projectedFields: fields,
          filter: filter,
          orderBy: orderBy,
          page: page,
        ),
      );

  SqlFilterCondition cond(String f, SqlFilterOperator op, Object? v) =>
      SqlFilterCondition(field: f, operator: op, value: v);

  group('PostgresReadCompiler item', () {
    test('single key', () {
      final c = compiler.compileItem(
        catalog: catalog,
        selection: const SqlItemSelection(
          objectId: 'sales.Customer',
          projectedFields: ['customerId', 'customerCode'],
          key: {'customerId': 42},
        ),
      );
      expect(c.engine, 'postgres');
      expect(c.purpose, SqlReadCommandPurpose.item);
      expect(
        c.sql,
        'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" '
        'FROM "sales"."Customer" WHERE "CustomerId" = \$1 LIMIT 1',
      );
      expect(c.parameters.single.name, 'p1');
      expect(c.parameters.single.type, 'Int');
      expect(_values(c), [42]);
    });

    test('composite key', () {
      final c = compiler.compileItem(
        catalog: catalog,
        selection: const SqlItemSelection(
          objectId: 'sales.OrderLine',
          projectedFields: ['quantity'],
          key: {'orderId': 5, 'lineNo': 2},
        ),
      );
      expect(
        c.sql,
        'SELECT "Quantity" AS "quantity" FROM "sales"."OrderLine" '
        'WHERE "OrderId" = \$1 AND "LineNo" = \$2 LIMIT 1',
      );
      expect(_values(c), [5, 2]);
    });

    test('missing key component throws', () {
      expect(
        () => compiler.compileItem(
          catalog: catalog,
          selection: const SqlItemSelection(
            objectId: 'sales.OrderLine',
            projectedFields: ['quantity'],
            key: {'orderId': 5},
          ),
        ),
        throwsArgumentError,
      );
    });
  });

  group('PostgresReadCompiler collection filters', () {
    const base =
        'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" '
        'FROM "sales"."Customer"';

    test('no filter, no order, no page', () {
      final c = collection();
      expect(c.sql, base);
      expect(c.parameters, isEmpty);
      expect(c.purpose, SqlReadCommandPurpose.collection);
    });

    final simple = <SqlFilterOperator, String>{
      SqlFilterOperator.eq: '=',
      SqlFilterOperator.ne: '<>',
      SqlFilterOperator.lt: '<',
      SqlFilterOperator.lte: '<=',
      SqlFilterOperator.gt: '>',
      SqlFilterOperator.gte: '>=',
    };
    simple.forEach((op, sym) {
      test('operator ${op.name}', () {
        final c = collection(filter: cond('customerId', op, 7));
        expect(c.sql, '$base WHERE "CustomerId" $sym \$1');
        expect(_values(c), [7]);
      });
    });

    test('inList', () {
      final c = collection(
        filter:
            cond('customerId', SqlFilterOperator.inList, <Object?>[1, 2, 3]),
      );
      expect(c.sql, '$base WHERE "CustomerId" IN (\$1, \$2, \$3)');
      expect(_values(c), [1, 2, 3]);
      expect(c.parameters.map((p) => p.name), ['p1', 'p2', 'p3']);
    });

    test('inList empty is always false, like SQL Server', () {
      final c = collection(
        filter: cond('customerId', SqlFilterOperator.inList, <Object?>[]),
      );
      expect(c.sql, '$base WHERE 1 = 0');
      expect(c.parameters, isEmpty);
    });

    test('isNull true and false', () {
      expect(
        collection(filter: cond('customerCode', SqlFilterOperator.isNull, true))
            .sql,
        '$base WHERE "CustomerCode" IS NULL',
      );
      expect(
        collection(
                filter: cond('customerCode', SqlFilterOperator.isNull, false))
            .sql,
        '$base WHERE "CustomerCode" IS NOT NULL',
      );
    });

    test('isNull requires a boolean', () {
      expect(
        () => collection(
            filter: cond('customerCode', SqlFilterOperator.isNull, 'x')),
        throwsArgumentError,
      );
    });

    test('eq/ne null rejected', () {
      expect(
        () => collection(
            filter: cond('customerCode', SqlFilterOperator.eq, null)),
        throwsArgumentError,
      );
      expect(
        () => collection(
            filter: cond('customerCode', SqlFilterOperator.ne, null)),
        throwsArgumentError,
      );
    });

    test('contains', () {
      final c = collection(
          filter: cond('customerCode', SqlFilterOperator.contains, 'AC'));
      expect(c.sql,
          "$base WHERE \"CustomerCode\" LIKE '%' || \$1 || '%' ESCAPE '\\'");
      expect(_values(c), ['AC']);
    });

    test('startsWith', () {
      final c = collection(
          filter: cond('customerCode', SqlFilterOperator.startsWith, 'AC'));
      expect(c.sql, "$base WHERE \"CustomerCode\" LIKE \$1 || '%' ESCAPE '\\'");
      expect(_values(c), ['AC']);
    });

    test('endsWith', () {
      final c = collection(
          filter: cond('customerCode', SqlFilterOperator.endsWith, 'AC'));
      expect(c.sql, "$base WHERE \"CustomerCode\" LIKE '%' || \$1 ESCAPE '\\'");
      expect(_values(c), ['AC']);
    });

    test('LIKE escapes %, _ and backslash in the bound value', () {
      List<Object?> run(SqlFilterOperator op, String v) =>
          _values(collection(filter: cond('customerCode', op, v)));
      expect(run(SqlFilterOperator.contains, '50%'), [r'50\%']);
      expect(run(SqlFilterOperator.startsWith, 'a_b'), [r'a\_b']);
      expect(run(SqlFilterOperator.endsWith, r'a\b'), [r'a\\b']);
      expect(run(SqlFilterOperator.contains, r'\%_'), [r'\\\%\_']);
    });

    test('nested and/or/not with positional parameters in order', () {
      final c = collection(
        filter: SqlFilterGroup.and(<SqlFilterNode>[
          cond('customerId', SqlFilterOperator.gt, 10),
          SqlFilterGroup.or(<SqlFilterNode>[
            cond('customerCode', SqlFilterOperator.eq, 'A'),
            SqlFilterGroup.not(cond('isActive', SqlFilterOperator.eq, false)),
          ]),
        ]),
      );
      expect(
        c.sql,
        '$base WHERE ("CustomerId" > \$1 AND ("CustomerCode" = \$2 OR NOT ("IsActive" = \$3)))',
      );
      expect(_values(c), [10, 'A', false]);
    });

    test('empty group yields no WHERE', () {
      final c = collection(filter: SqlFilterGroup.and(const <SqlFilterNode>[]));
      expect(c.sql, base);
    });

    test('multi-field order by', () {
      final c = collection(
        orderBy: const [
          SqlOrderByClause(
              field: 'customerCode', direction: SqlSortDirection.asc),
          SqlOrderByClause(
              field: 'customerId', direction: SqlSortDirection.desc),
        ],
      );
      expect(c.sql, '$base ORDER BY "CustomerCode" ASC, "CustomerId" DESC');
    });

    test('paging uses LIMIT then OFFSET, positional after filters', () {
      final c = collection(
        filter: cond('isActive', SqlFilterOperator.eq, true),
        orderBy: const [
          SqlOrderByClause(
              field: 'customerId', direction: SqlSortDirection.asc),
        ],
        page: const SqlPage(limit: 25, offset: 50),
      );
      expect(
        c.sql,
        '$base WHERE "IsActive" = \$1 ORDER BY "CustomerId" ASC LIMIT \$2 OFFSET \$3',
      );
      expect(_values(c), [true, 25, 50]);
      expect(c.parameters.map((p) => p.name), ['p1', 'p2', 'p3']);
    });

    test('unknown field and object throw', () {
      expect(() => collection(filter: cond('nope', SqlFilterOperator.eq, 1)),
          throwsArgumentError);
      expect(() => collection(objectId: 'x.Y'), throwsArgumentError);
    });
  });

  group('PostgresReadCompiler identifier quoting', () {
    test('doubles embedded quotes and keeps mixed case', () {
      final c = collection(
        objectId: 'Odd.Weird',
        fields: const ['weirdName'],
        filter: cond('weirdName', SqlFilterOperator.eq, 1),
        orderBy: const [
          SqlOrderByClause(field: 'weirdName', direction: SqlSortDirection.asc),
        ],
      );
      expect(
        c.sql,
        'SELECT "Mixed""Col" AS "weirdName" FROM "My""Schema"."Weird""Table" '
        'WHERE "Mixed""Col" = \$1 ORDER BY "Mixed""Col" ASC',
      );
    });
  });

  group('PostgresReadCompiler count', () {
    test('without filter', () {
      final c = compiler.compileCount(
        catalog: catalog,
        selection: const SqlCountSelection(objectId: 'sales.Customer'),
      );
      expect(c.purpose, SqlReadCommandPurpose.count);
      expect(c.engine, 'postgres');
      expect(c.sql, 'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer"');
      expect(c.parameters, isEmpty);
    });

    test('with filter', () {
      final c = compiler.compileCount(
        catalog: catalog,
        selection: SqlCountSelection(
          objectId: 'sales.Customer',
          filter: cond('isActive', SqlFilterOperator.eq, true),
        ),
      );
      expect(
        c.sql,
        'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer" WHERE "IsActive" = \$1',
      );
      expect(_values(c), [true]);
    });
  });

  group('PostgresReadCompiler relation batch', () {
    test('single key', () {
      final c = compiler.compileRelationBatch(
        catalog: catalog,
        selection: const SqlRelationBatchSelection(
          sourceObjectId: 'sales.Order',
          relationName: 'customer',
          projectedFields: ['customerId', 'customerCode'],
          parentKeys: [
            {'customerId': 1},
            {'customerId': 2},
          ],
        ),
      );
      expect(c.purpose, SqlReadCommandPurpose.relationBatch);
      expect(c.engine, 'postgres');
      expect(
        c.sql,
        'SELECT "CustomerId" AS "customerId", "CustomerCode" AS "customerCode" '
        'FROM "sales"."Customer" WHERE "CustomerId" IN (\$1, \$2)',
      );
      expect(_values(c), [1, 2]);
    });

    test('composite keys', () {
      final c = compiler.compileRelationBatch(
        catalog: catalog,
        selection: const SqlRelationBatchSelection(
          sourceObjectId: 'sales.Shipment',
          relationName: 'line',
          projectedFields: ['quantity'],
          parentKeys: [
            {'orderId': 1, 'lineNo': 1},
            {'orderId': 2, 'lineNo': 3},
          ],
        ),
      );
      expect(
        c.sql,
        'SELECT "Quantity" AS "quantity" FROM "sales"."OrderLine" '
        'WHERE ("OrderId" = \$1 AND "LineNo" = \$2) OR ("OrderId" = \$3 AND "LineNo" = \$4)',
      );
      expect(_values(c), [1, 1, 2, 3]);
    });

    test('unknown relation and missing parent key throw', () {
      expect(
        () => compiler.compileRelationBatch(
          catalog: catalog,
          selection: const SqlRelationBatchSelection(
            sourceObjectId: 'sales.Order',
            relationName: 'nope',
            projectedFields: ['customerId'],
            parentKeys: [],
          ),
        ),
        throwsArgumentError,
      );
      expect(
        () => compiler.compileRelationBatch(
          catalog: catalog,
          selection: const SqlRelationBatchSelection(
            sourceObjectId: 'sales.Order',
            relationName: 'customer',
            projectedFields: ['customerId'],
            parentKeys: [
              {'other': 1},
            ],
          ),
        ),
        throwsArgumentError,
      );
    });
  });
}

GraphqlCatalogField _field(String column, String publicName, String type) =>
    GraphqlCatalogField(
      column: column,
      publicName: publicName,
      type: type,
      nullable: false,
      visibility: GraphqlCatalogFieldVisibility.public,
      filterable: true,
      sortable: true,
      sensitive: false,
      origin: GraphqlCatalogOrigin.inferred,
    );

GraphqlPublishedObject _object({
  required String id,
  required String schema,
  required String name,
  required List<String> identity,
  required List<GraphqlCatalogField> fields,
  List<GraphqlCatalogRelation> relations = const [],
}) =>
    GraphqlPublishedObject(
      id: id,
      kind: PhysicalObjectKind.table,
      readonly: true,
      source: GraphqlCatalogSource(schemaName: schema, objectName: name),
      graphql: GraphqlCatalogGraphqlNames(
        typeName: 'T$name',
        collectionField: '${name}List',
        itemField: name,
      ),
      identity: GraphqlCatalogIdentity(
        mode: identity.length == 1
            ? GraphqlCatalogIdentityMode.single
            : GraphqlCatalogIdentityMode.composite,
        fields: identity,
        origin: GraphqlCatalogOrigin.inferred,
      ),
      fields: fields,
      relations: relations,
      capabilities: const GraphqlCatalogCapabilities(
        item: true,
        collection: true,
        filter: true,
        sort: true,
        pagination: GraphqlCatalogPagination(
          mode: GraphqlCatalogPaginationMode.offset,
          defaultLimit: 25,
          maxLimit: 100,
        ),
      ),
    );

GraphqlCatalog _catalog() {
  return GraphqlCatalog(
    catalogVersion: '1.0.0',
    provider: const GraphqlCatalogProvider(
      kind: 'sql',
      engine: 'postgres',
      providerVersion: 'test',
    ),
    build: const GraphqlCatalogBuild(
      mode: GraphqlCatalogBuildMode.runtime,
      sourceRoot: 'db/src',
      sourceDigest: 'test-digest',
    ),
    objects: <GraphqlPublishedObject>[
      _object(
        id: 'sales.Customer',
        schema: 'sales',
        name: 'Customer',
        identity: ['CustomerId'],
        fields: [
          _field('CustomerCode', 'customerCode', 'String'),
          _field('CustomerId', 'customerId', 'Int'),
          _field('IsActive', 'isActive', 'Boolean'),
        ],
      ),
      _object(
        id: 'sales.Order',
        schema: 'sales',
        name: 'Order',
        identity: ['OrderId'],
        fields: [
          _field('OrderId', 'orderId', 'Int'),
          _field('CustomerId', 'customerId', 'Int'),
        ],
        relations: const [
          GraphqlCatalogRelation(
            name: 'customer',
            target: 'sales.Customer',
            cardinality: GraphqlCatalogRelationCardinality.one,
            sourceFields: ['CustomerId'],
            targetFields: ['CustomerId'],
            origin: GraphqlCatalogOrigin.inferred,
          ),
        ],
      ),
      _object(
        id: 'sales.OrderLine',
        schema: 'sales',
        name: 'OrderLine',
        identity: ['OrderId', 'LineNo'],
        fields: [
          _field('OrderId', 'orderId', 'Int'),
          _field('LineNo', 'lineNo', 'Int'),
          _field('Quantity', 'quantity', 'Int'),
        ],
      ),
      _object(
        id: 'sales.Shipment',
        schema: 'sales',
        name: 'Shipment',
        identity: ['ShipmentId'],
        fields: [
          _field('ShipmentId', 'shipmentId', 'Int'),
          _field('OrderId', 'orderId', 'Int'),
          _field('LineNo', 'lineNo', 'Int'),
        ],
        relations: const [
          GraphqlCatalogRelation(
            name: 'line',
            target: 'sales.OrderLine',
            cardinality: GraphqlCatalogRelationCardinality.one,
            sourceFields: ['OrderId', 'LineNo'],
            targetFields: ['OrderId', 'LineNo'],
            origin: GraphqlCatalogOrigin.inferred,
          ),
        ],
      ),
      _object(
        id: 'Odd.Weird',
        schema: 'My"Schema',
        name: 'Weird"Table',
        identity: ['Mixed"Col'],
        fields: [_field('Mixed"Col', 'weirdName', 'Int')],
      ),
    ],
    diagnostics: const <GraphqlCatalogDiagnostic>[],
  );
}
