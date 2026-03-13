import 'package:modular_api/src/core/logger/logger.dart';
import 'package:modular_api/src/core/schema/field.dart';

/// **Contract** — use `implements UseCase<I, O>`.
///
/// Pure interface: all members must be provided by the implementor.
/// No default behavior is inherited — every UseCase is self-contained.
///
/// Lifecycle (handled by the framework):
///   1. `fromJson(json)`    — static factory, builds the use case
///   2. `validate()`        — return error string or null
///   3. `execute()`         — run business logic, set `this.output`
///   4. `output.toJson()`   — serialize and return to HTTP client
abstract class UseCase<I extends Input, O extends Output> {
  /// DTO entrada
  /// Debe ser inicializado en el constructor
  /// si no se inicializa en el contructor no se puede inferir el esquema
  /// para OpenApi
  I get input;

  /// DTO salida
  /// Debe ser inicializado en el constructor
  /// si no se inicializa en el contructor no se puede inferir el esquema
  /// para OpenApi
  late O output;

  /// Logger scoped to the current HTTP request.
  /// Set by the framework before [execute] is called.
  /// Use `logger?.info(...)` etc. inside [execute] for structured logging.
  ModularLogger? logger;

  /// Read from DTO
  /// Deserialize the use case data from JSON
  factory UseCase.fromJson(Map<String, dynamic> json) {
    throw UnimplementedError('Must implement fromJson');
  }

  /// Validate the use case data
  String? validate();

  /// Execute the use case logic
  /// Bussiness logic should be implemented here
  Future<void> execute();

  /// Write to DTO
  /// Serialize the use case data to JSON
  Map<String, dynamic> toJson();
}

/// **Contract** — use `implements Input`.
///
/// When a subclass provides [schemaFields], [toSchema] is derived
/// automatically. Manual overrides still work (deprecated — will be
/// removed in v0.5.0).
///
/// ```dart
/// class HelloInput implements Input {
///   @Field(description: 'Name to greet')
///   final String name;
///
///   HelloInput({required this.name});
///
///   factory HelloInput.fromJson(Map<String, dynamic> json) =>
///       HelloInput(name: (json['name'] ?? '').toString());
///
///   @override
///   Map<String, dynamic> toJson() => {'name': name};
///
///   @override
///   List<SchemaField> get schemaFields => [
///     SchemaField.string('name', description: 'Name to greet'),
///   ];
/// }
/// ```
abstract class Input {
  /// Generative constructor — enables `extends Input` for auto-schema.
  Input();

  /// El contrato no impone fromJson;
  factory Input.fromJson(Map<String, dynamic> json) {
    throw UnimplementedError('Must implement fromJson');
  }
  Map<String, dynamic> toJson();

  /// Override to provide field metadata for automatic schema generation.
  /// When provided, [toSchema] is derived automatically.
  /// Returns `null` by default (legacy path — manual toSchema required).
  List<SchemaField>? get schemaFields => null;

  /// Schema — required for OpenAPI specification.
  /// When [schemaFields] is provided, the schema is derived automatically.
  Map<String, dynamic> toSchema() {
    final fields = schemaFields;
    if (fields != null) {
      return buildSchema(fields);
    }
    throw UnimplementedError(
      '${runtimeType}.toSchema() not implemented. '
      'Override schemaFields or toSchema().',
    );
  }
}

/// **Contract** — use `implements Output`.
///
/// When a subclass provides [schemaFields], [toSchema] is derived
/// automatically. The implementor must define `statusCode` explicitly —
/// this forces developers to think about HTTP status codes for every response.
abstract class Output {
  /// Generative constructor — enables `extends Output` for auto-schema.
  Output();

  Map<String, dynamic> toJson();

  /// Override to provide field metadata for automatic schema generation.
  List<SchemaField>? get schemaFields => null;

  /// Schema — required for OpenAPI specification.
  /// When [schemaFields] is provided, the schema is derived automatically.
  Map<String, dynamic> toSchema() {
    final fields = schemaFields;
    if (fields != null) {
      return buildSchema(fields);
    }
    throw UnimplementedError(
      '${runtimeType}.toSchema() not implemented. '
      'Override schemaFields or toSchema().',
    );
  }

  /// HTTP status code to return.
  /// Must be implemented explicitly (e.g. 200, 201, 400, 404).
  int get statusCode;
}
