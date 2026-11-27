import type { GraphqlCatalog } from '../catalog/graphql_catalog_builder';
import type {
  SqlCollectionSelection,
  SqlCountSelection,
  SqlItemSelection,
  SqlReadCommand,
  SqlRelationBatchSelection,
} from './sql_read_contract';

/**
 * Dialect-specific compiler from catalog selections to executable read commands.
 * Implemented by `SqlServerReadCompiler` and `PostgresReadCompiler`.
 */
export interface SqlReadCompiler {
  compileItem(options: { catalog: GraphqlCatalog; selection: SqlItemSelection }): SqlReadCommand;
  compileCollection(options: { catalog: GraphqlCatalog; selection: SqlCollectionSelection }): SqlReadCommand;
  compileCount(options: { catalog: GraphqlCatalog; selection: SqlCountSelection }): SqlReadCommand;
  compileRelationBatch(options: { catalog: GraphqlCatalog; selection: SqlRelationBatchSelection }): SqlReadCommand;
}
