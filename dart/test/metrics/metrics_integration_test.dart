import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/modular_api.dart' show apiRegistry;
import 'package:test/test.dart';

// ── Minimal UseCase for integration tests ────────────────────────────────

class _PingInput implements Input {
  _PingInput();
  factory _PingInput.fromJson(Map<String, dynamic> json) => _PingInput();
  @override
  Map<String, dynamic> toJson() => {};
  @override
  Map<String, dynamic> toSchema() => {'type': 'object', 'properties': {}};
}

class _PingOutput implements Output {
  _PingOutput();
  @override
  Map<String, dynamic> toJson() => {'pong': true};
  @override
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {
          'pong': {'type': 'boolean'},
        },
      };
  @override
  int get statusCode => 200;
}

class _PingUseCase implements UseCase<_PingInput, _PingOutput> {
  @override
  final _PingInput input;
  @override
  late _PingOutput output;
  @override
  ModularLogger? logger;

  _PingUseCase(this.input);
  static _PingUseCase fromJson(Map<String, dynamic> json) =>
      _PingUseCase(_PingInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<void> execute() async {
    output = _PingOutput();
  }

  @override
  Map<String, dynamic> toJson() => output.toJson();
}

// ── Tests ────────────────────────────────────────────────────────────────

void main() {
  group('ModularApi metrics integration', () {
    late HttpServer server;
    late String baseUrl;

    tearDown(() async {
      await server.close(force: true);
      // Clear global registry for next test
      apiRegistry.routes.clear();
    });

    Future<HttpServer> startServer({bool metricsEnabled = false}) async {
      final api = ModularApi(
        basePath: '/api',
        title: 'Test API',
        version: '1.0.0',
        metricsEnabled: metricsEnabled,
      );
      api.module('test', (m) {
        m.usecase('ping', _PingUseCase.fromJson);
      });
      server = await api.serve(port: 0);
      baseUrl = 'http://localhost:${server.port}';
      return server;
    }

    test('metrics disabled by default — /metrics returns 404', () async {
      await startServer(metricsEnabled: false);
      final response = await http.get(Uri.parse('$baseUrl/metrics'));
      expect(response.statusCode, equals(404));
    });

    test(
        'metrics enabled — GET /metrics returns 200 with prometheus content type',
        () async {
      await startServer(metricsEnabled: true);
      final response = await http.get(Uri.parse('$baseUrl/metrics'));
      expect(response.statusCode, equals(200));
      expect(
        response.headers['content-type'],
        contains('text/plain'),
      );
      expect(response.body, contains('process_start_time_seconds'));
    });

    test('metrics enabled — requests are instrumented', () async {
      await startServer(metricsEnabled: true);

      // Make a request to the use case endpoint
      await http.post(
        Uri.parse('$baseUrl/api/test/ping'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({}),
      );

      // Check metrics endpoint
      final metricsResponse = await http.get(Uri.parse('$baseUrl/metrics'));
      final body = metricsResponse.body;

      expect(body, contains('http_requests_total'));
      expect(body, contains('method="POST"'));
      expect(body, contains('status_code="200"'));
      expect(body, contains('route="/api/test/ping"'));
      expect(body, contains('http_request_duration_seconds'));
    });

    test('metrics enabled — /health and /docs not instrumented', () async {
      await startServer(metricsEnabled: true);

      // Hit health and docs
      await http.get(Uri.parse('$baseUrl/health'));
      await http.get(Uri.parse('$baseUrl/docs'));

      // Metrics should not contain health or docs routes
      final metricsResponse = await http.get(Uri.parse('$baseUrl/metrics'));
      final body = metricsResponse.body;

      // Only process_start_time_seconds should be present
      // No http_requests_total lines (since only excluded routes were hit)
      expect(body, isNot(contains('route="/health"')));
      expect(body, isNot(contains('route="/docs"')));
    });

    test('metrics getter returns MetricsRegistrar when enabled', () async {
      final api = ModularApi(
        basePath: '/api',
        version: '1.0.0',
        metricsEnabled: true,
      );
      expect(api.metrics, isNotNull);
    });

    test('metrics getter returns null when disabled', () async {
      final api = ModularApi(basePath: '/api', version: '1.0.0');
      expect(api.metrics, isNull);
    });

    test('custom metrics appear in /metrics output', () async {
      final api = ModularApi(
        basePath: '/api',
        version: '1.0.0',
        metricsEnabled: true,
      );
      api.module('test', (m) {
        m.usecase('ping', _PingUseCase.fromJson);
      });

      // Register a custom metric
      final customCounter = api.metrics!.createCounter(
        name: 'custom_operations_total',
        help: 'Custom operations counter',
      );
      customCounter.labels({'type': 'test'}).inc(42);

      server = await api.serve(port: 0);
      baseUrl = 'http://localhost:${server.port}';

      final response = await http.get(Uri.parse('$baseUrl/metrics'));
      expect(response.body, contains('custom_operations_total'));
      expect(response.body, contains('type="test"'));
      expect(response.body, contains('42'));
    });
  });
}
