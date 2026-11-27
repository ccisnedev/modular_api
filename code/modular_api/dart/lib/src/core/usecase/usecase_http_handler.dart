import 'dart:convert';
import 'dart:typed_data';
import 'package:shelf/shelf.dart';
import 'package:shelf_router/shelf_router.dart';

import '../logger/logger.dart';
import '../logger/logging_middleware.dart';
import '../schema/field.dart';
import 'usecase.dart';
import 'use_case_exception.dart';

/// Generic handler for any UseCase
Handler useCaseHttpHandler(
  UseCase Function(Map<String, dynamic>) fromJson, {
  Input? inputExample,
  int? jsonBodyLimit,
}) {
  const jsonHeaders = {'content-type': 'application/json; charset=utf-8'};

  // Capture schema at creation time — enables pre-validation
  // before fromJson, so strict factories never crash.
  final preValidationFields = inputExample?.schemaFields;

  return (Request req) async {
    try {
      // 1. Extract JSON (either from body or params)
      final data = req.method.toUpperCase() == 'GET'
          ? await _jsonFromUrl(req)
          : await _jsonFromBody(req, jsonBodyLimit);

      // 2. Pre-validate BEFORE fromJson (when example provides schema)
      if (preValidationFields != null) {
        validateJsonFields(data, preValidationFields);
      }

      // 3. Build and validate the UseCase. fromJson only maps untrusted input into the
      //    use case input, so a TypeError, FormatException or ArgumentError thrown there
      //    means the body has the wrong shape: a client error.
      final UseCase useCase;
      try {
        useCase = fromJson(data);
      } on UseCaseException {
        rethrow;
      } on InputValidationException {
        rethrow;
      } on TypeError catch (e) {
        throw _BadRequest('Invalid request body', e);
      } on FormatException catch (e) {
        throw _BadRequest('Invalid request body', e);
      } on ArgumentError catch (e) {
        throw _BadRequest('Invalid request body', e);
      }

      // 3a. Post-validate for legacy path (no inputExample)
      if (preValidationFields == null) {
        final inputFields = useCase.input.schemaFields;
        if (inputFields != null) {
          validateJsonFields(data, inputFields);
        }
      }

      final validationError = useCase.validate();
      if (validationError != null) {
        return Response(
          400,
          headers: jsonHeaders,
          body: jsonEncode({'error': validationError}),
        );
      }

      // 3. Inject logger from middleware context
      useCase.logger = req.context[loggerContextKey] as ModularLogger?;

      // 4. Execute the use case
      final output = await useCase.execute();

      // 5. Serialize the response and return with the appropriate status code
      return Response(
        output.statusCode,
        headers: jsonHeaders,
        body: jsonEncode(output.toJson()),
      );
    } on UseCaseException catch (e) {
      final logger = req.context[loggerContextKey] as ModularLogger?;
      logger?.error('UseCaseException',
          fields: {'error': e.toString(), 'status': e.statusCode});
      return Response(
        e.statusCode,
        headers: jsonHeaders,
        body: jsonEncode(e.toJson()),
      );
    } on InputValidationException catch (e) {
      return Response(
        400,
        headers: jsonHeaders,
        body: jsonEncode({'error': e.message}),
      );
    } on _BodyTooLarge catch (e) {
      final logger = req.context[loggerContextKey] as ModularLogger?;
      logger?.warning('Request body too large', fields: {
        'status': 413,
        'limit': e.limit,
        if (e.length != null) 'length': e.length,
      });
      return Response(
        413,
        headers: jsonHeaders,
        body: jsonEncode({'error': 'Request body too large'}),
      );
    } on _BadRequest catch (e) {
      // A client error: the cause goes to the log at warning level, never into the response.
      final logger = req.context[loggerContextKey] as ModularLogger?;
      logger?.warning(e.message, fields: {
        'status': 400,
        if (e.cause != null) 'error': '${e.cause.runtimeType}: ${e.cause}',
      });
      return Response(
        400,
        headers: jsonHeaders,
        body: jsonEncode({'error': e.message}),
      );
    } catch (e) {
      final logger = req.context[loggerContextKey] as ModularLogger?;
      logger?.error('Unexpected error in use case handler',
          fields: {'error': e.toString()});
      return Response(
        500,
        headers: jsonHeaders,
        body: jsonEncode({'error': 'Internal server error'}),
      );
    }
  };
}

/// Extracts JSON directly from the body (POST/PATCH)
///
/// With a [limit] (bytes), a declared Content-Length over it is refused unread, and the
/// byte stream is counted so a chunked or understated body stops at limit + 1 bytes.
Future<Map<String, dynamic>> _jsonFromBody(Request req, int? limit) async {
  final String payload;
  if (limit == null) {
    payload = await req.readAsString();
  } else {
    final declared = req.contentLength;
    if (declared != null && declared > limit) {
      throw _BodyTooLarge(limit, declared);
    }
    final bytes = BytesBuilder(copy: false);
    var count = 0;
    await for (final chunk in req.read()) {
      count += chunk.length;
      if (count > limit) throw _BodyTooLarge(limit, declared);
      bytes.add(chunk);
    }
    payload = (req.encoding ?? utf8).decode(bytes.takeBytes());
  }
  final Object? decoded;
  try {
    decoded = jsonDecode(payload); // an empty body is a FormatException too
  } on FormatException catch (e) {
    throw _BadRequest('Invalid JSON in request body', e);
  }
  if (decoded is! Map<String, dynamic>) {
    throw const _BadRequest('Request body must be a JSON object');
  }
  return decoded;
}

/// A body over the configured limit; answered with 413.
class _BodyTooLarge implements Exception {
  final int limit;
  final int? length;
  const _BodyTooLarge(this.limit, this.length);
}

/// A body that cannot become the use case input; answered with 400.
class _BadRequest implements Exception {
  final String message;
  final Object? cause;
  const _BadRequest(this.message, [this.cause]);
}

/// Extracts JSON from path-params and query-params (GET)
Future<Map<String, dynamic>> _jsonFromUrl(Request req) async {
  final qp = req.url.queryParameters;
  final pp = req.params;
  return {...qp, ...pp};
}
