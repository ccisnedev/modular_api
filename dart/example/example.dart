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

  print('====================================');
  print('API     → http://localhost:$port/api/greetings/hello');
  print('====================================');
}

// ─── Module Builder ───────────────────────────────────────────────────────────
// In a real project, this would live in its own file:
//   lib/modules/greetings/greetings_builder.dart

void buildGreetingsModule(ModuleBuilder m) {
  m.usecase('hello', HelloWorld.fromJson);
}

// ─── Input DTO ────────────────────────────────────────────────────────────────

class HelloInput implements Input {
  final String name;

  HelloInput({required this.name});

  factory HelloInput.fromJson(Map<String, dynamic> json) =>
      HelloInput(name: (json['name'] ?? '').toString());

  @override
  Map<String, dynamic> toJson() => {'name': name};

  @override
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {
          'name': {'type': 'string', 'description': 'Name to greet'},
        },
        'required': ['name'],
      };
}

// ─── Output DTO ───────────────────────────────────────────────────────────────

class HelloOutput implements Output {
  final String message;

  HelloOutput({this.message = ''});

  factory HelloOutput.fromJson(Map<String, dynamic> json) =>
      HelloOutput(message: (json['message'] ?? '').toString());

  @override
  int get statusCode => 200;

  @override
  Map<String, dynamic> toJson() => {'message': message};

  @override
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {
          'message': {'type': 'string', 'description': 'Greeting message'},
        },
        'required': ['message'],
      };
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
    output = HelloOutput();
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
