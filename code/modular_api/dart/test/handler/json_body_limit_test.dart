// Opt-in JSON body limit, per instance and per use case (#43). No default: nothing changes
// for an app that configures nothing.

import 'dart:convert';
import 'dart:io';

import 'package:modular_api/modular_api.dart';
import 'package:test/test.dart';

class EchoInput extends Input {
  final String text;
  EchoInput(this.text);
  factory EchoInput.fromJson(Map<String, dynamic> json) =>
      EchoInput((json['t'] ?? '') as String);
  @override
  Map<String, dynamic> toJson() => {'t': text};
  @override
  List<SchemaField>? get schemaFields => null;
}

class EchoOutput extends Output {
  final int length;
  EchoOutput(this.length);
  @override
  int get statusCode => 200;
  @override
  Map<String, dynamic> toJson() => {'length': length};
  @override
  List<SchemaField>? get schemaFields => null;
}

class EchoUseCase implements UseCase<EchoInput, EchoOutput> {
  @override
  final EchoInput input;
  @override
  ModularLogger? logger;
  EchoUseCase(this.input);
  factory EchoUseCase.fromJson(Map<String, dynamic> json) =>
      EchoUseCase(EchoInput.fromJson(json));
  @override
  String? validate() => null;
  @override
  Future<EchoOutput> execute() async => EchoOutput(input.text.length);
}

/// Body of exactly [bytes] bytes: `{"t":"aaa..."}`.
String bodyOfBytes(int bytes) {
  const overhead = 8; // {"t":""}
  final body = '{"t":"${'a' * (bytes - overhead)}"}';
  expect(utf8.encode(body).length, bytes);
  return body;
}

void main() {
  HttpServer? server;
  late HttpClient client;

  Future<void> start(
    int? instanceLimit,
    void Function(ModuleBuilder m) build,
  ) async {
    final api = ModularApi(basePath: '/api', jsonBodyLimit: instanceLimit);
    api.module('m', build);
    server = await api.serve(port: 0);
    client = HttpClient();
  }

  tearDown(() async {
    if (server != null) {
      client.close(force: true);
      await server!.close(force: true);
      server = null;
    }
  });

  Future<(int, String, String?)> post(String path, List<int> body,
      {bool chunked = false}) async {
    final req = await client.post('localhost', server!.port, '/api/m/$path');
    req.headers.contentType = ContentType.json;
    if (chunked) {
      req.headers.chunkedTransferEncoding = true;
    } else {
      req.contentLength = body.length;
    }
    req.add(body);
    final res = await req.close();
    final text = await utf8.decodeStream(res);
    return (res.statusCode, text, res.headers.contentType?.toString());
  }

  void register(ModuleBuilder m, String name, {int? limit, String? method}) {
    m.usecase(name, EchoUseCase.fromJson,
        method: method ?? 'POST',
        inputExample: EchoInput(''),
        outputExample: EchoOutput(0),
        jsonBodyLimit: limit);
  }

  test('no limit configured: a 1 MB body is still accepted', () async {
    await start(null, (m) => register(m, 'echo'));
    final r = await post('echo', utf8.encode(bodyOfBytes(1 << 20)));
    expect(r.$1, 200);
  });

  test('instance limit: exactly N accepted, N+1 rejected with 413', () async {
    await start(200, (m) => register(m, 'echo'));
    final ok = await post('echo', utf8.encode(bodyOfBytes(200)));
    expect(ok.$1, 200);
    final bad = await post('echo', utf8.encode(bodyOfBytes(201)));
    expect(bad.$1, 413);
    expect(jsonDecode(bad.$2), {'error': 'Request body too large'});
    expect(bad.$3, contains('application/json'));
  });

  test('per-use-case limit overrides the instance limit both ways', () async {
    await start(200, (m) {
      register(m, 'big', limit: 1000);
      register(m, 'small', limit: 50);
      register(m, 'inherit');
    });
    expect((await post('big', utf8.encode(bodyOfBytes(900)))).$1, 200);
    expect((await post('big', utf8.encode(bodyOfBytes(1001)))).$1, 413);
    expect((await post('small', utf8.encode(bodyOfBytes(50)))).$1, 200);
    expect((await post('small', utf8.encode(bodyOfBytes(51)))).$1, 413);
    expect((await post('inherit', utf8.encode(bodyOfBytes(200)))).$1, 200);
    expect((await post('inherit', utf8.encode(bodyOfBytes(201)))).$1, 413);
  });

  test('per-use-case limit with no instance limit leaves others unlimited',
      () async {
    await start(null, (m) {
      register(m, 'small', limit: 50);
      register(m, 'free');
    });
    expect((await post('small', utf8.encode(bodyOfBytes(51)))).$1, 413);
    expect((await post('free', utf8.encode(bodyOfBytes(100000)))).$1, 200);
  });

  test('chunked body (no Content-Length) over the limit is rejected', () async {
    await start(200, (m) => register(m, 'echo'));
    final ok = await post('echo', utf8.encode(bodyOfBytes(200)), chunked: true);
    expect(ok.$1, 200);
    // The server stops reading at limit + 1 and answers without consuming the rest, so
    // the client may see the connection reset before it reads the 413 (a race inherent to
    // refusing an upload midway). Either outcome proves the body was not accepted.
    try {
      final bad =
          await post('echo', utf8.encode(bodyOfBytes(201)), chunked: true);
      expect(bad.$1, 413);
      expect(jsonDecode(bad.$2), {'error': 'Request body too large'});
    } on HttpException {
      // connection closed by the server before the response was read
    } on SocketException {
      // same, as a reset
    }
  });

  test('the limit counts bytes, not characters', () async {
    await start(200, (m) => register(m, 'echo'));
    // 8 bytes of overhead + 64 euro signs (3 bytes each) = 200 bytes in 72 characters.
    final exact = '{"t":"${'€' * 64}"}';
    expect(utf8.encode(exact).length, 200);
    expect(exact.length, lessThan(200));
    expect((await post('echo', utf8.encode(exact))).$1, 200);
    // One more byte (a 1-byte char), still far below 200 characters.
    final over = '{"t":"${'€' * 64}a"}';
    expect(utf8.encode(over).length, 201);
    expect((await post('echo', utf8.encode(over))).$1, 413);
  });

  test('limit 0 rejects any non-empty body', () async {
    await start(null, (m) => register(m, 'echo', limit: 0));
    expect((await post('echo', utf8.encode('{}'))).$1, 413);
  });

  test('negative limit throws ArgumentError at registration', () {
    final api = ModularApi();
    expect(
      () => api.module('m', (m) => register(m, 'echo', limit: -1)),
      throwsArgumentError,
    );
    final api2 = ModularApi(jsonBodyLimit: -5);
    expect(
      () => api2.module('m', (m) => register(m, 'echo')),
      throwsArgumentError,
    );
  });

  test('GET use case is unaffected', () async {
    await start(0, (m) => register(m, 'echo', method: 'GET'));
    final req = await client.get('localhost', server!.port, '/api/m/echo');
    final res = await req.close();
    await res.drain<void>();
    expect(res.statusCode, 200);
  });
}
