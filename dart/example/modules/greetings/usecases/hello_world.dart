// ─── Input DTO ────────────────────────────────────────────────────────────────

import 'package:modular_api/modular_api.dart';

class HelloInput extends Input {
  final String name;

  HelloInput({required this.name});

  @override
  Map<String, dynamic> toJson() => {'name': name};

  @override
  List<SchemaField> get schemaFields => [
        SchemaField.string('name',
            description: 'Name to greet', example: 'World'),
      ];

  /// Example instance for schema extraction and Swagger UI.
  static HelloInput get example => HelloInput(name: 'World');
}

// ─── Output DTO ───────────────────────────────────────────────────────────────

class HelloOutput extends Output {
  final String message;

  HelloOutput({required this.message});

  @override
  int get statusCode => 200;

  @override
  Map<String, dynamic> toJson() => {'message': message};

  @override
  List<SchemaField> get schemaFields => [
        SchemaField.string('message',
            description: 'Greeting message', example: 'Hello, World!'),
      ];

  /// Example instance for schema extraction and Swagger UI.
  static HelloOutput get example => HelloOutput(message: 'Hello, World!');
}

// ─── UseCase ──────────────────────────────────────────────────────────────────

class HelloWorld implements UseCase<HelloInput, HelloOutput> {
  @override
  final HelloInput input;

  @override
  ModularLogger? logger;

  HelloWorld({required this.input});

  static HelloWorld fromJson(Map<String, dynamic> json) {
    return HelloWorld(
      input: HelloInput(
        name: json['name'],
      )
    );
  }

  @override
  String? validate() {
    if (input.name.isEmpty) {
      return 'name is required';
    }
    return null;
  }

  @override
  Future<HelloOutput> execute() async {
    logger?.info('Greeting user: ${input.name}');
    return HelloOutput(message: 'Hello, ${input.name}!');
  }
}