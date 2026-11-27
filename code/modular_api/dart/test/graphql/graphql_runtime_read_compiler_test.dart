import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/modular_api.dart' show apiRegistry;
import 'package:test/test.dart';

const _query =
    '{ customerRecordList { items { customerId name } totalCount } }';

void main() {
  group('GraphQL runtime read compiler selection', () {
    HttpServer? server;

    tearDown(() async {
      if (server != null) {
        await server!.close(force: true);
      }
      apiRegistry.routes.clear();
    });

    Future<_CapturingExecutor> run({
      required String engine,
      SqlReadCompiler? readCompiler,
      Object? totalCount = 2,
    }) async {
      final executor = _CapturingExecutor(totalCount);
      final api = ModularApi(
        basePath: '/api',
        title: 'GraphQL Runtime API',
        version: '1.0.0',
        graphql: GraphqlOptions(
          catalogFactory: () async => _catalog(engine),
          executor: executor,
          readCompiler: readCompiler,
        ),
      );
      server = await api.serve(port: 0);
      final response = await http.post(
        Uri.parse('http://localhost:${server!.port}/api/graphql'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'query': _query}),
      );
      expect(response.statusCode, 200, reason: response.body);
      final body = jsonDecode(response.body) as Map<String, Object?>;
      expect(body['errors'], isNull, reason: response.body);
      final data = (body['data'] as Map)['customerRecordList'] as Map;
      expect(data['totalCount'], 2);
      return executor;
    }

    test('a postgres catalog picks the PostgreSQL compiler by default',
        () async {
      final executor = await run(engine: 'postgres');
      final collection = executor.commands
          .firstWhere((c) => c.purpose == SqlReadCommandPurpose.collection);
      final count = executor.commands
          .firstWhere((c) => c.purpose == SqlReadCommandPurpose.count);
      expect(collection.engine, 'postgres');
      expect(collection.sql, contains('FROM "sales"."Customer"'));
      expect(collection.sql, contains(r'LIMIT $1 OFFSET $2'));
      expect(
          count.sql, 'SELECT COUNT(*) AS "totalCount" FROM "sales"."Customer"');
    });

    test('a SQL Server catalog still gets SQL Server SQL', () async {
      final executor = await run(engine: 'sqlserver');
      final collection = executor.commands
          .firstWhere((c) => c.purpose == SqlReadCommandPurpose.collection);
      final count = executor.commands
          .firstWhere((c) => c.purpose == SqlReadCommandPurpose.count);
      expect(collection.engine, 'sqlserver');
      expect(collection.sql, contains('FROM [sales].[Customer]'));
      expect(
          collection.sql, contains('OFFSET @p0 ROWS FETCH NEXT @p1 ROWS ONLY'));
      expect(count.sql,
          'SELECT COUNT_BIG(1) AS [totalCount] FROM [sales].[Customer]');
    });

    test('an explicit readCompiler wins over the catalog engine', () async {
      final executor = await run(
        engine: 'sqlserver',
        readCompiler: const PostgresReadCompiler(),
      );
      expect(executor.commands.map((c) => c.engine).toSet(), {'postgres'});

      apiRegistry.routes.clear();
      await server!.close(force: true);
      server = null;

      final reverse = await run(
        engine: 'postgres',
        readCompiler: const SqlServerReadCompiler(),
      );
      expect(reverse.commands.map((c) => c.engine).toSet(), {'sqlserver'});
    });

    test('totalCount accepts BigInt and String counts from Postgres drivers',
        () async {
      await run(engine: 'postgres', totalCount: BigInt.two);
      apiRegistry.routes.clear();
      await server!.close(force: true);
      server = null;
      await run(engine: 'postgres', totalCount: '2');
    });
  });
}

final class _CapturingExecutor implements SqlReadExecutor {
  _CapturingExecutor(this.totalCount);

  final Object? totalCount;
  final List<SqlReadCommand> commands = <SqlReadCommand>[];

  @override
  Future<RowSet> execute(
      SqlReadCommand command, ReadExecutionContext context) async {
    commands.add(command);
    if (command.purpose == SqlReadCommandPurpose.count) {
      return RowSet(rows: [
        {'totalCount': totalCount},
      ], rowCount: 1);
    }
    return const RowSet(rows: [
      {'customerId': 1, 'name': 'Ada'},
      {'customerId': 2, 'name': 'Linus'},
    ], rowCount: 2);
  }

  @override
  Future<void> close() async {}
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

GraphqlCatalog _catalog(String engine) {
  return GraphqlCatalog(
    catalogVersion: '1.0.0',
    provider: GraphqlCatalogProvider(
      kind: 'sql',
      engine: engine,
      providerVersion: 'test',
    ),
    build: const GraphqlCatalogBuild(
      mode: GraphqlCatalogBuildMode.runtime,
      sourceRoot: 'db/src',
      sourceDigest: 'read-compiler-test',
    ),
    objects: <GraphqlPublishedObject>[
      GraphqlPublishedObject(
        id: 'sales.Customer',
        kind: PhysicalObjectKind.table,
        readonly: true,
        source: const GraphqlCatalogSource(
          schemaName: 'sales',
          objectName: 'Customer',
        ),
        graphql: const GraphqlCatalogGraphqlNames(
          typeName: 'CustomerRecord',
          collectionField: 'customerRecordList',
          itemField: 'customerRecord',
        ),
        identity: const GraphqlCatalogIdentity(
          mode: GraphqlCatalogIdentityMode.single,
          fields: ['CustomerId'],
          origin: GraphqlCatalogOrigin.inferred,
        ),
        fields: [
          _field('CustomerId', 'customerId', 'Int'),
          _field('Name', 'name', 'String'),
        ],
        relations: const [],
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
      ),
    ],
    diagnostics: const <GraphqlCatalogDiagnostic>[],
  );
}
