import 'package:modular_api/src/graphql/catalog/graphql_catalog_builder.dart';
import 'package:modular_api/src/graphql/read/sql_read_contract.dart';
import 'package:modular_api/src/graphql/read/sqlserver_read_compiler.dart';
import 'package:modular_api/src/graphql/sqlserver/physical_model.dart';
import 'package:test/test.dart';

void main() {
  group('SqlServerReadCompiler', () {
    const compiler = SqlServerReadCompiler();

    test('item query compiles to purpose item', () {
      final command = compiler.compileItem(
        catalog: _catalog(),
        selection: const SqlItemSelection(
          objectId: 'sales.Customer',
          projectedFields: <String>['customerId', 'customerCode'],
          key: <String, Object?>{'customerId': 42},
        ),
      );

      expect(command.engine, 'sqlserver');
      expect(command.purpose, SqlReadCommandPurpose.item);
      expect(command.sql, contains('SELECT TOP (1)'));
      expect(command.sql, contains('FROM [sales].[Customer]'));
      expect(command.sql, contains('WHERE [CustomerId] = @p0'));
      expect(command.parameters, hasLength(1));
      expect(command.parameters.single.name, 'p0');
      expect(command.parameters.single.value, 42);
    });

    test('collection query compiles to purpose collection and keeps string semantics engine-native', () {
      final command = compiler.compileCollection(
        catalog: _catalog(),
        selection: const SqlCollectionSelection(
          objectId: 'sales.Customer',
          projectedFields: <String>['customerId', 'customerCode', 'isActive'],
          filter: SqlFilterGroup.and(<SqlFilterNode>[
            SqlFilterCondition(
              field: 'customerCode',
              operator: SqlFilterOperator.contains,
              value: 'ACME',
            ),
            SqlFilterCondition(
              field: 'isActive',
              operator: SqlFilterOperator.eq,
              value: true,
            ),
          ]),
          orderBy: <SqlOrderByClause>[
            SqlOrderByClause(field: 'customerCode', direction: SqlSortDirection.asc),
            SqlOrderByClause(field: 'customerId', direction: SqlSortDirection.desc),
          ],
          page: SqlPage(limit: 25, offset: 50),
        ),
      );

      expect(command.purpose, SqlReadCommandPurpose.collection);
      expect(command.sql, contains('FROM [sales].[Customer]'));
      expect(command.sql, contains('[CustomerCode] LIKE'));
      expect(command.sql, contains('ORDER BY [CustomerCode] ASC, [CustomerId] DESC'));
      expect(command.sql, contains('OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY'));
      expect(command.sql, isNot(contains('LOWER(')));
      expect(command.parameters.map((parameter) => parameter.value).toList(growable: false), equals(const <Object?>['ACME', true, 50, 25]));
    });

    test('totalCount query compiles to purpose count', () {
      final command = compiler.compileCount(
        catalog: _catalog(),
        selection: const SqlCountSelection(
          objectId: 'sales.Customer',
          filter: SqlFilterCondition(
            field: 'isActive',
            operator: SqlFilterOperator.eq,
            value: true,
          ),
        ),
      );

      expect(command.purpose, SqlReadCommandPurpose.count);
      expect(command.sql, contains('SELECT COUNT_BIG(1) AS [totalCount]'));
      expect(command.sql, contains('WHERE [IsActive] = @p0'));
      expect(command.parameters.single.value, isTrue);
    });

    test('relation batching compiles to purpose relation-batch', () {
      final command = compiler.compileRelationBatch(
        catalog: _catalog(),
        selection: const SqlRelationBatchSelection(
          sourceObjectId: 'sales.Order',
          relationName: 'customer',
          projectedFields: <String>['customerId', 'customerCode'],
          parentKeys: <Map<String, Object?>>[
            <String, Object?>{'customerId': 1},
            <String, Object?>{'customerId': 2},
          ],
        ),
      );

      expect(command.purpose, SqlReadCommandPurpose.relationBatch);
      expect(command.sql, contains('FROM [sales].[Customer]'));
      expect(command.sql, contains('WHERE [CustomerId] IN (@p0, @p1)'));
      expect(command.parameters.map((parameter) => parameter.value).toList(growable: false), equals(const <Object?>[1, 2]));
    });

    group('LIKE wildcard escaping', () {
      SqlReadCommand likeCommand(SqlFilterOperator operator, Object? value) {
        return compiler.compileCollection(
          catalog: _catalog(),
          selection: SqlCollectionSelection(
            objectId: 'sales.Customer',
            projectedFields: const <String>['customerId'],
            filter: SqlFilterCondition(
              field: 'customerCode',
              operator: operator,
              value: value,
            ),
          ),
        );
      }

      Object? firstValue(SqlReadCommand command) => command.parameters.first.value;

      test('emits ESCAPE for contains, startsWith and endsWith', () {
        final containsCmd = likeCommand(SqlFilterOperator.contains, 'AC');
        expect(containsCmd.sql, contains(r"WHERE [CustomerCode] LIKE '%' + @p0 + '%' ESCAPE '\'"));
        expect(firstValue(containsCmd), 'AC');

        final starts = likeCommand(SqlFilterOperator.startsWith, 'AC');
        expect(starts.sql, contains(r"WHERE [CustomerCode] LIKE @p0 + '%' ESCAPE '\'"));
        expect(firstValue(starts), 'AC');

        final ends = likeCommand(SqlFilterOperator.endsWith, 'AC');
        expect(ends.sql, contains(r"WHERE [CustomerCode] LIKE '%' + @p0 ESCAPE '\'"));
        expect(firstValue(ends), 'AC');
      });

      test('escapes backslash, percent, underscore and open bracket in the bound value', () {
        const cases = <String, String>{
          '50%': r'50\%',
          'a_b': r'a\_b',
          '[A]': r'\[A]',
          r'c:\dir': r'c:\\dir',
          r'50%_[a]\b': r'50\%\_\[a]\\b',
        };
        for (final operator in const <SqlFilterOperator>[
          SqlFilterOperator.contains,
          SqlFilterOperator.startsWith,
          SqlFilterOperator.endsWith,
        ]) {
          cases.forEach((raw, escaped) {
            expect(firstValue(likeCommand(operator, raw)), escaped, reason: '$operator $raw');
          });
        }
      });

      test('keeps null as null and stringifies non-string values', () {
        expect(firstValue(likeCommand(SqlFilterOperator.contains, null)), isNull);
        expect(firstValue(likeCommand(SqlFilterOperator.contains, 12.5)), '12.5');
      });

      test('does not escape non-LIKE string values', () {
        expect(firstValue(likeCommand(SqlFilterOperator.eq, r'50%_[a]\')), r'50%_[a]\');
      });
    });

    test('eq null and ne null are rejected in favor of isNull', () {
      expect(
        () => compiler.compileCollection(
          catalog: _catalog(),
          selection: const SqlCollectionSelection(
            objectId: 'sales.Customer',
            projectedFields: <String>['customerId'],
            filter: SqlFilterCondition(
              field: 'customerCode',
              operator: SqlFilterOperator.eq,
              value: null,
            ),
          ),
        ),
        throwsArgumentError,
      );

      expect(
        () => compiler.compileCollection(
          catalog: _catalog(),
          selection: const SqlCollectionSelection(
            objectId: 'sales.Customer',
            projectedFields: <String>['customerId'],
            filter: SqlFilterCondition(
              field: 'customerCode',
              operator: SqlFilterOperator.ne,
              value: null,
            ),
          ),
        ),
        throwsArgumentError,
      );
    });
  });

  group('SqlCatalogReadDispatcher', () {
    test('executes only provider-compiled commands through SqlReadExecutor', () async {
      final executor = _RecordingExecutor();
      final dispatcher = SqlCatalogReadDispatcher(
        compiler: const SqlServerReadCompiler(),
        executor: executor,
      );

      await dispatcher.readItem(
        catalog: _catalog(),
        selection: const SqlItemSelection(
          objectId: 'sales.Customer',
          projectedFields: <String>['customerId'],
          key: <String, Object?>{'customerId': 7},
        ),
        context: const ReadExecutionContext(requestId: 'req-1'),
      );

      expect(executor.commands, hasLength(1));
      expect(executor.commands.single.purpose, SqlReadCommandPurpose.item);
      expect(executor.commands.single.sql, contains('FROM [sales].[Customer]'));
      expect(executor.contexts.single.requestId, 'req-1');
    });

    test('normalizes row sets from generic row maps deterministically', () {
      final rowSet = RowSet.normalize(<Map<Object?, Object?>>[
        <Object?, Object?>{'customerId': 1, 'customerCode': 'A'},
        <Object?, Object?>{'customerId': 2, 'customerCode': 'B'},
      ]);

      expect(rowSet.rowCount, 2);
      expect(rowSet.rows, equals(const <Map<String, Object?>>[
        <String, Object?>{'customerId': 1, 'customerCode': 'A'},
        <String, Object?>{'customerId': 2, 'customerCode': 'B'},
      ]));
    });
  });
}

GraphqlCatalog _catalog() {
  return GraphqlCatalog(
    catalogVersion: '1.0.0',
    provider: const GraphqlCatalogProvider(
      kind: 'sql',
      engine: 'sqlserver',
      providerVersion: '0.4.7-test',
    ),
    build: const GraphqlCatalogBuild(
      mode: GraphqlCatalogBuildMode.runtime,
      sourceRoot: 'db/src',
      sourceDigest: 'test-digest',
    ),
    objects: const <GraphqlPublishedObject>[
      GraphqlPublishedObject(
        id: 'sales.Customer',
        kind: PhysicalObjectKind.table,
        readonly: true,
        source: GraphqlCatalogSource(
          schemaName: 'sales',
          objectName: 'Customer',
        ),
        graphql: GraphqlCatalogGraphqlNames(
          typeName: 'CustomerRecord',
          collectionField: 'customerRecordList',
          itemField: 'customerRecord',
        ),
        identity: GraphqlCatalogIdentity(
          mode: GraphqlCatalogIdentityMode.single,
          fields: <String>['CustomerId'],
          origin: GraphqlCatalogOrigin.inferred,
        ),
        fields: <GraphqlCatalogField>[
          GraphqlCatalogField(
            column: 'CustomerCode',
            publicName: 'customerCode',
            type: 'String',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.public,
            filterable: true,
            sortable: true,
            sensitive: false,
            origin: GraphqlCatalogOrigin.inferred,
          ),
          GraphqlCatalogField(
            column: 'CustomerId',
            publicName: 'customerId',
            type: 'Int',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.public,
            filterable: true,
            sortable: true,
            sensitive: false,
            origin: GraphqlCatalogOrigin.inferred,
          ),
          GraphqlCatalogField(
            column: 'IsActive',
            publicName: 'isActive',
            type: 'Boolean',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.public,
            filterable: true,
            sortable: false,
            sensitive: false,
            origin: GraphqlCatalogOrigin.inferred,
          ),
        ],
        relations: <GraphqlCatalogRelation>[],
        capabilities: GraphqlCatalogCapabilities(
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
      ),
      GraphqlPublishedObject(
        id: 'sales.Order',
        kind: PhysicalObjectKind.table,
        readonly: true,
        source: GraphqlCatalogSource(
          schemaName: 'sales',
          objectName: 'Order',
        ),
        graphql: GraphqlCatalogGraphqlNames(
          typeName: 'OrderRecord',
          collectionField: 'orderRecordList',
          itemField: 'orderRecord',
        ),
        identity: GraphqlCatalogIdentity(
          mode: GraphqlCatalogIdentityMode.single,
          fields: <String>['OrderId'],
          origin: GraphqlCatalogOrigin.inferred,
        ),
        fields: <GraphqlCatalogField>[
          GraphqlCatalogField(
            column: 'OrderId',
            publicName: 'orderId',
            type: 'Int',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.public,
            filterable: true,
            sortable: true,
            sensitive: false,
            origin: GraphqlCatalogOrigin.inferred,
          ),
          GraphqlCatalogField(
            column: 'CustomerId',
            publicName: 'customerId',
            type: 'Int',
            nullable: false,
            visibility: GraphqlCatalogFieldVisibility.public,
            filterable: true,
            sortable: true,
            sensitive: false,
            origin: GraphqlCatalogOrigin.inferred,
          ),
        ],
        relations: <GraphqlCatalogRelation>[
          GraphqlCatalogRelation(
            name: 'customer',
            target: 'sales.Customer',
            cardinality: GraphqlCatalogRelationCardinality.one,
            sourceFields: <String>['CustomerId'],
            targetFields: <String>['CustomerId'],
            origin: GraphqlCatalogOrigin.inferred,
          ),
        ],
        capabilities: GraphqlCatalogCapabilities(
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
      ),
    ],
    diagnostics: const <GraphqlCatalogDiagnostic>[],
  );
}

final class _RecordingExecutor implements SqlReadExecutor {
  final List<SqlReadCommand> commands = <SqlReadCommand>[];
  final List<ReadExecutionContext> contexts = <ReadExecutionContext>[];

  @override
  Future<RowSet> execute(SqlReadCommand command, ReadExecutionContext context) async {
    commands.add(command);
    contexts.add(context);
    return const RowSet(rows: <Map<String, Object?>>[], rowCount: 0);
  }

  @override
  Future<void> close() async {}
}