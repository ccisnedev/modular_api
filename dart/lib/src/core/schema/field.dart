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
