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
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {},
      };
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
  group('OpenApi.jsonToYaml', () {
    test('converts empty map to empty object', () {
      expect(OpenApi.jsonToYaml({}).trim(), '{}');
    });

    test('converts empty list to empty array', () {
      expect(OpenApi.jsonToYaml([]).trim(), '[]');
    });

    test('converts scalar values', () {
      final result = OpenApi.jsonToYaml({'key': 'value', 'num': 42});
      expect(result, contains('key: value'));
      expect(result, contains('num: 42'));
    });

    test('converts boolean and null values', () {
      final result =
          OpenApi.jsonToYaml({'flag': true, 'off': false, 'nothing': null});
      expect(result, contains('flag: true'));
      // 'off' is a YAML reserved word so the key is quoted
      expect(result, contains("'off': false"));
      expect(result, contains('nothing: null'));
    });

    test('converts nested maps', () {
      final result = OpenApi.jsonToYaml({
        'info': {
          'title': 'Test',
          'version': '1.0.0',
        },
      });
      expect(result, contains('info:'));
      expect(result, contains('  title: Test'));
      expect(result, contains('  version: 1.0.0'));
    });

    test('converts lists', () {
      final result = OpenApi.jsonToYaml({
        'tags': ['users', 'admin'],
      });
      expect(result, contains('tags:'));
      expect(result, contains('- users'));
      expect(result, contains('- admin'));
    });

    test('quotes strings that need quoting', () {
      final result = OpenApi.jsonToYaml({
        'reserved': 'true',
        'special': 'value: with colon',
      });
      expect(result, contains("'true'"));
      expect(result, contains("'value: with colon'"));
    });

    test('converts a full OpenAPI-like structure', () {
      final spec = {
        'openapi': '3.0.0',
        'info': {
          'title': 'Test API',
          'version': '1.0.0',
        },
        'paths': {
          '/api/test/ping': {
            'post': {
              'summary': 'Ping endpoint',
              'responses': {
                '200': {
                  'description': 'OK',
                },
              },
            },
          },
        },
      };

      final yaml = OpenApi.jsonToYaml(spec);
      expect(yaml, contains('openapi: 3.0.0'));
      expect(yaml, contains('info:'));
      expect(yaml, contains('  title: Test API'));
      expect(yaml, contains('paths:'));
      // /api/test/ping does not need quoting in YAML keys
      expect(yaml, contains('/api/test/ping:'));
    });
  });

  group('Integration: /openapi.json endpoint', () {
    late HttpServer server;
    late int port;

    setUp(() async {
      apiRegistry.routes.clear();

      final api = ModularApi(
        basePath: '/api',
        title: 'Test API',
        version: '1.0.0',
      );

      api.module('test', (m) {
        m.usecase('ping', _PingUseCase.fromJson);
      });

      server = await api.serve(port: 0);
      port = server.port;
    });

    tearDown(() async {
      await server.close(force: true);
      apiRegistry.routes.clear();
    });

    test('returns 200 with application/json content-type', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.json'));

      expect(resp.statusCode, 200);
      expect(resp.headers['content-type'], contains('application/json'));
    });

    test('returns valid OpenAPI spec with correct structure', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.json'));

      final spec = jsonDecode(resp.body) as Map<String, dynamic>;
      expect(spec['openapi'], '3.0.0');
      expect(spec['info'], isA<Map>());
      expect(spec['info']['title'], 'Test API');
      expect(spec['paths'], isA<Map>());
    });

    test('contains registered use case path', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.json'));

      final spec = jsonDecode(resp.body) as Map<String, dynamic>;
      final paths = spec['paths'] as Map<String, dynamic>;
      expect(paths, contains('/api/test/ping'));
    });

    test('spec has servers entry', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.json'));

      final spec = jsonDecode(resp.body) as Map<String, dynamic>;
      expect(spec['servers'], isA<List>());
      expect((spec['servers'] as List).isNotEmpty, isTrue);
    });
  });

  group('Integration: /openapi.yaml endpoint', () {
    late HttpServer server;
    late int port;

    setUp(() async {
      apiRegistry.routes.clear();

      final api = ModularApi(
        basePath: '/api',
        title: 'Test API',
        version: '1.0.0',
      );

      api.module('test', (m) {
        m.usecase('ping', _PingUseCase.fromJson);
      });

      server = await api.serve(port: 0);
      port = server.port;
    });

    tearDown(() async {
      await server.close(force: true);
      apiRegistry.routes.clear();
    });

    test('returns 200 with application/x-yaml content-type', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      expect(resp.statusCode, 200);
      expect(resp.headers['content-type'], contains('application/x-yaml'));
    });

    test('returns YAML with openapi version', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      expect(resp.body, contains('openapi: 3.0.0'));
    });

    test('YAML contains registered use case path', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      expect(resp.body, contains('/api/test/ping'));
    });

    test('YAML contains info section', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      expect(resp.body, contains('info:'));
      expect(resp.body, contains('title: Test API'));
    });

    test('YAML is not JSON (does not start with {)', () async {
      final resp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      expect(resp.body.trimLeft().startsWith('{'), isFalse);
    });
  });

  group('OpenAPI spec consistency', () {
    late HttpServer server;
    late int port;

    setUp(() async {
      apiRegistry.routes.clear();

      final api = ModularApi(
        basePath: '/api',
        title: 'Consistency Test',
        version: '2.0.0',
      );

      api.module('test', (m) {
        m.usecase('ping', _PingUseCase.fromJson);
      });

      server = await api.serve(port: 0);
      port = server.port;
    });

    tearDown(() async {
      await server.close(force: true);
      apiRegistry.routes.clear();
    });

    test('JSON and YAML represent the same spec', () async {
      final jsonResp =
          await http.get(Uri.parse('http://localhost:$port/openapi.json'));
      final yamlResp =
          await http.get(Uri.parse('http://localhost:$port/openapi.yaml'));

      // Both should return 200
      expect(jsonResp.statusCode, 200);
      expect(yamlResp.statusCode, 200);

      // JSON should be parseable
      final spec = jsonDecode(jsonResp.body) as Map<String, dynamic>;
      expect(spec['openapi'], '3.0.0');

      // YAML should contain the same title
      expect(yamlResp.body, contains('title: Consistency Test'));
    });
  });
}
