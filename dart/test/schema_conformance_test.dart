import 'dart:convert';
import 'dart:io';

import 'package:test/test.dart';

import 'package:modular_api/src/core/usecase/usecase.dart';
import 'package:modular_api/src/core/schema/field.dart';

class HelloInput extends Input {
  @Field(description: 'Name to greet')
  final String name;
  HelloInput({required this.name});

  factory HelloInput.fromJson(Map<String, dynamic> json) =>
      HelloInput(name: (json['name'] ?? '').toString());

  @override
  Map<String, dynamic> toJson() => {'name': name};

  @override
  List<SchemaField> get schemaFields => [
        SchemaField.string('name', description: 'Name to greet'),
      ];
}

class HelloOutput extends Output {
  @Field(description: 'Greeting message')
  final String message;
  HelloOutput({this.message = ''});

  @override
  int get statusCode => 200;

  @override
  Map<String, dynamic> toJson() => {'message': message};

  @override
  List<SchemaField> get schemaFields => [
        SchemaField.string('message', description: 'Greeting message'),
      ];
}

/// Loads a JSON fixture relative to the monorepo root.
Map<String, dynamic> loadFixture(String name) {
  // From dart/test/ → ../../tests/fixtures/
  final path = '${Directory.current.path}/../tests/fixtures/$name';
  final file = File(path);
  if (!file.existsSync()) {
    // When running from dart/ directory
    final altPath = '${Directory.current.path}/tests/fixtures/$name';
    final altFile = File(altPath);
    if (altFile.existsSync()) {
      return jsonDecode(altFile.readAsStringSync()) as Map<String, dynamic>;
    }
    throw FileSystemException('Fixture not found', path);
  }
  return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
}

void main() {
  group('Schema Conformance', () {
    test('HelloInput schema matches shared fixture', () {
      final fixture = loadFixture('hello_input_schema.json');
      final input = HelloInput(name: 'test');
      expect(input.toSchema(), equals(fixture));
    });

    test('HelloOutput schema matches shared fixture', () {
      final fixture = loadFixture('hello_output_schema.json');
      final output = HelloOutput(message: 'test');
      expect(output.toSchema(), equals(fixture));
    });
  });
}
