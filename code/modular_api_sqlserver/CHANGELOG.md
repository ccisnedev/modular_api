# Changelog

## [0.7.1 and earlier] Before release-please

Until 0.7.1 each language kept its own changelog. They are reproduced below unchanged, one
subsection per language, with their headings moved down two levels. From 0.7.2 on,
this file is written by release-please and covers the three languages at once
([ADR-0006](https://github.com/ccisnedev/modular_api/blob/main/docs/adr/0006-per-project-versioning-across-the-three-sdks.md)).

### Dart (pub.dev)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- raise the `modular_api` constraint to `^0.7.0`: `^0.6.0` resolves to `>=0.6.0 <0.7.0`, so this package would have shipped at 0.7.0 requiring a 0.6.x modular_api — a version conflict for anyone using both

#### 0.6.0

- add typed command parameters via `DbParameter` (name, value, direction input/output/inputOutput, free-form `typeHint`) with `input`/`output`/`inputOutput` helpers
- add `DbCommandKind.procedure` for stored-procedure execution (the adapter maps it to EXEC/CALL; rows via `query`, no-rows via `execute`)
- add optional `DbProcedureOutcome` (returnValue, outputParameters) on `DbRowSet` and `DbExecutionSummary`
- extend shared-fixture conformance coverage for the new contracts across the three SDKs
- additive and non-breaking: `DbCommand` keeps its signature (parameters already accept any value)
- update `modular_api` dependency to `^0.6.0`

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes
- update `modular_api` dependency to `^0.5.0`

#### 0.4.8

- switch `modular_api` dependency from local path to published `^0.4.8`
- keep SQL Server metadata reader and connection settings in this package as the clean-room owner

#### 0.4.7

- bootstrap `modular_api_sqlserver` for Dart
- add the first SQL Server database client slice with shared contracts, repository helpers, and health support
- add tests for defaults, result helpers, lease ownership, transactions, close flows, and GraphQL support bundling

### TypeScript (npm)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.6.0

- add typed command parameters via `DbParameter` (name, value, direction input/output/inputOutput, free-form `typeHint`) with `input`/`output`/`inputOutput` helpers
- add `DbCommandKind.procedure` for stored-procedure execution (the adapter maps it to EXEC/CALL; rows via `query`, no-rows via `execute`)
- add optional `DbProcedureOutcome` (returnValue, outputParameters) on `DbRowSet` and `DbExecutionSummary`
- extend shared-fixture conformance coverage for the new contracts across the three SDKs
- additive and non-breaking: `DbCommand` keeps its signature (parameters already accept any value)

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.4.7

- bootstrap `@macss/modular-api-sqlserver`
- add the first SQL Server database client slice with shared contracts, repository helpers, and health support
- add tests for defaults, result helpers, lease ownership, transactions, close flows, and GraphQL support bundling

### Python (PyPI)

#### 0.7.1

- Version bump for cross-SDK parity (ADR-0002); no functional changes.

#### 0.7.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.6.0

- add typed command parameters via `DbParameter` (name, value, direction input/output/inputOutput, free-form `typeHint`) with `input`/`output`/`inputOutput` helpers
- add `DbCommandKind.procedure` for stored-procedure execution (the adapter maps it to EXEC/CALL; rows via `query`, no-rows via `execute`)
- add optional `DbProcedureOutcome` (returnValue, outputParameters) on `DbRowSet` and `DbExecutionSummary`
- extend shared-fixture conformance coverage for the new contracts across the three SDKs
- additive and non-breaking: `DbCommand` keeps its signature (parameters already accept any value)

#### 0.5.0

- version bump for cross-SDK parity (ADR-0002); no functional changes

#### 0.4.7

- bootstrap `macss-modular-api-sqlserver`
- add the first SQL Server database client slice with shared contracts, repository helpers, and health support
- add tests for defaults, result helpers, lease ownership, transactions, close flows, and GraphQL support bundling
