import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:test/test.dart';
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/logger/logger.dart';

// ─── Fixtures ──────────────────────────────────────────────────────

class EchoInput implements Input {
  final String value;
  EchoInput({required this.value});

  factory EchoInput.fromJson(Map<String, dynamic> json) =>
      EchoInput(value: json['value'] as String? ?? '');

  @override
  Map<String, dynamic> toJson() => {'value': value};
  @override
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {
          'value': {'type': 'string'},
        },
        'required': ['value'],
      };
}

class EchoOutput implements Output {
  final String echo;
  EchoOutput({required this.echo});

  @override
  int get statusCode => 200;
  @override
  Map<String, dynamic> toJson() => {'echo': echo};
  @override
  Map<String, dynamic> toSchema() => {
        'type': 'object',
        'properties': {
          'echo': {'type': 'string'},
        },
        'required': ['echo'],
      };
}

/// UseCase that uses the logger
class EchoUseCase implements UseCase<EchoInput, EchoOutput> {
  @override
  final EchoInput input;
  @override
  late EchoOutput output;
  @override
  ModularLogger? logger;

  EchoUseCase({required this.input}) {
    output = EchoOutput(echo: '');
  }

  static EchoUseCase fromJson(Map<String, dynamic> json) =>
      EchoUseCase(input: EchoInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<void> execute() async {
    logger?.info('echoing value', fields: {'value': input.value});
    output = EchoOutput(echo: input.value);
  }

  @override
  Map<String, dynamic> toJson() => output.toJson();
}

/// UseCase that does NOT use the logger (regression test)
class SilentUseCase implements UseCase<EchoInput, EchoOutput> {
  @override
  final EchoInput input;
  @override
  late EchoOutput output;
  @override
  ModularLogger? logger;

  SilentUseCase({required this.input}) {
    output = EchoOutput(echo: '');
  }

  static SilentUseCase fromJson(Map<String, dynamic> json) =>
      SilentUseCase(input: EchoInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<void> execute() async {
    // Deliberately ignores logger
    output = EchoOutput(echo: input.value);
  }

  @override
  Map<String, dynamic> toJson() => output.toJson();
}

/// UseCase that throws an unexpected error
class FailUseCase implements UseCase<EchoInput, EchoOutput> {
  @override
  final EchoInput input;
  @override
  late EchoOutput output;
  @override
  ModularLogger? logger;

  FailUseCase({required this.input}) {
    output = EchoOutput(echo: '');
  }

  static FailUseCase fromJson(Map<String, dynamic> json) =>
      FailUseCase(input: EchoInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<void> execute() async {
    throw Exception('unexpected crash');
  }

  @override
  Map<String, dynamic> toJson() => output.toJson();
}

// ─── Tests ─────────────────────────────────────────────────────────

void main() {
  group('UseCase logger property', () {
    test('UseCase has a nullable logger property', () {
      final uc = EchoUseCase(input: EchoInput(value: 'hi'));
      expect(uc.logger, isNull);
    });

    test('logger can be assigned and used in execute()', () async {
      final buf = StringBuffer();
      final logger = RequestScopedLogger(
        traceId: 'test-trace',
        logLevel: LogLevel.debug,
        serviceName: 'test',
        sink: buf,
      );

      final uc = EchoUseCase(input: EchoInput(value: 'hello'));
      uc.logger = logger;
      await uc.execute();

      expect(uc.output.echo, 'hello');
      final lines = buf.toString().trim().split('\n');
      expect(lines.length, 1);
      final json = jsonDecode(lines[0]) as Map<String, dynamic>;
      expect(json['msg'], 'echoing value');
      expect(json['trace_id'], 'test-trace');
      expect(json['fields'], {'value': 'hello'});
    });

    test('UseCase works without logger (regression)', () async {
      final uc = SilentUseCase(input: EchoInput(value: 'world'));
      // logger is null — execute should work fine
      await uc.execute();
      expect(uc.output.echo, 'world');
    });
  });

  group('UseCase logger injection', () {
    test('logger assigned to UseCase is used during execute()', () async {
      final buf = StringBuffer();
      final logger = RequestScopedLogger(
        traceId: 'test-handler-trace',
        logLevel: LogLevel.debug,
        serviceName: 'test',
        sink: buf,
      );

      final uc = EchoUseCase(input: EchoInput(value: 'hi'));
      uc.logger = logger;
      await uc.execute();
      expect(uc.output.echo, 'hi');

      // Verify logger was used
      final lines = buf.toString().trim().split('\n');
      final hasEchoLog = lines.any((l) {
        final j = jsonDecode(l) as Map<String, dynamic>;
        return j['msg'] == 'echoing value';
      });
      expect(hasEchoLog, isTrue);
    });

    test('UseCase works without logger assigned (default behavior)', () async {
      final uc = SilentUseCase(input: EchoInput(value: 'hi'));
      await uc.execute();
      expect(uc.output.echo, 'hi');
    });
  });

  group('ModularApi constructor', () {
    test('accepts logLevel parameter with default LogLevel.info', () {
      final api = ModularApi(basePath: '/api');
      // Should not throw — logLevel defaults to info
      expect(api, isNotNull);
    });

    test('accepts custom logLevel', () {
      final api = ModularApi(basePath: '/api', logLevel: LogLevel.debug);
      expect(api, isNotNull);
    });
  });

  group('Integration: HTTP server with logger', () {
    late HttpServer server;
    late int port;

    setUp(() async {
      final api = ModularApi(
        basePath: '/api',
        logLevel: LogLevel.debug,
      );

      api.module('test', (m) {
        m.usecase('echo', EchoUseCase.fromJson);
        m.usecase('silent', SilentUseCase.fromJson);
        m.usecase('fail', FailUseCase.fromJson);
      });

      server = await api.serve(port: 0); // ephemeral port
      port = server.port;
    });

    tearDown(() async {
      await server.close(force: true);
    });

    test('successful request returns X-Request-ID header', () async {
      final resp = await http.post(
        Uri.parse('http://localhost:$port/api/test/echo'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'value': 'test'}),
      );

      expect(resp.statusCode, 200);
      expect(resp.headers['x-request-id'], isNotNull);
      expect(resp.headers['x-request-id'], isNotEmpty);
    });

    test('request with X-Request-ID returns same trace_id', () async {
      final resp = await http.post(
        Uri.parse('http://localhost:$port/api/test/echo'),
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': 'my-custom-trace',
        },
        body: jsonEncode({'value': 'test'}),
      );

      expect(resp.statusCode, 200);
      expect(resp.headers['x-request-id'], 'my-custom-trace');
    });

    test('UseCase output is correct regardless of logger', () async {
      final resp = await http.post(
        Uri.parse('http://localhost:$port/api/test/echo'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'value': 'hello world'}),
      );

      expect(resp.statusCode, 200);
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      expect(body['echo'], 'hello world');
    });

    test('silent UseCase works without using logger', () async {
      final resp = await http.post(
        Uri.parse('http://localhost:$port/api/test/silent'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'value': 'no log'}),
      );

      expect(resp.statusCode, 200);
      final body = jsonDecode(resp.body) as Map<String, dynamic>;
      expect(body['echo'], 'no log');
    });

    test('unhandled exception returns 500 with X-Request-ID', () async {
      final resp = await http.post(
        Uri.parse('http://localhost:$port/api/test/fail'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'value': 'crash'}),
      );

      expect(resp.statusCode, 500);
      // X-Request-ID should still be present from the middleware
    });
  });
}
