import 'package:modular_api/src/core/logger/logger.dart';

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
/// Pure interface: all members must be provided by the implementor.
/// No default behavior is inherited — every Input is self-contained.
abstract class Input {
  /// El contrato no impone fromJson;
  factory Input.fromJson(Map<String, dynamic> json) {
    throw UnimplementedError('Must implement fromJson');
  }
  Map<String, dynamic> toJson();

  /// Schema
  /// Required for OpenApi specification
  Map<String, dynamic> toSchema();
}

/// **Contract** — use `implements Output`.
///
/// Pure interface: all members must be provided by the implementor.
/// The implementor must define `statusCode` explicitly — this forces
/// developers to think about HTTP status codes for every response.
abstract class Output {
  Map<String, dynamic> toJson();

  /// Schema
  /// Required for OpenApi specification
  Map<String, dynamic> toSchema();

  /// HTTP status code to return.
  /// Must be implemented explicitly (e.g. 200, 201, 400, 404).
  int get statusCode;
}
