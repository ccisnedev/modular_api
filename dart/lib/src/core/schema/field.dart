/// Schema field metadata for automatic `toSchema()` generation.
///
/// Dart does not have runtime reflection for annotations.
/// Instead of macros (experimental in Dart 3.5+), we use a declarative
/// `schemaFields` getter on Input/Output that lists field metadata.
/// The base class `Input.toSchema()` / `Output.toSchema()` builds the
/// OpenAPI 3.0.3-compatible JSON Schema automatically from this list.
///
/// The `@Field` annotation is decorative — it documents the field's purpose
/// and will be consumed by `@MacssSchema()` macro when macros stabilize.
///
/// ```dart
/// class HelloInput extends Input {
///   @Field(description: 'Name to greet')
///   final String name;
///
///   HelloInput({required this.name});
///
///   @override
///   List<SchemaField> get schemaFields => [
///     SchemaField.string('name', description: 'Name to greet'),
///   ];
///   // toSchema() → auto-derived from schemaFields!
/// }
/// ```
library;

/// Decorative annotation for field metadata.
///
/// Used for documentation, IDE support, and future macro consumption.
/// Does NOT affect runtime behavior in the current version.
class Field {
  final String? description;

  const Field({this.description});
}

/// Metadata for a single schema field.
///
/// Used by [Input.toSchema] and [Output.toSchema] to build
/// OpenAPI 3.0.3-compatible JSON Schemas automatically.
class SchemaField {
  final String name;
  final String type;
  final String? description;
  final bool required;
  final bool nullable;
  final SchemaField? items;

  const SchemaField(
    this.name,
    this.type, {
    this.description,
    this.required = true,
    this.nullable = false,
    this.items,
  });

  factory SchemaField.string(String name, {String? description}) =>
      SchemaField(name, 'string', description: description);

  factory SchemaField.integer(String name, {String? description}) =>
      SchemaField(name, 'integer', description: description);

  factory SchemaField.number(String name, {String? description}) =>
      SchemaField(name, 'number', description: description);

  factory SchemaField.boolean(String name, {String? description}) =>
      SchemaField(name, 'boolean', description: description);

  factory SchemaField.array(
    String name,
    SchemaField itemType, {
    String? description,
  }) =>
      SchemaField(name, 'array', description: description, items: itemType);

  factory SchemaField.optional(SchemaField inner) => SchemaField(
        inner.name,
        inner.type,
        description: inner.description,
        required: false,
        nullable: true,
        items: inner.items,
      );
}

/// Builds an OpenAPI 3.0.3 JSON Schema from a list of [SchemaField] entries.
Map<String, dynamic> buildSchema(List<SchemaField> fields) {
  final properties = <String, Map<String, dynamic>>{};
  final required = <String>[];

  for (final field in fields) {
    final prop = <String, dynamic>{'type': field.type};
    if (field.description != null) {
      prop['description'] = field.description;
    }
    if (field.nullable) {
      prop['nullable'] = true;
    }
    if (field.items != null) {
      prop['items'] = {'type': field.items!.type};
    }
    properties[field.name] = prop;

    if (field.required) {
      required.add(field.name);
    }
  }

  final schema = <String, dynamic>{
    'type': 'object',
    'properties': properties,
  };
  if (required.isNotEmpty) {
    schema['required'] = required;
  }
  return schema;
}

/// Thrown by [validateJsonFields] when a required field is missing
/// or has the wrong JSON type.
///
/// Error messages follow the cross-SDK parity contract:
///   - `"Missing required field: {name}"`
///   - `"Field '{name}' must be of type {type}"`
class InputValidationException implements Exception {
  final String message;

  InputValidationException(this.message);

  @override
  String toString() => 'InputValidationException: $message';
}

/// Validates raw JSON against a list of [SchemaField] entries.
///
/// Throws [InputValidationException] when a required field is missing
/// or has the wrong JSON type. The handler catches this and returns 400.
///
/// Business-rule validation belongs in `UseCase.validate()` instead.
void validateJsonFields(Map<String, dynamic> json, List<SchemaField> fields) {
  for (final field in fields) {
    if (!field.required) continue;

    if (!json.containsKey(field.name) || json[field.name] == null) {
      throw InputValidationException('Missing required field: ${field.name}');
    }

    if (!_isJsonTypeValid(json[field.name], field.type)) {
      throw InputValidationException(
        "Field '${field.name}' must be of type ${field.type}",
      );
    }
  }
}

/// Checks whether a JSON value matches the expected OpenAPI type.
bool _isJsonTypeValid(dynamic value, String expectedType) {
  switch (expectedType) {
    case 'string':
      return value is String;
    case 'integer':
      return value is int;
    case 'number':
      return value is num;
    case 'boolean':
      return value is bool;
    case 'array':
      return value is List;
    default:
      return true;
  }
}
