import 'package:modular_api/src/graphql/catalog/graphql_catalog_builder.dart';
import 'package:modular_api/src/graphql/read/sql_read_contract.dart';

/// Dialect-specific compiler from engine-neutral selections to SQL commands.
///
/// Implementations: `SqlServerReadCompiler` (T-SQL) and
/// `PostgresReadCompiler` (PostgreSQL).
abstract interface class SqlReadCompiler {
  SqlReadCommand compileItem({
    required GraphqlCatalog catalog,
    required SqlItemSelection selection,
  });

  SqlReadCommand compileCollection({
    required GraphqlCatalog catalog,
    required SqlCollectionSelection selection,
  });

  SqlReadCommand compileCount({
    required GraphqlCatalog catalog,
    required SqlCountSelection selection,
  });

  SqlReadCommand compileRelationBatch({
    required GraphqlCatalog catalog,
    required SqlRelationBatchSelection selection,
  });
}
