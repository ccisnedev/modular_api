import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:modular_api/modular_api.dart';
import 'package:modular_api/src/core/modular_api.dart' show apiRegistry;
import 'package:test/test.dart';

/// PRD-003 assertions for GET /docs — Swagger UI (replaces Scalar).
///
///   1. GET /docs returns HTTP 200.
///   2. Content-Type header is text/html; charset=utf-8.
///   3. Response body contains swagger-ui-dist@5 CDN references.
///   4. Response body contains url: "/openapi.json" Swagger UI config.
///   5. Response body does NOT contain "scalar" (regression guard).
void main() {
  group('GET /docs — Swagger UI (PRD-003)', () {
    late HttpServer server;
    late int port;

    setUp(() async {
      apiRegistry.routes.clear();

      final api = ModularApi(
        basePath: '/api',
        title: 'Pet Store',
        version: '1.0.0',
      );

      server = await api.serve(port: 0);
      port = server.port;
    });

    tearDown(() async {
      await server.close(force: true);
      apiRegistry.routes.clear();
    });

    test('returns HTTP 200', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.statusCode, 200);
    });

    test('returns Content-Type text/html', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.headers['content-type'], contains('text/html'));
    });

    test('body contains swagger-ui-dist@5 CSS', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('swagger-ui-dist@5/swagger-ui.css'));
    });

    test('body contains swagger-ui-dist@5 JS bundle', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('swagger-ui-dist@5/swagger-ui-bundle.js'));
    });

    test('body contains url pointing to /openapi.json', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('url: "/openapi.json"'));
    });

    test('body does NOT contain scalar (PRD-003 regression guard)', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body.toLowerCase(), isNot(contains('scalar')));
    });

    test('interpolates the API title in the HTML', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('Pet Store'));
    });

    test('returns a complete HTML document', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('<!DOCTYPE html>'));
      expect(resp.body, contains('</html>'));
    });

    // ── PRD-004: System-aware dark mode ──────────────────────────

    test('contains prefers-color-scheme media query (PRD-004)', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('prefers-color-scheme: dark'));
    });

    test('contains CSS custom properties for theming (PRD-004)', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('--bg-primary'));
    });

    test('preserves HTTP method accent colors in dark mode (PRD-004)', () async {
      final resp = await http.get(Uri.parse('http://localhost:$port/docs'));
      expect(resp.body, contains('#49cc90'));
    });
  });
}
