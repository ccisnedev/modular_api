// Logging, metrics and tracing treat path variants consistently (#47).
//
// The rule: an operational endpoint is excluded only on its exact path. A
// variant such as /health/ or /HEALTH is not that endpoint — the router answers
// 404 — so it is logged, traced and counted under route="UNMATCHED".

import 'dart:convert';
import 'dart:io';

import 'package:dartastic_opentelemetry/dartastic_opentelemetry.dart' as sdk;
import 'package:dartastic_opentelemetry/testing.dart';
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/logger/logging_middleware.dart';
import 'package:shelf/shelf.dart' show Pipeline;
import 'package:test/test.dart';

const variants = ['/api/health/', '/api/HEALTH', '/api//health'];

void main() {
  late TestHarness harness;

  setUpAll(() async {
    harness = await maybeInitializeOtelForTest(serviceName: 'modular_api-test');
  });

  group('through ModularApi: traces and metrics', () {
    late HttpServer server;
    late HttpClient client;

    setUp(() async {
      harness.clear();
      final api = ModularApi(
        basePath: '/api',
        logLevel: LogLevel.emergency,
        metricsEnabled: true,
        tracing: TracingOptions(tracerProvider: sdk.OTel.tracerProvider()),
      );
      server = await api.serve(port: 0);
      client = HttpClient();
    });

    tearDown(() async {
      client.close(force: true);
      await server.close(force: true);
    });

    /// Sends [rawPath] as written: dart:io does not normalize the request target.
    Future<(int, String)> get(String rawPath) async {
      final req = await client.open('GET', 'localhost', server.port, rawPath);
      req.followRedirects = false;
      final res = await req.close();
      return (res.statusCode, await res.transform(utf8.decoder).join());
    }

    Future<List<String>> requestMetrics() async {
      final (_, text) = await get('/api/metrics');
      return text
          .split('\n')
          .where((l) => l.startsWith('http_requests_total{'))
          .toList();
    }

    test('the exact operational path stays excluded', () async {
      expect((await get('/api/health')).$1, 200);

      expect(harness.spans.spans, isEmpty);
      expect(await requestMetrics(), isEmpty);
    });

    for (final path in variants) {
      test('$path is a 404 like any other: traced and UNMATCHED', () async {
        expect((await get(path)).$1, 404);

        expect(harness.spans.spans, hasLength(1));
        expect(await requestMetrics(), [
          'http_requests_total{method="GET",route="UNMATCHED",status_code="404"} 1',
        ]);
      });
    }
  });

  group('logging middleware with the exclusions ModularApi passes', () {
    Future<List<Map<String, dynamic>>> logsFor(String path, int status) async {
      final sink = StringBuffer();
      final handler = const Pipeline()
          .addMiddleware(loggingMiddleware(
            logLevel: LogLevel.info,
            serviceName: 'test',
            sink: sink,
            excludedRoutes: const ['/api/health'],
          ))
          .addHandler((_) => Response(status));
      await handler(Request('GET', Uri.parse('http://localhost$path')));
      return const LineSplitter()
          .convert(sink.toString())
          .map((l) => jsonDecode(l) as Map<String, dynamic>)
          .where((l) => l['msg'] == 'request completed')
          .toList();
    }

    test('the exact operational path is not logged', () async {
      expect(await logsFor('/api/health', 200), isEmpty);
    });

    for (final path in variants) {
      test('$path is logged with its 404', () async {
        final logs = await logsFor(path, 404);
        expect(logs, hasLength(1));
        expect(logs.single['status'], 404);
      });
    }
  });
}
