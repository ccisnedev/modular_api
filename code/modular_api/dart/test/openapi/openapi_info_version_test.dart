import 'dart:convert';
import 'dart:io';

import 'package:modular_api/modular_api.dart';
import 'package:test/test.dart';

/// `info.version` must reflect the `version` given to `ModularApi` (#38).
///
/// Two instances with different versions must produce different documents: a test that checks a
/// single value would also pass with the field hard-coded to that value, which is how the constant
/// survived until now.
void main() {
  for (final version in ['2.0.0', '9.9.9']) {
    test('openapi.json and openapi.yaml carry info.version $version', () async {
      final api =
          ModularApi(basePath: '/api', title: 'Versioned', version: version);
      final server = await api.serve(port: 0);
      addTearDown(() => server.close(force: true));

      final client = HttpClient();
      addTearDown(client.close);

      final json =
          jsonDecode(await _get(client, server.port, '/api/openapi.json'))
              as Map<String, dynamic>;
      expect((json['info'] as Map<String, dynamic>)['version'], version);

      final yaml = await _get(client, server.port, '/api/openapi.yaml');
      expect(
          yaml,
          contains(RegExp('^  version: "?${RegExp.escape(version)}"?\$',
              multiLine: true)));
    });
  }
}

Future<String> _get(HttpClient client, int port, String path) async {
  final request = await client.getUrl(Uri.parse('http://127.0.0.1:$port$path'));
  final response = await request.close();
  expect(response.statusCode, 200, reason: path);
  return utf8.decodeStream(response);
}
