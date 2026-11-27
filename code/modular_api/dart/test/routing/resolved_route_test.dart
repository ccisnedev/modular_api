// Routing is strict, and middlewares can read the use case that will run (#47).
//
// The variant table from the issue is kept as a regression test: a middleware that compares the
// path exactly must not be bypassed by writing the path differently.

import 'dart:convert';
import 'dart:io';

import 'package:modular_api/modular_api.dart';
import 'package:test/test.dart';

const canonical = '/api/v1/payments/execute';

final executions = <String>[];
final seen = <ResolvedRoute?>[];

class PayInput extends Input {
  final String note;
  PayInput({this.note = ''});

  factory PayInput.fromJson(Map<String, dynamic> json) =>
      PayInput(note: (json['note'] as String?) ?? '');

  @override
  Map<String, dynamic> toJson() => {'note': note};

  @override
  List<SchemaField>? get schemaFields => null;
}

class PayOutput extends Output {
  @override
  int get statusCode => 200;

  @override
  Map<String, dynamic> toJson() => {'paid': true};

  @override
  List<SchemaField>? get schemaFields => null;
}

class ExecutePayment implements UseCase<PayInput, PayOutput> {
  @override
  final PayInput input;

  @override
  ModularLogger? logger;

  ExecutePayment(this.input);

  factory ExecutePayment.fromJson(Map<String, dynamic> json) =>
      ExecutePayment(PayInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<PayOutput> execute() async {
    executions.add(input.note);
    return PayOutput();
  }
}

/// The pattern the issue reproduces: protect one path by comparing it exactly.
Middleware requireToken() => (inner) => (request) {
      seen.add(resolvedRoute(request));
      if (request.requestedUri.path == canonical &&
          request.headers['x-token'] != 'secret') {
        return Response(401, body: jsonEncode({'error': 'Unauthorized'}));
      }
      return inner(request);
    };

void main() {
  late HttpServer server;
  late HttpClient client;

  setUp(() async {
    executions.clear();
    seen.clear();
    final api = ModularApi(basePath: '/api/v1', logLevel: LogLevel.emergency);
    api.use(requireToken());
    api.module('payments', (m) {
      m.usecase('execute', ExecutePayment.fromJson,
          inputExample: PayInput(), outputExample: PayOutput());
      m.usecase('list', ExecutePayment.fromJson,
          method: 'GET', inputExample: PayInput(), outputExample: PayOutput());
    });
    server = await api.serve(port: 0);
    client = HttpClient();
  });

  tearDown(() async {
    client.close(force: true);
    await server.close(force: true);
  });

  /// Sends [rawPath] as written: dart:io does not normalize the request target.
  Future<int> send(String method, String rawPath, {String? token}) async {
    final req = await client.open(method, 'localhost', server.port, rawPath);
    req.followRedirects = false;
    if (token != null) req.headers.set('x-token', token);
    if (method == 'POST') {
      req.headers.contentType = ContentType.json;
      req.write('{}');
    }
    final res = await req.close();
    await res.drain<void>();
    return res.statusCode;
  }

  test('the canonical path runs behind the middleware', () async {
    expect(await send('POST', canonical), 401);
    expect(executions, isEmpty);

    expect(await send('POST', canonical, token: 'secret'), 200);
    expect(executions, ['']);
  });

  for (final path in [
    '$canonical/',
    '/API/v1/Payments/Execute',
    '/api/v1/payments/Execute',
    '/api/v1/payments//execute',
    '/api/v1//payments/execute',
    '$canonical//',
    '/api/v1/payments/%65xecute',
    '/api/v1/payments%2Fexecute',
    '$canonical;x',
    '/api/v1/payments/./execute',
  ]) {
    test('$path does not reach the use case without the token', () async {
      expect(await send('POST', path), anyOf(401, 404));
      expect(executions, isEmpty);
    });
  }

  test('a middleware reads the resolved use case', () async {
    await send('POST', canonical, token: 'secret');

    expect(seen, [
      const ResolvedRoute(
          module: 'payments',
          useCase: 'execute',
          method: 'POST',
          path: canonical),
    ]);
  });

  test('the resolved route is absent on a 404', () async {
    expect(await send('POST', '/api/v1/payments/missing', token: 'secret'),
        404);
    expect(seen, [null]);
  });

  test('the resolved route is absent on a wrong method', () async {
    await send('GET', canonical, token: 'secret');
    expect(seen, [null]);
  });

  test('the resolved route is absent for operational endpoints', () async {
    expect(await send('GET', '/api/v1/health'), 200);
    expect(seen, [null]);
  });

  test('HEAD resolves to the GET use case', () async {
    await send('HEAD', '/api/v1/payments/list');

    expect(seen, [
      const ResolvedRoute(
          module: 'payments',
          useCase: 'list',
          method: 'GET',
          path: '/api/v1/payments/list'),
    ]);
  });
}
