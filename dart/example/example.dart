/// example/example.dart
/// Minimal runnable example — mirrors example/example.dart from the Dart version.
///
/// Run:
///   dart run example/example.dart
///
/// Then test:
///   curl -X POST http://localhost:8080/api/greetings/hello \
///        -H "Content-Type: application/json" \
///        -d '{"name":"World"}'
///
/// Docs:
///   http://localhost:8080/docs
library;

import 'package:modular_api/modular_api.dart';

// ─── Server ───────────────────────────────────────────────────────────────────

Future<void> main(List<String> args) async {
  // First positional arg overrides the default port (e.g. `dart run example/example.dart 9090`).
  final port = args.isNotEmpty ? int.parse(args.first) : 8080;

  final api = ModularApi(
    basePath: '/api',
    title: 'Modular API',
    version: '1.0.0',
    // Opt-in Prometheus metrics at GET /metrics
    metricsEnabled: true,
    // Structured JSON logging (Loki/Grafana compatible)
    logLevel: LogLevel.debug,
  );

  // Register health checks (optional — /health works without any checks)
  api.addHealthCheck(AlwaysPassHealthCheck());

  // Register custom metrics (only when metricsEnabled: true)
  // ignore: unused_local_variable
  final customOps = api.metrics?.createCounter(
    name: 'greetings_total',
    help: 'Total greetings served.',
  );

  api.module('greetings', buildGreetingsModule);

  await api.serve(port: port);
}

// ─── Module Builder ───────────────────────────────────────────────────────────
// In a real project, this would live in its own file:
//   lib/modules/greetings/greetings_builder.dart

void buildGreetingsModule(ModuleBuilder m) {
  m.usecase(
    'hello',
    HelloWorld.fromJson,
    inputExample: HelloInput.example,
    outputExample: HelloOutput.example,
  );
}

// ─── Input DTO ────────────────────────────────────────────────────────────────

class HelloInput extends Input {
  @Field(description: 'Name to greet')
  final String name;

  HelloInput({required this.name});

  /// Strict factory — no coercion, no defaults.
  /// Pre-validation in the handler ensures data is valid before this runs.
  factory HelloInput.fromJson(Map<String, dynamic> json) => HelloInput(
        name: json['name'] as String,
      );

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
  @Field(description: 'Greeting message')
  final String message;

  HelloOutput({required this.message});

  factory HelloOutput.fromJson(Map<String, dynamic> json) =>
      HelloOutput(message: json['message'] as String);

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
  late HelloOutput output;

  @override
  ModularLogger? logger;

  HelloWorld({required this.input}) {
    output = HelloOutput(message: '');
  }

  static HelloWorld fromJson(Map<String, dynamic> json) {
    return HelloWorld(input: HelloInput.fromJson(json));
  }

  @override
  String? validate() {
    if (input.name.isEmpty) {
      return 'name is required';
    }
    return null;
  }

  @override
  Future<void> execute() async {
    logger?.info('Greeting user: ${input.name}');
    output = HelloOutput(message: 'Hello, ${input.name}!');
  }

  @override
  Map<String, dynamic> toJson() => output.toJson();
}

// ─── Example Health Check ─────────────────────────────────────────────────────
// In a real project you'd check a database connection, external service, etc.

class AlwaysPassHealthCheck extends HealthCheck {
  @override
  final String name = 'example';

  @override
  Future<HealthCheckResult> check() async {
    return HealthCheckResult(status: HealthStatus.pass);
  }
}
