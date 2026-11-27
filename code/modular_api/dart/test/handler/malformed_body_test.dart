// A body that cannot become the use case input is a client error: 400, not 500 (#44).

import 'dart:convert';

import 'package:modular_api/src/core/logger/logging_middleware.dart';
import 'package:modular_api/src/core/logger/modular_logger.dart';
import 'package:modular_api/src/core/schema/field.dart';
import 'package:modular_api/src/core/usecase/use_case_exception.dart';
import 'package:modular_api/src/core/usecase/usecase.dart';
import 'package:modular_api/src/core/usecase/usecase_http_handler.dart';
import 'package:shelf/shelf.dart';
import 'package:test/test.dart';

class CountInput extends Input {
  final int count;
  CountInput(this.count);

  /// A hand-written fromJson that trusts the shape of the body, as fromJson code often does.
  factory CountInput.fromJson(Map<String, dynamic> json) {
    final raw =
        json['count'] as String; // TypeError when missing or not a String
    if (raw == 'boom') {
      throw UseCaseException(
          statusCode: 422, message: 'No boom', errorCode: 'BOOM');
    }
    if (raw.isEmpty) throw ArgumentError.value(raw, 'count', 'empty');
    return CountInput(int.parse(raw)); // FormatException when not an integer
  }

  @override
  Map<String, dynamic> toJson() => {'count': count};

  @override
  List<SchemaField>? get schemaFields => null;
}

class CountOutput extends Output {
  final int count;
  CountOutput(this.count);

  @override
  int get statusCode => 200;

  @override
  Map<String, dynamic> toJson() => {'count': count};

  @override
  List<SchemaField>? get schemaFields => null;
}

class CountUseCase implements UseCase<CountInput, CountOutput> {
  @override
  final CountInput input;

  @override
  ModularLogger? logger;

  CountUseCase(this.input);

  factory CountUseCase.fromJson(Map<String, dynamic> json) =>
      CountUseCase(CountInput.fromJson(json));

  @override
  String? validate() => null;

  @override
  Future<CountOutput> execute() async => CountOutput(input.count);
}

class _SpyLogger implements ModularLogger {
  final levels = <String>[];

  void _log(String level) => levels.add(level);

  @override
  void emergency(String msg, {Map<String, dynamic>? fields}) =>
      _log('emergency');
  @override
  void alert(String msg, {Map<String, dynamic>? fields}) => _log('alert');
  @override
  void critical(String msg, {Map<String, dynamic>? fields}) => _log('critical');
  @override
  void error(String msg, {Map<String, dynamic>? fields}) => _log('error');
  @override
  void warning(String msg, {Map<String, dynamic>? fields}) => _log('warning');
  @override
  void notice(String msg, {Map<String, dynamic>? fields}) => _log('notice');
  @override
  void info(String msg, {Map<String, dynamic>? fields}) => _log('info');
  @override
  void debug(String msg, {Map<String, dynamic>? fields}) => _log('debug');
}

Request _post(String body, [ModularLogger? logger]) => Request(
      'POST',
      Uri.parse('http://localhost/count'),
      body: body,
      headers: {'content-type': 'application/json'},
      context: {if (logger != null) loggerContextKey: logger},
    );

Future<(int, Object?)> _send(String body, [ModularLogger? logger]) async {
  final handler = useCaseHttpHandler(CountUseCase.fromJson);
  final res = await handler(_post(body, logger));
  return (res.statusCode, jsonDecode(await res.readAsString()));
}

void main() {
  for (final body in ['{not json', '', '{', 'nul']) {
    test('unparseable body ${jsonEncode(body)} returns 400', () async {
      final (status, json) = await _send(body);
      expect(status, 400);
      expect(json, {'error': 'Invalid JSON in request body'});
    });
  }

  for (final body in ['[1, 2]', '"text"', '42', 'null', 'true']) {
    test('JSON that is not an object ($body) returns 400', () async {
      final (status, json) = await _send(body);
      expect(status, 400);
      expect(json, {'error': 'Request body must be a JSON object'});
    });
  }

  final shapes = {
    'missing field (TypeError)': <String, dynamic>{},
    'wrong type (TypeError)': {'count': 5},
    'unparseable value (FormatException)': {'count': 'abc'},
    'rejected value (ArgumentError)': {'count': ''},
  };
  shapes.forEach((name, payload) {
    test('an error inside fromJson, $name, returns 400 without details',
        () async {
      final logger = _SpyLogger();
      final (status, json) = await _send(jsonEncode(payload), logger);

      expect(status, 400);
      expect(json, {'error': 'Invalid request body'});
      expect(logger.levels, contains('warning'));
      expect(logger.levels, isNot(contains('error')));
    });
  });

  test('a UseCaseException inside fromJson keeps its status', () async {
    final (status, json) = await _send(jsonEncode({'count': 'boom'}));
    expect(status, 422);
    expect((json as Map)['error'], 'BOOM');
  });

  test('a well-formed body still succeeds', () async {
    final (status, json) = await _send(jsonEncode({'count': '7'}));
    expect(status, 200);
    expect(json, {'count': 7});
  });
}
