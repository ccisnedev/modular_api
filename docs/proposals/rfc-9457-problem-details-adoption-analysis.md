# Ecosystem-wide adoption of Problem Details in modular_api

Review date: September 13, 2026. Analysis and design document; it implements no changes.

## 1. Assessment and scope

**Recommendation: a complete, coordinated breaking migration of TypeScript, Dart, and Python, with RFC 9457 as the normative reference and an RFC 7807-compatible object.** The inventory contains **40 families of failures/response paths**, broken down by SDK. These are not 40 HTTP codes or 120 guaranteed failures: there are shared triggers, application-dependent conditions, and mechanisms that exist in only one implementation.

The “EVERY error” requirement covers REST, body-reading errors, validation, domain errors, routing, plugins, middleware, GraphQL, health, and errors when serving operational endpoints. It includes error responses constructed directly, without throwing exceptions. The release must not leave any SDK or producer on the previous contract.

There are two conflicts the team must explicitly resolve before implementation: **GraphQL uses errors within HTTP 200 results**; **health uses 503 with application/health+json**. This design includes them in the strict migration. Keeping those outputs intact would be an exception to the stated requirement and is not presented here as full adoption. Evidence: code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:349, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:392, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138; code/ts/modular_api/src/core/health/health_service.ts:33 and docs/architecture.md:529.

The requirement describes errors that can be communicated over HTTP. It cannot turn a disconnection, a TLS error, a process that did not start, or a response whose bytes have already been sent into a JSON body. Nor does it automatically turn local results from REST/GraphQL clients or database contracts into HTTP. Their limits and impact are detailed in §4 and §8.

### Method and level of certainty

- Source code, configuration, ADRs, architecture, roadmap, relevant tests, and dependencies already present were read. No tests, builds, installations, git commands, or servers were run.
- Python is in code/py, not code/python. All three roots contain core, rest_client, graphql_client, sqlserver, and postgres. docs-ui was also reviewed: it is a documentation consumer, not a fourth API server. The set of fifteen packages is listed in docs/adr/0002-synchronized-versioning-across-sdks.md:41; docs-ui is listed separately on line 49.
- “Today” means behavior inferred from the inspected local code. Dependency branches are identified as such; there is no claim that every request was reproduced over the network. The three core manifests declare 0.7.0: code/ts/modular_api/package.json:3, code/dart/modular_api/pubspec.yaml:3, code/py/modular_api/pyproject.toml:7. The deployed or published version was not checked.
- The file:line references were verified in this review. References to installed dependencies are not treated as canonical specifications: they explain delegated responses.
- The table is exhaustive by **producer family and response path**, not by every possible exception text or arbitrary plugin. Extensions allow infinitely many messages and statuses; listing them as a closed set would fabricate data.

## 2. What the canonical documentation already establishes and what is proposed

| Topic | Verified current canonical specification | Recommendation from this analysis |
| --- | --- | --- |
| Architecture scope | Applies to all implementations; same external behavior and error structure: docs/architecture.md:5, docs/architecture.md:795, docs/architecture.md:804. | One error specification and shared fixtures for all three SDKs. |
| Planned adoption | A future direction, not an implemented contract: docs/architecture.md:189 and docs/architecture.md:729. Includes all errors in docs/architecture.md:733. | Make it a verifiable requirement for the next breaking release. |
| Five existing steps | Add type/title to UseCaseException; validation-error; internal-error; problem+json media type; map error/message and errorCode: docs/architecture.md:748, docs/architecture.md:749, docs/architecture.md:750, docs/architecture.md:751, docs/architecture.md:752. | Preserve the intent and complete the parser, routers, plugins, GraphQL, health, serialization, clients, OpenAPI, and release work. The steps do not authorize partial releases. |
| Status and security | UseCaseException preserves its status; validate() validation is 400; an unhandled exception is a generic 500 without a stack trace: docs/architecture.md:210. | Preserve those rules, correcting accidental parser classifications and documenting the additional GraphQL changes. |
| Output | Must declare statusCode: docs/architecture.md:140; the handler transmits it: code/ts/modular_api/src/core/usecase_handler.ts:89, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:61, code/py/modular_api/src/modular_api/core/usecase_handler.py:113. | An Output with 4xx/5xx must go through the problem contract; it cannot be an alternative error path. |
| Plugins | Official and third-party plugins use the same contract: docs/architecture.md:298. Documentable plugin routes: docs/adr/0003-plugin-routes-first-class-in-openapi-and-metrics.md:39. | An error response writer and host conformance checks for plugins as well. |
| Health | 503 for fail and application/health+json: docs/architecture.md:525. | Preserve status 503; change the fail representation to Problem Details with a health extension. Requires amending §8 of the canonical documentation. |
| Version parity | ADR-0002 Accepted, fifteen packages; ADR-0006 still Proposed: docs/adr/0002-synchronized-versioning-across-sdks.md:7, docs/adr/0006-per-project-versioning-across-the-three-sdks.md:7. | Apply the current policy; do not assume the proposal has been accepted. |
| Major | A breaking change to the core or plugin contract requires a major release: docs/roadmap.md:11. | A coordinated major release; do not call it a patch or hide it as a 413 fix. |

Documentation issues to correct during future implementation: docs/architecture.md:205 has an unrelated metrics line embedded in the RFC paragraph; the example uses validation-failed on line 738 and the plan uses validation-error on line 749. The roadmap says Current State 0.6.0 in docs/roadmap.md:29, and the architecture matrix still shows 0.4.5 in docs/architecture.md:786. Corrections are proposed, without modifying them in this task. There is no Problem Details-specific ADR among the six existing ADRs.

## 3. Current inventory and individual old → new mapping

### Legend for bodies, media types, and tests

Each SDK cell shows **status / media type / body**:

- **J** = application/json; TS/Dart/Python REST handlers add charset=utf-8. Python's outer 500 uses JSONResponse without that parameter. References: code/ts/modular_api/src/core/usecase_handler.ts:15, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:16, code/py/modular_api/src/modular_api/core/usecase_handler.py:23, code/py/modular_api/src/modular_api/core/error_response_middleware.py:30.
- **G** = application/json; TS and Python set charset=utf-8 (code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:99, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:85); Dart uses application/json in the examined paths. It is not application/problem+json: code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1206, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:409, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138.
- **H** = application/health+json, possibly with charset=utf-8 in the official plugin: code/ts/modular_api/src/core/official_plugins.ts:124, code/dart/modular_api/lib/src/core/official_plugins.dart:159, code/py/modular_api/src/modular_api/core/official_plugins.py:140.
- **I** = {"error":"Internal server error"}.
- **V(m)** = {"error":m}.
- **U(c,m,d)** = {"error":c,"message":m,"details":d}; details is omitted if absent; c defaults to "error". Python also uses the default for an empty string; TS/Dart only for absence/null: code/ts/modular_api/src/core/use_case_exception.ts:49, code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40, code/py/modular_api/src/modular_api/core/use_case_exception.py:39.
- **GErr** = {"errors":[{"message":m,"locations":...,"path":...,"extensions":...}], "data":...}; optional members depend on the phase/engine. Python omits data when it is None; TS may emit data:null. code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1225, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138.
- **HF** = {"status":"fail","version":...,"releaseId":...,"checks":{nombre:{"status":...,"responseTime":...,"output":...}}}. Individual check fields may be omitted. code/ts/modular_api/src/core/health/health_service.ts:37, code/dart/modular_api/lib/src/core/health/health_service.dart:27, code/py/modular_api/src/modular_api/core/health/health_service.py:37.
- **N/E** = the SDK does not have that specific rejection in the reviewed path; this does not mean every request is accepted.
- **C** = test checks the old body/field; **S** = status/route only; **U** = data/exception unit test, not HTTP; **—** = no specific test found. “C” demonstrates a contract fixed by tests; it does not demonstrate actual consumption by external clients.
- Codes Q1…Q15 refer to the catalog in §5. All targets where a response can be written add status, instance, and trace_id, and the target Content-Type is application/problem+json. It is not inherited from the successful endpoint.

### 3.1 Request reading, DTOs, and use cases

| ID and trigger | TypeScript today | Dart today | Python today | Existing tests / contract | Target and mapping |
| --- | --- | --- | --- | --- | --- |
| E01. Malformed JSON at a REST endpoint | 400/J/V("Invalid JSON in request body"), code/ts/modular_api/src/core/body_parser_error_handler.ts:31. | 500/J/I from jsonDecode, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | 500/J/I from request.json(), code/py/modular_api/src/modular_api/core/usecase_handler.py:81, code/py/modular_api/src/modular_api/core/usecase_handler.py:138. | C TS: code/ts/modular_api/test/handler/body_parser_error.test.ts:50; — specific D/P test. | Q1, 400 in all three; error → detail. Do not expose native parser text. |
| E02. Truly empty body, zero bytes | express.json() produces {} or the handler uses {}; may end in validation 400 or success depending on the DTO: code/ts/modular_api/src/core/usecase_handler.ts:54. | 500/J/I when decoding "", code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | 500/J/I when decoding an empty body, code/py/modular_api/src/modular_api/core/usecase_handler.py:81. | Tests named empty body send {}; they do not establish zero-byte behavior: code/dart/modular_api/test/handler/handler_pre_validation_test.dart:254, code/ts/modular_api/test/handler/handler_pre_validation.test.ts:151. | Proposed policy: normalize empty input to {} when the endpoint accepts empty input; if fields are missing, Q3/400. If the endpoint requires a document, Q1/400. Specify per operation, identically across all three SDKs. |
| E03. Valid JSON whose top level is not an object | Primitive/null rejected as E01 by the parser's strict setting; an array passes and may yield E10 or acceptance: code/ts/modular_api/src/core/usecase_handler.ts:54; code/ts/modular_api/node_modules/body-parser/lib/types/json.js:81. | 500/J/I from a cast to Map, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:97. | 400/J/V("Request body must be a JSON object"), code/py/modular_api/src/modular_api/core/usecase_handler.py:83. | C P: code/py/modular_api/tests/test_usecase_handler.py:160; — uniform T/D rejection. | Q2/400; public text → detail; errors with pointer "" if included. Reject arrays in TS REST as well. |
| E04. JSON body larger than the limit | Dependency generates entity.too.large/413; TB forwards it and TX converts it into **500/J/I**. code/ts/modular_api/src/core/modular_api.ts:361, code/ts/modular_api/src/core/body_parser_error_handler.ts:41, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18; code/ts/modular_api/node_modules/raw-body/index.js:162. | N/E: reading without an explicit limit in code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:96 and code/dart/modular_api/lib/src/core/plugin.dart:591. | N/E: request.json() without a core limit in code/py/modular_api/src/modular_api/core/usecase_handler.py:81 and code/py/modular_api/src/modular_api/core/plugin.py:484. | — No dedicated 413/limit test found. | Uniform Q4/**413** wherever the limit applies. I provides no useful detail; emit a safe custom message and optional limit_bytes. Separate from the configuration option (§9). |
| E05. Charset unsupported by the JSON parser | Dependency 415 charset.unsupported → 500/J/I: code/ts/modular_api/node_modules/body-parser/lib/types/json.js:128; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No equivalent classifier; REST read/decode failure → 500/J/I: code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:96, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81. | No equivalent classifier; no explicit validation of the header charset in code/py/modular_api/src/modular_api/core/usecase_handler.py:81; decode failure → 500/J/I. | — | Q5/415 for an unsupported charset; validate a shared policy before parsing. Fixed message; do not copy bytes. |
| E06. Unsupported Content-Encoding | Dependency 415 encoding.unsupported → 500/J/I: code/ts/modular_api/node_modules/body-parser/lib/read.js:181; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No equivalent rejection adapter in code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | No equivalent rejection adapter in code/py/modular_api/src/modular_api/core/usecase_handler.py:81. | — | Q5/415; choose the same supported encodings in all three SDKs. Do not claim uniform current support. |
| E07. Corrupt compressed body/decompression error | Forwarded read error → 500/J/I; code/ts/modular_api/node_modules/body-parser/lib/read.js:75 and code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No equivalent core decompressor in code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95; parsing failure falls under E01. | No equivalent core decompressor in code/py/modular_api/src/modular_api/core/usecase_handler.py:81; parsing failure falls under E01. | — | Q1/400 if a supported encoding fails; Q5/415 if unsupported. Never indiscriminately convert every read error into 413. |
| E08. Aborted read or inconsistent declared length | Dependency 400 request.aborted/request.size.invalid → attempted 500/J/I if a response is still possible: code/ts/modular_api/node_modules/raw-body/index.js:245, :277; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | REST stream failure → attempted 500/J/I, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81; in a plugin → code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | REST failure → attempted 500/J/I, code/py/modular_api/src/modular_api/core/usecase_handler.py:138; code/py/modular_api/src/modular_api/core/plugin.py:485 may swallow it and leave body=None. | — | Q1/400 when a response is possible; log a disconnection without a response, without fabricating delivery of Problem Details. |
| E09. Unreadable stream or encoding changed by code | Dependency 500 stream.not.readable/stream.encoding.set → 500/J/I: code/ts/modular_api/node_modules/raw-body/index.js:177; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Internal read errors reach code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81 or code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | Internal errors reach code/py/modular_api/src/modular_api/core/usecase_handler.py:138 or code/py/modular_api/src/modular_api/core/error_response_middleware.py:30; the plugin reader may also swallow them, code/py/modular_api/src/modular_api/core/plugin.py:485. | — | Q6/500, generic detail; distinguish from an error attributable to the request. |
| E10. Required field missing or null | 400/J/V("Missing required field: n"), before or after the factory: code/ts/modular_api/src/core/usecase.ts:153; code/ts/modular_api/src/core/usecase_handler.ts:93. | Same 400/J/V, pre/post: code/dart/modular_api/lib/src/core/schema/field.dart:203; code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:75. | 400/J/V; missing uses that phrase, but Pydantic may classify null as an invalid type: code/py/modular_api/src/modular_api/core/usecase_handler.py:49, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. | C: T pre_validation:88; D pre_validation:129; P fromjson:96, full paths in §10. Additional fromjson U tests in T/D. | Q3/400; message → detail; structured issue {code:"required",pointer:"/n",location:"body",detail:...}. Decide and fix identical null behavior. |
| E11. Incorrect field type | 400/J/V("Field 'n' must be of type t"), code/ts/modular_api/src/core/usecase.ts:157; code/ts/modular_api/src/core/usecase_handler.ts:93. Only required fields are checked. | 400/J/V with the same pattern: code/dart/modular_api/lib/src/core/schema/field.dart:203; code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:75. Only required fields. | 400/J/V built from the first ValidationError: code/py/modular_api/src/modular_api/core/usecase_handler.py:30, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. Pydantic may coerce more values. | C T/D pre_validation for string/integer/number/boolean/array; C P fromjson:103, :110. U object tests in fromjson for all three. | Q3/400; errors[*] with code:"type", expected, and pointer; summary detail. Do not parse the message to reconstruct the field. |
| E12. Other DTO constraints, nested structures, and Pydantic validators | No equivalent general engine; a custom DTO may throw E16 or E14/E15. code/ts/modular_api/src/core/usecase_handler.ts:90. | Same; factory casts without prevalidation may become 500, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81. | Catches any ValidationError from the entire try block, reduces it to the first loc and a generic message if the type is not in the map: code/py/modular_api/src/modular_api/core/usecase_handler.py:51, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. | — HTTP tests for the complete constraint catalog; DTO U tests do not equal HTTP conformance. | Q3/400 for typed **input** validation; output validation or internal execution errors Q6/500. Classify by phase, not just exception class. |
| E13. validate() returns business-rule text | 400/J/V(m), code/ts/modular_api/src/core/usecase_handler.ts:79. | 400/J/V(m), code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:45. | 400/J/V(m), code/py/modular_api/src/modular_api/core/usecase_handler.py:101. | C P handler:127; C parity: code/tests/integration_test/parity_test.ps1:406 and :546. | Q3/400; m → detail. If there is only a string, do not invent a field: optional errors or an object-level issue. |
| E14. UseCaseException without errorCode | Exception status/J/U("error",m,d), code/ts/modular_api/src/core/usecase_handler.ts:97, code/ts/modular_api/src/core/use_case_exception.ts:49. | status/J/U, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:66, code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40. | status/J/U, code/py/modular_api/src/modular_api/core/usecase_handler.py:119, code/py/modular_api/src/modular_api/core/use_case_exception.py:39. | Serialization U tests C D: code/dart/modular_api/test/use_case_exception_test.dart:49; P: code/py/modular_api/tests/test_use_case_exception.py:46. | Q15 about:blank by default with the status title; message → detail; details → filtered details extension. Use an explicitly registered type if present. Validate status 400–599. |
| E15. UseCaseException with a code and/or details | status/J/U(c,m,d), code/ts/modular_api/src/core/use_case_exception.ts:49, code/ts/modular_api/src/core/usecase_handler.ts:99. | status/J/U(c,m,d), code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:73. | status/J/U(c,m,d), code/py/modular_api/src/modular_api/core/use_case_exception.py:39, code/py/modular_api/src/modular_api/core/usecase_handler.py:124. | C P handler:135; C serialization D:20, :34 and P:23, :34 in use_case_exception tests. T handler_logger:96 establishes status/log behavior, not the body. | Registered domain type Q14; code → code and URI through the registry; message → detail; stable title; details does not replace detail. |
| E16. Unexpected exception in factory, validate, execute, output/status, or serialization | 500/J/I, code/ts/modular_api/src/core/usecase_handler.ts:90; a failure to serialize U inside catch may escape the async handler. | 500/J/I, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81; an exception thrown inside catch escapes to the wrapper. | 500/J/I, code/py/modular_api/src/modular_api/core/usecase_handler.py:138; failure to construct the response in except escapes to the wrapper. | C P handler:144; S T/D handler_logger and D pre_validation:271. | Q6/500 and a nonrecursive emergency serializer; never error.toString/stack/SQL in detail. |
| E17. Output declares 4xx/5xx with its own body | status/J/output.toJson(), code/ts/modular_api/src/core/usecase_handler.ts:89. | status/J/output.toJson(), code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:61. | status/J/output.to_json(), code/py/modular_api/src/modular_api/core/usecase_handler.py:113. | — specific negative HTTP contract found; explicit public capability in code/ts/modular_api/src/core/usecase.ts:211. | Typed ProblemOutput/UseCaseException recommended. Untyped error Output → Q15 with status and generic detail; preserve data only through an explicit safe adapter. Do not automatically interpret message/success from an arbitrary object. |

### 3.2 Routing, plugins, and outer safeguards

| ID and trigger | TypeScript today | Dart today | Python today | Existing tests / contract | Target and mapping |
| --- | --- | --- | --- | --- | --- |
| E18. Nonexistent route, including a disabled plugin route or one outside basePath | 404/text/html/HTML "Cannot METHOD path", finalhandler due to the absence of a fallback: code/ts/modular_api/src/core/modular_api.ts:377; code/ts/modular_api/node_modules/finalhandler/index.js:114, :299. | 404/no explicit Content-Type in Response/"Route not found": code/dart/modular_api/lib/src/core/modular_api.dart:21; dependency shelf_router-1.1.4/lib/src/router.dart:286. | 404/text/plain; charset=utf-8/"Not Found": code/py/modular_api/src/modular_api/core/modular_api.py:251; code/py/modular_api/.venv/Lib/site-packages/starlette/routing.py:616. | S official_plugins_basepath and graphql_runtime_integration in all three SDKs. | Q7/404; replace text/HTML with fixed detail; do not copy the HTML page into the problem. Includes paths outside basePath if the request reached the host. |
| E19. Unregistered method on an existing route | Generally 404 HTML as in E18; Express does not create 405 here. code/ts/modular_api/src/core/modular_api.ts:377. | 404 as in E18 due to verb comparison; shelf_router-1.1.4/lib/src/router.dart:179. | 405/text/plain/"Method Not Allowed", Allow from the router: code/py/modular_api/.venv/Lib/site-packages/starlette/routing.py:267. | — dedicated 405 parity test. | Q8/405 if the path exists but the method does not; preserve Allow. 404 if the path does not exist. OPTIONS/CORS and HEAD require their own HTTP handling. |
| E20. Route parameter with invalid URI escaping | Express generates URIError with status 400; TX flattens it to 500/J/I: code/ts/modular_api/node_modules/express/lib/router/layer.js:166; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No equivalent custom classifier; depends on the parser/Router. code/dart/modular_api/lib/src/core/modular_api.dart:21. | No equivalent custom classifier; depends on the ASGI server and router. code/py/modular_api/src/modular_api/core/modular_api.py:251. | — | Q1/400 for an invalid URI identified in a request admitted by the host. Do not attribute a native status to D/P unless established by tests. |
| E21. Native HTTP exception thrown inside a plugin route | No recognized native HTTP exception; an error with status ends up as 500/J/I, code/ts/modular_api/src/core/plugin.ts:512, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Exception ends up as 500/J/I, code/dart/modular_api/lib/src/core/plugin.dart:530, code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | A route HTTPException is handled by Starlette: specified status/text/plain/detail; if it occurs in user middleware, PX catches it as 500/J/I. code/py/modular_api/src/modular_api/core/plugin.py:489; dependency starlette/middleware/exceptions.py:65. | — specific test; the scope difference is demonstrated by the mounting in code/py/modular_api/src/modular_api/core/modular_api.py:251, code/py/modular_api/src/modular_api/core/modular_api.py:271. | Explicit adapter for known HTTP exceptions → Q15 or a specific type, valid 4xx/5xx status, and allowed headers; do not trust any object with a status property. |
| E22. Plugin/middleware throws an unhandled exception before headers are sent | Plugin route and middleware error, including a rejected promise, → 500/J/I: code/ts/modular_api/src/core/plugin.ts:512, code/ts/modular_api/src/core/plugin.ts:572, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. Custom middleware mounted through api.use does not receive that wrapper (code/ts/modular_api/src/core/modular_api.ts:367); handling an async rejection without next is not guaranteed there. | 500/J/I: code/dart/modular_api/lib/src/core/error_response_middleware.dart:13. | 500/J/I: code/py/modular_api/src/modular_api/core/error_response_middleware.py:20. | C guardrails throw in all three: T:52, D:63, P:70; §10 gives full paths. | Q6/500. Wrap registered async callbacks; include preRouting, preHandler, postHandler, and api.use. A UseCaseException thrown outside the handler today does not automatically preserve its status either. |
| E23. Middleware short-circuits the request by returning a direct error (auth, authorization, rate limit, etc.) | Arbitrary status/body and media type; C for 401/J/V("blocked by plugin"): code/ts/modular_api/test/plugin_host/plugin_host.guardrails.test.ts:26. | Arbitrary Shelf response passes through code/dart/modular_api/lib/src/core/error_response_middleware.dart:14. | Arbitrary ASGI messages pass through code/py/modular_api/src/modular_api/core/error_response_middleware.py:21. | C in all three guardrails short-circuit tests: T:14, D:13, P:29. Does not demonstrate official auth. | Q15 or catalog Q7–Q9 according to declared semantics. 401/403/429 preserve status; preserve WWW-Authenticate/Retry-After when applicable. A known legacy object can be adapted; opaque → generic detail. |
| E24. Plugin route returns an error envelope/Response, empty body, text, or binary | status; undefined → sendStatus and text/plain; string → text/html by default, Buffer → application/octet-stream; object → J; contentType/headers may override it. code/ts/modular_api/src/core/plugin.ts:489, code/ts/modular_api/src/core/plugin.ts:499. | Arbitrary Response, without transformation, code/dart/modular_api/lib/src/core/plugin.dart:530. | Native Response unchanged; dict without body → empty, str/bytes → text/plain, other → J; headers may override it. code/py/modular_api/src/modular_api/core/plugin.py:505. | — dedicated negative test per variant; successful plugin routes do have tests. | Q15 with error status; a typed Response uses its problem; known legacy maps fields, arbitrary empty/text/binary bodies use generic detail. Intercept before sending, not afterward. |
| E25. Outer logging/tracing layer fails, or the error handler itself fails again | A synchronous throw before sending may reach TX; if TX/logger itself fails, finalhandler 500 HTML remains; a late async callback may produce no response. code/ts/modular_api/src/core/modular_api.ts:340, code/ts/modular_api/src/core/modular_api.ts:349, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:13. | Logging/tracing are outside DX: code/dart/modular_api/lib/src/core/modular_api.dart:273, code/dart/modular_api/lib/src/core/modular_api.dart:289; Shelf may generate 500/text/plain/"Internal Server Error". shelf-1.4.2/lib/shelf_io.dart:129. | Logging/tracing outside PX, code/py/modular_api/src/modular_api/core/modular_api.py:271, code/py/modular_api/src/modular_api/core/modular_api.py:282, code/py/modular_api/src/modular_api/core/modular_api.py:319; native ServerErrorMiddleware may generate 500/text/plain/"Internal Server Error". starlette/middleware/errors.py:258. | — specific format test with logger/serializer failure. | Q6/500 through a final barrier without a logger/telemetry dependency. If the response has already started, apply the physical limit in §4; do not write a second body. |


### 3.3 GraphQL and operational endpoints

In Dart, the runtime uses graphQLHttp from leto_shelf without a custom onError (code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:201). The installed dependency **leto_shelf-0.0.1-dev.2/lib/src/graphql_http.dart** was inspected; this table references it as **LHTTP:n**. The version is pinned in code/dart/modular_api/pubspec.yaml:24. This is dependency evidence, not project-owned code or a new SDK. The batch case is a current transport divergence, not promised uniform support.

| ID and trigger | TypeScript today | Dart today | Python today | Existing tests / contract | Target and mapping |
| --- | --- | --- | --- | --- | --- |
| E26. GraphQL runtime not initialized | 503/G/{errors:[{message:"GraphQL runtime is not initialized."}]}, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:270. | Throws StateError; DX produces 500/J/I, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:240. | 503/G/same envelope as TS, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:257. | — HTTP; startup tests exist and normally prevent reaching this state. | Q10/503 if an endpoint exists but is not ready. message → detail; do not publish capability details. |
| E27. Missing query, invalid envelope/query type, or malformed JSON for GraphQL | Missing or empty query → 400/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:336; malformed JSON intercepted globally by E01 before the plugin. | LHTTP:59, :69 → 400 without explicit media type/empty body; LHTTP:74 → 400 without explicit media type/exception text when reading the envelope. The host passes invalid JSON as a string, code/dart/modular_api/lib/src/core/plugin.dart:596. | Missing query → 400/G/GErr; plugin parser swallows invalid JSON and passes None: code/py/modular_api/src/modular_api/core/plugin.py:483, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:331. An empty query string reaches parse and E29. | — specific case; successful states are covered. | Q11/400. Unify envelope, empty query, and read error behavior. message or safe text → detail; typed errors → errors. |
| E28. Unsupported GraphQL media type; invalid multipart; batch with an invalid entry | No general typed admission policy: express.json may skip parsing; missing query → E27. Batch array without URL query → E27. code/ts/modular_api/src/core/modular_api.ts:361, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1080. | LHTTP:38 accepts application/graphql; :41 multipart may yield 400/text; :51 JSON/graphql+json; other → empty 400. :93 batch returns a 200/G array of results and may include errors. _readBody reconstructs the body, code/dart/modular_api/lib/src/core/plugin.dart:585 and code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:473: do not assume interoperable uploads. | Reader attempts JSON without a uniform policy; batch array without URL query → E27, code/py/modular_api/src/modular_api/core/plugin.py:482, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1016. | — specific cross-SDK test. | Q5/415 for unsupported media/encoding; Q11/400 for rejected envelope/multipart/batch. Initial recommendation: a shared single-request JSON GraphQL contract; decide on removing Dart batch/raw/multipart in the same major release. If batch is retained, a single Problem response with indexed issues when any entry fails. |
| E29. Invalid GraphQL document syntax | 200/G/GErr with message and location, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:345. | 200/G/engine result, LHTTP:79, :104; do not confuse with invalid JSON E27. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:339. | — specific negative test found. | Q11/400; errors with location:"graphql", code:"syntax", safe detail, and locations. Do not return an error under 200 in the strict profile. |
| E30. Schema validation: unknown field/argument, disabled introspection | 200/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:364. | 200/G/GErr from validate/introspect in code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:201 and LHTTP:79. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:355. | — specific test for each rule; limit tests do not equal testing disabled introspection. | Q11/400 with issues code:"schema"/"introspection_disabled"; safe message → issue detail. |
| E31. Depth exceeds maxDepth | 200/G/{errors:[{message,extensions:{validationError:{code:"queryDepthComplexity"}}}]}, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:352. | 200/G with the same pattern and additional extensions.validationError.spec, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:386. | 200/G with the same TS pattern, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:344. | C in all three runtime_execution suites: T:217 and :257; D:257 and :307; P:222 and :260. | Q12/400; canonical code "depth_limit"; preserve the limit in a typed extension; discard Leto's implementation URL. |
| E32. Complexity exceeds maxComplexity | 200/G/validationError.code:"queryComplexity", code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:373. | 200/G/error from Leto's rule builder, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:206 and LHTTP:104. | 200/G/same code, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:365. | C in all three runtime_execution suites: T:237; D:283; P:241. | Q12/400; issue code:"complexity_limit". Text → detail; measured values only if they represent the same metric in all three SDKs. |
| E33. Non-coercible variables, ambiguous/unselectable operation, invalid operation type | execute returns errors → 200/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:385. readVariables/readOperationName discard unexpected types, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1088. | Engine errors 200/G; InvalidOperationType may produce 405 without explicit media type/text, LHTTP:113. | execute → 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:376; readers discard unexpected types, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1024. | — specific matrix found. | Q11/400 for invalid input; Q8/405 for an operation incompatible with the method. Strict-profile policy, not reproduction of each engine's defaults. |
| E34. Validation in key/filter/orderBy/page resolvers, including limits and operators | GraphQLError with extensions.code; 200/G/GErr, possibly partial/null data, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:590, :828, :928, :964, :1239. | Equivalent Leto GraphQLError; 200/G result; code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:638, :889, :1014, :1075. | Equivalent GraphQLError and 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:591, :803, :886, :921. | C page max/negative values: T:127, :147; D:144, :168; P:133, :152 in runtime_execution. Compiler U tests are not HTTP tests. | Q11/400; canonical code per key/filter/order/page; safe message → issue.detail, GraphQL path → path, without inventing a JSON Pointer into the query text. |
| E35. Exception in executor/resolver, catalog access, read compilation, or field serialization; partial data may exist | 200/G/GErr with error.message and engine metadata, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1225; errors outside the captured execution go through E22. | 200/G/engine errors, LHTTP:79; output not captured by the engine goes through E36/E22. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:389, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1158; outside the engine E22. | — specific HTTP case for an internal exception and partial result found. Clients do establish consumption of errors (§8). | Q13/500 for an unhandled error. Redact internal messages; the graphql extension may preserve safe partial data and paths. If all errors are typed client errors, Q11/400; if any is internal, 500 takes precedence. |
| E36. Leto returns its own error response / override / failure outside the GraphQL result | N/E for Leto; an unhandled project-owned equivalent → E22. | LHTTP:99 and :111 may return a native Response; :117 returns 500/text/plain/"Internal Server Error" by default, without passing through DX because it does not throw. | N/E for Leto; an unhandled project-owned failure → E22. | — | The GraphQL boundary must normalize responses as well as exceptions; 500 → Q6, known HTTP response → Q15/Q8/Q11. onError is not enough. |
| E37. HealthCheck returns fail (includes an unhealthy GraphQL runtime) | 503/H/HF, code/ts/modular_api/src/core/official_plugins.ts:120, code/ts/modular_api/src/core/health/health_service.ts:33. | 503/H/HF, code/dart/modular_api/lib/src/core/official_plugins.dart:159, code/dart/modular_api/lib/src/core/health/health_service.dart:24. | 503/H/HF, code/py/modular_api/src/modular_api/core/official_plugins.py:140, code/py/modular_api/src/modular_api/core/health/health_service.py:33. | C T health_handler:64 and D:68; S P health_handler:52. U health_service in all three. | Q10/503; textual status moves to health.status, checks/version/releaseId to health; top-level status is numeric 503. |
| E38. HealthCheck timeout | 503/H/HF with output including name and milliseconds, code/ts/modular_api/src/core/health/health_service.ts:141. | 503/H/HF, code/dart/modular_api/lib/src/core/health/health_service.dart:117. | 503/H/HF with timeout in seconds, code/py/modular_api/src/modular_api/core/health/health_service.py:100. | U health_service; no dedicated HTTP test for all those bodies. | Q10/503; health.checks with code:"timeout" and uniform duration_ms if exposed; generic public message. |
| E39. HealthCheck throws an exception | 503/H/HF with output:String(err), code/ts/modular_api/src/core/health/health_service.ts:129. | 503/H/HF with output:e.toString(), code/dart/modular_api/lib/src/core/health/health_service.dart:130. | 503/H/HF with output:str(exc), code/py/modular_api/src/modular_api/core/health/health_service.py:107. | U health_service; — explicit HTTP sanitization. | Q10/503; remove the raw exception from public output, preserve safe check information in health. Log the internal cause. |
| E40. Failure when serving OpenAPI/docs/metrics or serializing their response | Official plugins pass through code/ts/modular_api/src/core/plugin.ts:512 → 500/J/I; the spec is an object and is serialized when responding: code/ts/modular_api/src/core/official_plugins.ts:233. | Throwing operational handler → code/dart/modular_api/lib/src/core/error_response_middleware.dart:21; code/dart/modular_api/lib/src/core/official_plugins.dart:290 and code/dart/modular_api/lib/src/core/official_plugins.dart:302. | Throwing handler → code/py/modular_api/src/modular_api/core/error_response_middleware.py:30, code/py/modular_api/src/modular_api/core/official_plugins.py:264. | — dedicated operational HTTP failure test. Existing tests mostly verify success and the spec. | Q6/500 with the same writer, even when success is HTML/YAML/Prometheus. Distinguish failure **when generating the spec during startup**, which is not an HTTP response (§4). |

Abbreviated test references in this section resolve to the files listed in §10. The ":n" suffixes immediately following a path or alias are additional lines in the same file.

Inventory clarifications:

1. **413 is not a currently guaranteed response produced by the TS core itself.** It is the status generated by raw-body and lost while passing through the fallback. The evidence from code/ts/modular_api/src/core/modular_api.ts:361 → code/ts/modular_api/src/core/body_parser_error_handler.ts:41 → code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18 matters more than the body_parser_error_handler comment.
2. The body-parser entity.verify.failed/403 errors and urlencoded parameter limiting are not enabled by express.json() without options; they are not fabricated as active producers. verify is disabled by default in code/ts/modular_api/node_modules/body-parser/lib/types/json.js:63. If an extension enables them, it is covered by E21–E24 and the future parser matrix.
3. No current official API key/OAuth/bearer middleware was found in the core middleware directories; they contain CORS, which responds 204 to preflight: code/ts/modular_api/src/middlewares/cors.ts:46, code/dart/modular_api/lib/src/middlewares/cors.dart:56, code/py/modular_api/src/modular_api/middlewares/cors.py:58. OAuth is future work in docs/architecture.md:773. The Dart guide code/dart/modular_api/AGENTS.md:323 describes OAuth; that outdated guide is not used to claim the producer exists today. 401/403/429 are covered as domain/plugin errors, not as implemented official auth.
4. OpenAPI generators **document** errors; they do not themselves produce a 400/500 response to the client. The operational route's HTTP error is E40; the initial generation error is local. The current documented contract is analyzed in §7.

## 4. Guarantee boundary: other ecosystem errors

### Errors without an HTTP response

| Current producer | Current form and evidence | Proposed treatment |
| --- | --- | --- |
| Plugin host during registration/startup: duplicates, dependencies/cycles, slots, routes/capabilities, validation, and frozen registry | PluginHostError/PluginValidationResult, without status or media type. code/ts/modular_api/src/core/plugin.ts:254, code/ts/modular_api/src/core/plugin.ts:405, code/ts/modular_api/src/core/plugin.ts:428, code/ts/modular_api/src/core/plugin.ts:444; code/dart/modular_api/lib/src/core/plugin.dart:361, code/dart/modular_api/lib/src/core/plugin.dart:550, code/dart/modular_api/lib/src/core/plugin.dart:632; code/py/modular_api/src/modular_api/core/plugin.py:341, code/py/modular_api/src/modular_api/core/plugin.py:473, code/py/modular_api/src/modular_api/core/plugin.py:245. lifecycle and middleware_slots tests establish exceptions/aborts. | Preserve typed local errors; do not invent HTTP 500 or a response type URI. If this occurs while handling a request, E22/E21 transforms it. |
| GraphQL catalog/metadata/SDL/artifacts/compiler and invalid configuration | Diagnostics, GraphqlArtifactCompileError/LoadError, PluginValidationResult, or PluginHostError. code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:199, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:206; code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:1191; code/ts/modular_api/src/graphql/runtime/graphql_artifacts.ts:101 and :176. | Development diagnostics remain local; startup must fail before listening. Only an existing HTTP execution falls under E34/E35. |
| OpenAPI construction or YAML serialization during setup | buildOpenApiSpec and jsonToYaml are called during startup preparation, code/ts/modular_api/src/core/official_plugins.ts:211; build_openapi_spec in code/py/modular_api/src/modular_api/core/official_plugins.py:114; there is no request to answer. | Local error with context, blocks readiness/startup; do not pretend there is a 500 endpoint response. Error documentation and generation must use the same catalog. |
| REST/GraphQL clients: non-2xx HTTP, timeout, transport, decoding, unsupported operation | Local ServiceResult.failure/ServiceFailure; they do not emit an HTTP response to the caller. code/ts/modular_api_rest_client/src/restClient.ts:359; code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:352; code/py/modular_api_rest_client/src/modular_api_rest_client/client.py:263; code/ts/modular_api_graphql_client/src/graphqlClient.ts:112. | Consume and expose typed Problem Details when received; do not invent server status/instance for a local timeout. If the app propagates that failure to its API, it must use domain errors or the shared fallback. |
| SQL Server/Postgres: DbResult.failure, invalid result access, requireValue/adapter failure | No media type or HTTP status. code/ts/modular_api_postgres/src/dbClient.ts:205 and :259; code/ts/modular_api_sqlserver/src/dbClient.ts:205; code/dart/modular_api_postgres/lib/src/modular_api_postgres.dart:162 and :205; code/dart/modular_api_sqlserver/lib/src/modular_api_sqlserver.dart:164; equivalent Python contracts in code/py/modular_api_postgres/src/modular_api_postgres/db_client.py:163 and code/py/modular_api_sqlserver/src/modular_api_sqlserver/db_client.py:166. | Do not turn DB contracts into HTTP. An explicit adapter may translate conflicts/unavailable dependencies; without translation, E16/E35 is 500. Do not expose SQL messages. |
| docs-ui resource-loading failure or browser error | Promises rejected by link.onerror/script.onerror; code/docs-ui/src/docs-ui.js:64 and :80. | Not a server-side emitter; check error presentation in Swagger UI and Problem Details examples. docs-ui retains independent versioning. |

**Physical limit:** after headers/bytes are sent, a partial success cannot be atomically replaced with another document. TS already checks headersSent in code/ts/modular_api/src/core/unhandled_request_error_handler.ts:7; Python code/py/modular_api/src/modular_api/core/error_response_middleware.py:20 does not yet track http.response.start. Design commitment tracking in all adapters: before commitment, Problem Details; afterward, end/abort according to the transport and log correlation, without a second status or JSON appended to the stream. HEAD preserves status/headers and has no body. Disconnections and errors before entering the host have no framework response to normalize.

The native HTTP transport may reject a request before creating Request (request line, headers, socket). A configurable server boundary is needed wherever the library allows a response; when there is no writable context, the guarantee ends there. These cases do not justify excluding ordinary router, plugin, or health errors.

**Arbitrary extensions:** middleware that writes "success:false" with 200 or sends directly through a socket prevents any reliable inference of semantics. The new API must require typed error signaling, control registered HTTP sending, and prohibit contract bypasses in conforming plugins. Searching for the word error in any successful JSON is not a solution: it may be legitimate data.

## 5. Target contract and catalog

### Normative reference

The recommendation is to cite **RFC 9457**, published in July 2023, which explicitly obsoletes RFC 7807. Retain “RFC 7807 adoption” as a historical reference to the plan. Both share type/title/status/detail/instance and application/problem+json; the proposed extensions do not prevent compatibility with 7807 readers. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), [RFC 7807, §3](https://www.rfc-editor.org/rfc/rfc7807.html#section-3).

The standard distinguishes the type identifier, the title summary, and the detail explanation of the occurrence; it requires the declared status to match HTTP and allows unknown extensions that the client ignores. It does not make all those members mandatory. It is not a tool for exposing internal debugging information. [RFC 9457, §3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), [RFC 9457, §5](https://www.rfc-editor.org/rfc/rfc9457.html#section-5).

**The following profile is modular_api's own recommendation**, stricter than the RFC minimum; its specific decisions are not attributed to the IETF.

### Proposed profile

| Member | modular_api profile rule |
| --- | --- |
| type | Required; stable absolute URI from the catalog or about:blank. Do not construct it from the request host/header. |
| title | Required; stable summary of the type. Canonical English initially for parity. Never a message with variable identifiers. |
| status | Required; integer 400–599, identical to the effective HTTP status at emission time. |
| detail | Required by the profile; useful public text. For unexpected errors: “An unexpected error occurred.” |
| instance | Required; opaque occurrence URI, for example urn:uuid:<UUID-v4>. Does not require a public lookup endpoint. The proposal improves on the canonical example that uses only the path (docs/architecture.md:200). |
| trace_id | Required in host responses; the same effective identifier as X-Request-ID/logs. With a valid span, that span's trace ID; without a span, existing request correlation. Do not enforce a UUID regex because the current code accepts W3C and request IDs: code/ts/modular_api/src/core/logger/logging_middleware.ts:69, code/dart/modular_api/lib/src/core/logger/logging_middleware.dart:59, code/py/modular_api/src/modular_api/core/logger/logging_middleware.py:87. |
| code | Optional; stable domain or subtype code, never essential for interpreting status. Do not retain an ambiguous error that is sometimes a code and sometimes text. |
| errors | Optional list of typed validation issues. Each issue: code, detail, and location; pointer as a JSON Pointer when there is a structured location; GraphQL may use path/locations. Shared deterministic ordering. |
| details | Optional public domain context with a registered schema. Keep it nested; do not merge arbitrary maps with reserved members. |
| health | Only Q10 for checks; includes safe textual status/checks/version/releaseId. Prevents health.status from colliding with the top-level HTTP status. |
| graphql | Only GraphQL errors that need to preserve a partial result; may include safe data. Errors use the shared issue format; a second incompatible error envelope is not embedded. |

Generic example:

~~~json
{
  "type": "https://api.example.com/problems/validation-error",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more input fields are invalid.",
  "instance": "urn:uuid:34106750-4ce3-4ef7-8555-4519fefb2a29",
  "trace_id": "73364cb4-06e0-4912-a87f-53264f24d59d",
  "errors": [
    {
      "code": "required",
      "detail": "Field 'name' is required.",
      "location": "body",
      "pointer": "/name"
    }
  ]
}
~~~

The example.com domain is illustrative only. **Do not publish those URIs as the package's real identity.** Choose and document a public namespace controlled by the project before freezing fixtures. The generic request path could be /api/example, but it is not used as a unique occurrence identifier.

Proposed security and consistency rules:

- Create problem context before the parser and preserve it even on routes excluded from access logging, without requiring an exporter or logger. Take available tracing IDs after tracing initialization; generate one if missing. Validate the length/characters of incoming correlation before reflecting headers.
- Do not include query strings, request bodies, credentials, stack traces, system paths, or DB diagnostics in instance/detail. Native GraphQL and health details need additional filtering compared with current behavior (E35/E39).
- A serializer that does not throw for already validated values; prohibit cycles/non-JSON values in extensions; minimal Q6 fallback if an invalid construction escapes. Avoid recording that fallback through the logger that just failed.
- Do not change the format by endpoint or Accept. Proposal: all errors in the major release use the problem+json media type, including for clients sending Accept: application/json. Document the policy; do not return legacy through negotiation.
- Preserve safe semantic headers (Allow, WWW-Authenticate, Retry-After, CORS, and correlation) and recalculate Content-Length; do not carry over Content-Type, encoding, or ETag from the previous body.
- Do not detect validation by parsing phrases. TS/Dart need structured issues in their exceptions, and Python needs a bounded Pydantic translation, without input/ctx that reveal private values.
- Initial proposal: aggregate structural input errors and order them by location/pointer/code; validate() continues to accept a string to avoid inventing fields. Define null, optional fields, arrays, nested structures, and coercion uniformly. This extends the current first-failure model; it must be recorded as a major-release decision.

### Proposed type URI catalog

**P** is defined as the approved stable public namespace, ending in /problems/. In examples, P = https://api.example.com/problems/. The following P+suffix expressions specify construction; they are not literal values to send.

| Key | type and title | Status | Families |
| --- | --- | --- | --- |
| Q1 | P+invalid-request — Invalid request | 400 | E01/E02 document required/E07/E08/E20 |
| Q2 | P+invalid-json-object — JSON object required | 400 | E03 |
| Q3 | P+validation-error — Validation failed | 400 | E02 fields/E10/E11/E12 input/E13 |
| Q4 | P+payload-too-large — Content Too Large | 413 | E04 |
| Q5 | P+unsupported-media-type — Unsupported Media Type | 415 | E05/E06/E07 encoding/E28 |
| Q6 | P+internal-error — Internal Server Error | 500 | E09/E12 internal/E16/E22/E25/E36 internal/E40 |
| Q7 | about:blank — Not Found | 404 | E18; generic domain 404 |
| Q8 | about:blank — Method Not Allowed | 405 | E19/E33 method |
| Q9 | about:blank — Unauthorized / Forbidden / Too Many Requests | 401/403/429 respectively | E23/E24 when only HTTP semantics apply |
| Q10 | P+service-unavailable — Service unavailable | 503 | E26/E37/E38/E39 |
| Q11 | P+graphql-request-error — Invalid GraphQL request | 400 | E27/E28 envelope/E29/E30/E33 input/E34 |
| Q12 | P+graphql-query-limit — GraphQL query limit exceeded | 400 | E31/E32 |
| Q13 | P+graphql-execution-error — GraphQL execution failed | 500 | E35 unhandled |
| Q14 | Absolute URI registered by the domain, title/status declared in the registry | 4xx/5xx defined by type | E15; typed application failures |
| Q15 | about:blank — HTTP phrase for the status | Effective 4xx/5xx | Known E14/E17/E21/E23/E24/E36 without a specific type |

The about:blank variants are not independent new types. They use the HTTP code's semantics and corresponding title. [RFC 9457, §4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2.1).

**Explicit difference from the old plan:** docs/architecture.md:752 proposes error → title and errorCode → suffix. Today error contains both variable phrases (V) and codes (U); copying it literally would produce unstable or poorly readable titles. Recommendation: V.error → detail; U.message → detail; U.error → code; type/title through the registry. The registry may implement the planned suffix for known codes, with documented escaping/collisions; do not generate new URIs from arbitrary strings. For an unregistered code, about:blank + code until the application declares type/title. Approve this clarification of the canonical specification before coding.

### Mapping compatibility matrix

- A legacy error/message envelope is not retained alongside the problem as an alternative mode. The code/details extensions preserve useful domain information, but the contract remains breaking.
- Clients must make decisions based on type/code/status; detail text may improve without being reinterpreted as protocol.
- UseCaseException adds type/title according to the plan. Its domain representation does not need a request to exist; the **HTTP writer** adds instance/trace_id. Explicitly review the toJson/to_json contract: returning the problem fragment without context is reasonable; serialization tests must distinguish it from a complete HTTP response.
- Validate exception status: today there is no uniform guard preventing 2xx/3xx as a supposed error. Proposal: reject invalid configuration and emit Q6 if discovered during a request. Legitimate successful responses continue to use Output.


## 6. Shared boundary design and protocol incompatibilities

### Proposed architecture

One semantic problem model, one catalog, and three transport adapters. The implementation may be idiomatic; the observable result must match (docs/architecture.md:806).

Proposed flow:

~~~text
Request admitted by the host
  → minimal correlation context + final safeguard
  → tracing / logging
  → input reading + protocol error classification
  → registered middleware / routing / plugin / use case
  → typed result (success or problem)
  → response validation + shared writer
  → a single status, headers, and body
~~~

The final safeguard does not require reordering the use-case lifecycle. It coexists with tracing outside logging, as currently mounted (code/ts/modular_api/src/core/modular_api.ts:340, code/ts/modular_api/src/core/modular_api.ts:349; code/dart/modular_api/lib/src/core/modular_api.dart:228; code/py/modular_api/src/modular_api/core/modular_api.py:293). It must catch failures in those layers and prevent the logger from recursively causing the fallback to fail. Ordinary normalization happens within observability so that metrics and logs see the final status. If observability itself fails, delivering a problem takes priority; do not promise a successful span/log for an exporter that failed.

**A catch(Exception) middleware is not enough.** E17/E23/E24/E36/E37 do not throw. Typed writers and an output guard before committing headers are needed.

- **TS/Express:** centralize useCaseHandler, bodyParserErrorHandler, unhandledRequestErrorHandler, and buildPluginRouteHandler; normal 404 fallback and 405 resolver before the final boundary; allowlist classifier for body-parser/router errors. Plugin-registered middleware already catches promises in code/ts/modular_api/src/core/plugin.ts:572; api.use mounts custom middleware directly in code/ts/modular_api/src/core/modular_api.ts:367. Guarantee adaptation of that latter path and rejections originating inside the handler's catch. A wrapper around res.json alone would leave res.send/res.end/writeHead/flushHeaders outside; the boundary must cover all permitted paths or restrict the extension contract.
- **Dart/Shelf:** handlers return Response, allowing a decision before the network adapter. Normalize error Responses, including those returned by Leto; preserve successful streaming. Do not arbitrarily consume streams just to guess whether they are errors; if status is already 4xx/5xx and there is no typed problem, use a public fallback, cancelling the previous body in a controlled manner.
- **Python/ASGI:** configure handlers for HTTPException and server errors in addition to the normalization layer; observe http.response.start, defer commitment of error responses when necessary, and do not send two starts. ExceptionMiddleware handles 404/405 inside Starlette, and those errors do not reach the current catch: code/py/modular_api/src/modular_api/core/modular_api.py:251 and dependency starlette/applications.py:69. Native Response and plugin dict outputs require the same policy.
- **Plugin host:** expose a public capability for constructing problems and adapters for known errors; contracts for status/error versus success; OpenAPI validation at registration; mandatory conformance suites. An arbitrary plugin without a contract cannot guarantee “all” through conventions alone.
- **Serialization and domains:** keep internal contexts separate from public fields. Do not classify every ValidationError encountered during output/execute as a client error; classify the phase. Deliberately public domain exceptions preserve their semantics.

Proposed output guard: valid typed problem → serialize; legacy error response recognized by a declared adapter → translate; arbitrary error response → generic problem for the status; invalid problem or inconsistent status → Q6/500. This prevents an unmigrated plugin from reintroducing a second representation. The option to abort startup due to an incompatible plugin API reinforces, but does not replace, the runtime guard.

### GraphQL: a necessary product decision, not a serialization detail

The GraphQL model allows results with errors and partial data; its result format is not the Problem Details object. The consulted GraphQL over HTTP draft requires GraphQL results to be represented according to that model and explicitly addresses partial results. Changing every errors[] into a Problem Details response constitutes a **custom HTTP profile**, incompatible with consumers expecting a conventional GraphQL result. [GraphQL over HTTP, §6.1](https://http-spec.graphql.org/draft/#sec-Body), [partial results](https://http-spec.graphql.org/draft/#sec-Partial-success).

The strict profile is designed to satisfy this task's mandate:

1. If there are no errors, preserve the successful GraphQL result.
2. If there are errors, convert all of them to Problem Details issues: request/validation/limits → 400; method not allowed → 405; not ready → 503; unexpected internal execution → 500. Domain types require registered translation. Priority for a mixed set must be deterministic.
3. Partial data, if the team decides to preserve it, is exposed within graphql.data and marked as partial by the type. The client application must not treat it as complete success or automatically retry operations with possible side effects. Strict alternative: discard it. Both break the contract and require a decision.
4. Do not claim standard GraphQL error compatibility after that change. Migrate all three runtimes and all three GraphQL clients simultaneously.
5. If the team requires fully preserving the traditional GraphQL protocol while also requiring “EVERY error as top-level Problem Details,” **there is no solution that satisfies both requirements**. In accordance with the “across the board or not at all” decision, defer full adoption. Using extensions.problem while preserving the GraphQL envelope might be interoperable, but does not satisfy the literal mandate and is not counted as a complete implementation.

Adopting an exotic partial-success status as a shortcut is not recommended: it does not turn the body into the requested error contract either. The web draft is mutable; pin its revision if the team adopts it as an additional reference. This document's strict profile is a product decision, not an RFC 9457 requirement.

### Health and operational endpoints

Strict proposal: health pass/warn remains 200/H; fail becomes 503/Problem with health.status="fail". This breaks monitors that read textual status at the root or validate H on failures, although probes that only check HTTP status retain their behavior. Requires modifying docs/architecture.md:529 and docs/architecture.md:530 and communicating the new location of checks. There is no hidden exception for /health.

Failure/timeout output messages are sanitized as in E38/E39; do not confuse a failed check (503/Q10) with an exception in the handler/serializer itself (500/Q6). The existing requirement to expose the exception message in output (docs/architecture.md:527) must be clarified alongside the new public policy.

## 7. OpenAPI and consumable documentation

Verified state:

- TS buildOpenApiSpec documents 400/application/json/{error:string}; 500 has only description: code/ts/modular_api/src/openapi/openapi.ts:84, code/ts/modular_api/src/openapi/openapi.ts:95.
- Dart documents 400/500 with descriptions but no body: code/dart/modular_api/lib/src/openapi/openapi.dart:212.
- Python does the same: code/py/modular_api/src/modular_api/openapi/openapi.py:115.
- The specification requires at least success/400/500 per operation: docs/architecture.md:653.
- Plugin routes contribute a standard operation, and the merge documents custom/transport with metadata, not operational by default: docs/adr/0003-plugin-routes-first-class-in-openapi-and-metrics.md:39 and :48. That optional metadata does not yet enforce error conformance.

Proposed design:

1. components.schemas.ProblemDetails, ValidationIssue, and domain/GraphQL/health extensions; reusable responses components. Required status as integer 400–599; type/instance as URI; additionalProperties allows extensions controlled by type. Define using valid JSON Schema for the current **OpenAPI 3.0**, without requiring migration to 3.1 in this change: code/ts/modular_api/src/openapi/openapi.ts:103 and docs/roadmap.md:97.
2. 400/500 must include application/problem+json and examples. Add 413/415 to operations that read a body and declared domain responses, 401/403/429 where applicable. Use default ProblemDetails for other errors, preserving every existing successful response. Do not use default as a substitute for canonical minimums.
3. Global 404, 405/Allow, and failures before routing must be documented as host policy; a nonexistent route cannot be listed as an OpenAPI operation. Known operations may declare those responses in addition to the policy.
4. Register domain types/statuses explicitly, avoiding the assumption that the generator can inspect every throw in execute(). The same declaration feeds documentation and normalization.
5. Validate or complete error responses contributed by plugins. An operation declaring 4xx with image/*, text/html, or legacy JSON is incompatible with the new contract and must be rejected or transformed through a declared mapping before freeze. Successful binary responses remain supported.
6. Document GraphQL and health according to the agreed profile in the transport/operational contract and, when included in OpenAPI, with the same schema. Missing metadata in a public plugin must produce a conformance validation error or require a documented declaration; not a silent omission of its contract.
7. Preserve successful /openapi.json as application/json, YAML as application/x-yaml, /docs HTML, and /metrics Prometheus. **Only their failures** use Problem Details. Do not change the OpenAPI document's media type because it contains error schemas.
8. Swagger/docs-ui QA: they display type/detail/trace_id, examples, and new headers; check that the UI does not depend on response.error. Its inspected code loads Swagger UI (code/docs-ui/src/docs-ui.js:64 and :80), so there is no evidence that it requires its own breaking change; validate this with tests. There is an explicit legacy example to update: code/docs-ui/public/sample-spec.json:43 and :49 document 400 with error:string and application/json.

## 8. Clients, versioning, and transition

### Ecosystem consumers

All three REST clients convert a non-2xx response into ServiceFailure using status and the **full text** in message/details, before success decoding. Changing the server does not make them automatically expose a typed problem: code/ts/modular_api_rest_client/src/restClient.ts:359, code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:352, code/py/modular_api_rest_client/src/modular_api_rest_client/client.py:263.

Recommendation: add a ProblemDetails consumption model and an optional problem property to ServiceFailure; parse media types with parameters; use transport status for classification, retain discrepancies for diagnostics, and expose trace_id/instance. For external servers or old versions, retain tolerant reception of legacy text/JSON. **Read compatibility does not equal mixed framework output.** This can be prepared before the major release as an additive API if existing message/details do not change; changes to those fields must be communicated.

The TS/Dart GraphQL clients delegate to the REST client, while Python implements its own transport: code/ts/modular_api_graphql_client/src/graphqlClient.ts:124, code/dart/modular_api_graphql_client/lib/src/modular_api_graphql_client.dart:123, code/py/modular_api_graphql_client/src/modular_api_graphql_client/client.py:245. Today they preserve errors[] in a successful result, tested in code/ts/modular_api_graphql_client/test/graphqlClient.test.ts:78, code/dart/modular_api_graphql_client/test/graphql_client_test.dart:70, code/py/modular_api_graphql_client/tests/test_graphql_client.py:87.

The strict profile requires distinguishing an HTTP failure with a problem from GraphQL success, preserving issues/partial data if agreed, and not automatically applying retryable=true to every Q13/500. Current clients mark 429 and 5xx as retryable, for example code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:490; the application must account for idempotency. An evolved client may continue reading conventional third-party GraphQL; those interoperability tests do not need to be removed, but variants for the new server must be added.

DB/SQL do not need to change their local errors for this HTTP contract. Their constraints, examples, adapters, and integration tests do need to verify compatibility with the new core. If a package changes its own APIs, its impact is explicitly versioned.

### ADR-0002 versus ADR-0006

**Current policy:** ADR-0002 Accepted covers fifteen packages and coordinated releases; ADR-0006 remains Proposed and conditions its effect on acceptance and workflows. It must not be interpreted as current policy simply because it is newer. docs/adr/0002-synchronized-versioning-across-sdks.md:9, :27, :41; docs/adr/0006-per-project-versioning-across-the-three-sdks.md:7 and :9. The file .github/workflows/release.yml:3 still describes publishing fifteen packages and its version guard on line 45.

Consequence for this migration:

- **Under current policy:** a common major version in all fifteen manifests, with actual changes to all three cores and coordinated client work; satellite packages without functional changes receive a parity bump. All three core SDKs must have the same version and format. A bump without implementation in D/P is insufficient.
- **If ADR-0006 is accepted and implemented first:** core TS/Dart/Python publishes a shared major version; REST client and GraphQL client have their respective common versions per project and ship within a coordinated compatibility window. They do not all need the same number as the core. SQLServer/Postgres change only when constraints or APIs require it, with each project aligned across three languages. docs/adr/0006-per-project-versioning-across-the-three-sdks.md:54 and :81.
- Changing the release policy is not a technical prerequisite for Problem Details: it can be done correctly under ADR-0002. Do not combine both projects for convenience.
- The next value is undecided. From 0.7.0, a numerical major version would be 1.0.0; the roadmap also associates 1.0.0 with stability/LTS (docs/roadmap.md:15). Resolve whether those criteria are met or whether the pre-1.0 policy is explicitly amended. Do not call a client-breaking contract a “non-breaking minor” or invent an already approved version.

### Recommended strategy: clean major release

**Recommendation: a clean major release, without a per-endpoint legacy output flag.** A feature flag applied only to the parser or UseCaseException directly violates the requirement. A global flag, applied to all families in all three SDKs, could serve testing/preview; it is not the final architecture and temporarily doubles the test matrix.

If the team needs that preview, the flag must be global and immutable at startup, with the same default and removal date in all three SDKs. Do not mix formats by Accept, error type, plugin, or language. Do not declare adoption complete until legacy mode is removed from the new release line. The client's tolerant reader may remain for external services.

Proposed operational coordination (design only, not executed):

1. One error ADR, shared schema/fixtures, and a server/client/SDK compatibility matrix.
2. Clients capable of reading problems and preliminary documentation before servers emit the new format.
3. A single release candidate with **all producers in all three runtimes** conforming; gates include clients and affected packages.
4. Publication within a single window. npm/pub.dev/PyPI do not form an atomic transaction: prepare all three, run the coordinated idempotent process, verify availability of all packages, and only then announce general compatibility. On partial failure, do not recommend a unilateral upgrade; complete the set or withdraw the candidate recommendation.
5. Consumer applications may upgrade gradually with compatible clients; do not confuse this with allowing two formats within the same new server. An application rollback must return to a complete previous version, not activate an isolated size-error patch.
6. Validate cross-package constraints; matching version fields does not prevent incompatible dependencies. That defect is described in docs/adr/0006-per-project-versioning-across-the-three-sdks.md:39.

Changelog/communication: mark BREAKING in all three cores and every client whose result/API changes. Include V/U/GErr/HF → Problem tables, new statuses for invalid JSON and size, 404/405, GraphQL and partial-data policy, nested health.status, media type, type/trace IDs, plugin APIs, URI catalog, generic examples, and a guide for consumers using response.error or response.message. Explain status adjustments, message changes, and the new format separately; do not attribute them all to the RFC.

## 9. Body limit and 413 as a case of the general contract

The current TS chain is express.json() without options (code/ts/modular_api/src/core/modular_api.ts:361), the dependency's 100kb default (code/ts/modular_api/node_modules/body-parser/lib/types/json.js:56), entity.too.large/413 from raw-body (code/ts/modular_api/node_modules/raw-body/index.js:162), and fallback 500 (code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18). Inventory entry E04 records the resulting behavior, not just the dependency's status.

In full adoption, entity.too.large must become Q4/413 with exactly the same writer/media type/correlation as E01, E13, E15, and the rest. Measure and document whether the limit applies to received or decompressed bytes; in current TS, the reader uses a decompression stream before applying reading/limit (code/ts/modular_api/node_modules/body-parser/lib/read.js:54 and :165). Define the same semantics when implementing this in Dart/Python.

**Separate change:** adding optional jsonBodyLimit in TS, with the existing default and pass-through to express.json({limit:...}), may be released earlier as an additive non-breaking capability. It does not require changing error bodies and does not constitute partial RFC adoption. Under ADR-0002, that release still follows versioning discipline. If a new default limit is also introduced in D/P or the existing one is reduced, previously accepted requests are now restricted: evaluate that separately; compatibility of an additive TS option does not prove that imposing a limit on the entire ecosystem is non-breaking.

Design cases for 413: exact limit and +1 byte; known Content-Length and chunked; multibyte text; compressed body; requests without a length header; parser bypass by media type; parser applied before route matching in TS. Determine precedence: 413/415 before 404 if an invalid body reaches a nonexistent route? Recommendation: transport validation before routing when the host processes that body, with the same policy in all three. Do not limit only DTO handlers while leaving GraphQL or plugins outside; binary transports may declare their own admission policy and share the same rejection representation.


## 10. Test scope and TDD strategy

### Reproducible static count of affected contracts

**Identified working baseline: 52 existing test cases in 15 files** (TS 16, Dart 19, Python 17), plus **4 parity scenarios** in a shared script. Of the 52, 51 have positive assertions on the body/field/status that the profile changes; the remaining one is a negative Dart assertion on error that should be replaced because it could keep passing even after the field disappears. This is an adaptation inventory based on inspection, **not an execution result or a closed total of all future tests**.

Each it/test/def test declaration is counted once, not each expect/assert or each request within the same test. The four parity scenarios run for three SDKs (12 scenario-language executions in total) and have additional cross-comparisons. Driver, startup, log, or successful serialization tests are not added merely because they contain the word error.

| SDK / file | Selected cases, by declaration line | Count | What changes |
| --- | --- | --- | --- |
| code/ts/modular_api/test/handler/body_parser_error.test.ts | 50 | 1 | Malformed JSON body equality. |
| code/ts/modular_api/test/handler/handler_pre_validation.test.ts | 88, 97, 106, 115, 124, 133, 151 | 7 | Access to res.body.error and validation details. |
| code/ts/modular_api/test/plugin_host/plugin_host.guardrails.test.ts | 14, 52 | 2 | Envelope equality for short-circuit and outer exception. |
| code/ts/modular_api/test/graphql/graphql_runtime_execution.test.ts | 127, 147, 217, 237, 257 | 5 | Status 200 with errors and current extensions. |
| code/ts/modular_api/test/health/health_handler.test.ts | 64 | 1 | Textual fail status at the root. |
| code/dart/modular_api/test/use_case_exception_test.dart | 20, 34, 49 | 3 | error/message/details/default serialization. |
| code/dart/modular_api/test/handler/handler_pre_validation_test.dart | 129, 145, 159, 173, 187, 201, 233, 254 | 8 | error fields; line 233 strengthens a negative assertion, not an inevitable failure. |
| code/dart/modular_api/test/plugin_host/plugin_host_guardrails_test.dart | 13, 63 | 2 | Old body equality. |
| code/dart/modular_api/test/graphql/graphql_runtime_execution_test.dart | 144, 168, 257, 283, 307 | 5 | GraphQL error result. |
| code/dart/modular_api/test/health/health_handler_test.dart | 68 | 1 | body.status moves to health.status. |
| code/py/modular_api/tests/test_usecase_handler.py | 127, 135, 144, 160 | 4 | Validation, domain exception, unexpected exception, and non-object body. |
| code/py/modular_api/tests/test_fromjson_validation.py | 96, 103, 110 | 3 | HTTP Pydantic errors with error. |
| code/py/modular_api/tests/test_use_case_exception.py | 23, 34, 46 | 3 | Current/default serialization. |
| code/py/modular_api/tests/plugin_host/test_plugin_host_guardrails.py | 29, 70 | 2 | Short-circuit and outer 500. |
| code/py/modular_api/tests/graphql/test_graphql_runtime_execution.py | 133, 152, 222, 241, 260 | 5 | GraphQL error status/envelope/extensions. |
| **Total cases / files** | **16 TS + 19 D + 17 P** | **52 / 15** | **Located minimum for adaptation/strengthening.** |
| code/tests/integration_test/parity_test.ps1 | Scenario assertions: 406, 434, 462, 546; comparisons: 773, 784, 795, 821 | **4 scenarios** | Replace error with type/status/detail/issues and compare the entire contract. |

For unambiguous file:line verification, example count anchors: code/ts/modular_api/test/handler/handler_pre_validation.test.ts:88; code/dart/modular_api/test/graphql/graphql_runtime_execution_test.dart:144; code/py/modular_api/tests/graphql/test_graphql_runtime_execution.py:133. The other lines in each row belong to the same indicated file.

**Additional work beyond those 52:**

- Strengthen tests that check only status/logs: handler_logger in TS/Dart and the logging block in code/py/modular_api/tests/test_usecase_handler.py:237; Python health in code/py/modular_api/tests/health/test_health_handler.py:52; routing in official_plugins_basepath and graphql_runtime_integration. They do not necessarily require changing an existing assertion, but must demonstrate the new body/header.
- Extend all three OpenAPI suites and all three plugin contribution suites. The Python test code/py/modular_api/tests/openapi/test_openapi_spec.py:173 only requires the presence of 200/400/500; it may pass even without Problem Details. Do not count it as a current error-schema test.
- Extend six client suites: httpClient/http_client and graphqlClient/graphql_client in all three languages. External 401/text tests may remain valid; add responses from our new server. The three traditional GraphQL preservation tests remain if third-party interoperability is promised.
- Preserve fromjson/schema unit tests for local errors and add issue tests. Changing text or coercion rules expands the scope; do not automatically count all local validation as an HTTP break.
- Include regression checks for logging/tracing/metrics: same trace_id, exactly one completion, final status, correct counters. Current log tests containing error are not HTTP body contracts merely for that reason.
- The TS test code/ts/modular_api/test/handler/body_parser_error.test.ts:99 uses its **own test fallback** that emits {error:"fallback handler"}; it does not demonstrate ModularApi's fallback and was not counted among producers or the 51 positive assertion breaks.

### Proposed TDD to cover ALL producers

**First red:**

1. Create language-independent JSON fixtures with an E01…E40 identifier, variant, preconditions, and expected status, media type, type, title, headers, and body schema. Generic fixtures: /api/example and data without references to real applications.
2. Model and catalog unit tests: defaults, unknown extensions, registered/unregistered code, reserved fields, invalid status, safe serialization, and redacted messages. Test the UseCaseException fragment and complete HTTP response separately.
3. Integration tests using **real ModularApi**, not just isolated handlers. Build equivalents in all three SDKs with fake plugins and executors. Force every inventory branch, including errors outside the handler.
4. Make the 52 identified cases red to require the new contract; preserve assertions that factory/execute are not called when input fails.
5. Add a universal error-response assertion: base media type problem+json, JSON object, required fields and types, HTTP status=body.status, type/instance URI, correct catalog, consistent trace_id/header, no reserved legacy fields at the root or internal information.
6. Do not use “has status >=400” as the sole detector of the error under test: explicitly mark GraphQL cases with errors within 200 so the initial test **fails**. Likewise for Output or plugins that attempt to return errors as success.
7. Also test directly returned responses: empty/text/binary/JSON/native Response/typed error, in every middleware slot; before and after parser/routing. In TS include res.send/res.end and async callbacks; in ASGI multipart body and response commitment; in Shelf Response/stream.
8. Test generated spec conformance against actual responses. Resolve every $ref and check application/problem+json for 400/500 and other declared errors, including plugins.

**Then green, layer by layer but without partial publication:**

- Implement the model, classifiers, writer, router/handler boundary, and plugin output.
- Include GraphQL/health and clients in the same candidate.
- Add an emergency serialization guard and control errors after commitment.
- Complete OpenAPI and parity tests before allowing release.

**Minimum negative matrix currently missing:**

| Area | Required variants |
| --- | --- |
| Parser/413 | E01–E09; zero bytes versus {}, null/array/string/number; exact limit/+1; chunked/compressed/charset; error before matching; aborted without inventing a body. |
| Input | Required/null/incorrect optional field; string/integer/number/boolean/array/object; nested structures and JSON Pointer with / and ~; ordered multiple validation; query/path; GET/DELETE (Dart currently uses body for DELETE, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:25). |
| Domain/output | Every registered status; empty/missing errorCode; details with reserved keys/non-JSON data/cycles; getter/toJson error; Output 4xx/5xx and invalid status. |
| Routing/HTTP | 404 inside/outside basePath; 405 with Allow; invalid URI; native HTTPException; HEAD without a body; preserved OPTIONS/CORS; Accept application/json, problem+json, */*, and absent. |
| Plugins/host | Sync throw, async reject, short-circuit in every slot/custom middleware; already constructed Response; header/serializer failure; attempt to write legacy; failing logger/exporter; routes excluded from logging. |
| GraphQL | Invalid JSON/envelope/query; invalid document; schema/variables/operationName; introspection; limits; resolver validation; throwing executor; multiple errors, partial data, and batch according to the decision; native Leto 400/405/500 response. |
| Operational endpoints | Health fail/timeout/throw; actual service/serializer failure; docs/OpenAPI/metrics fail before and after output starts; startup without HTTP. |
| Clients | Valid Problem/with parameters; new extensions; mismatched error status; truncated or non-JSON body; generic fallback; external server legacy; partial GraphQL; do not invent a remote problem for a local timeout. |
| Parity | Same inputs and configuration; compare complete objects, normalizing only instance/trace_id/timestamps/duration; do **not** normalize type/status/detail/codes to hide divergences. |

**Exhaustiveness control:** a producer manifest requires every ID and variant to have tests in all three SDKs or documented N/E solely for a physical transport peculiarity. Make CI reject a new producer without a fixture and detect new error writes outside the writer. An rg/lint for status/json helps discover them, but does not replace semantic tests or detect all dynamic HTTP on its own.

Universal coverage must be part of the public plugin contract. If transport bypasses are allowed, do not claim an absolute guarantee for them. Tests for already-sent headers must demonstrate that a second send is prevented; do not require an impossible Problem response.

### Definition of done

Adoption is complete only when all errors that can be emitted before response commitment use the profile; all three implementations and affected clients pass the same suite; GraphQL and health have an approved and covered contract; OpenAPI matches; there is no legacy flag in the new release line; and the release candidate is complete in all three SDKs. No test that is “green” merely because it preserves error/message meets that criterion.

## 11. Open decisions, with recommendations

| Team decision | Recommendation | Consequence of deferral |
| --- | --- | --- |
| Normative RFC | Adopt 9457; mention 7807 as a compatible predecessor; correct §4.5/§12 and references. | Outdated normative documentation even if the JSON works. |
| Standard GraphQL versus literal requirement | If the stated mandate prevails, explicitly approve a custom HTTP profile with Problem Details for all errors and migrate clients. If that cost is unacceptable, do not adopt partially. | Blocks the final design of the general contract. |
| Partial GraphQL data/Dart batch/raw/multipart | Preserve safe partial data within graphql, never implicit success; start with a shared single-request JSON contract and document removal of extensions lacking parity. | No deterministic translation or clear compatibility commitment. |
| Health 503/H | Approve 503/Problem + health; adapt monitors; amend the canonical health specification. | Retaining H on failure would contradict “EVERY error.” |
| URI namespace and domain types | Controlled stable public domain; type catalog/semantic versioning independent of the package number; about:blank for generic HTTP. | Do not freeze provisional type URIs; changing them later breaks identity. |
| errorCode/title/details | Explicit registry; preserved code; public detail; nested details with a schema. | The current error ambiguity cannot be carried over correctly. |
| Validation | Preserve 400; structured ordered issues; agree on null/optional fields/coercion/first failure versus aggregation. | Bodies may still diverge even with a shared media type. |
| instance and correlation | Occurrence URN; trace_id consistent with the current mechanism even without an access log; incoming header validation. | Risk of using path as a false identity or breaking W3C/UUID/request ID. |
| Extension/streaming boundary | Typed writers and a guard before sending; prohibit error bypasses in conforming plugins; define response commitment. | Middleware may reintroduce legacy without a catch intercepting it. |
| New statuses and precedence | Explicitly approve parser 400/413/415 and method 405; transport errors before routing with an identical policy. | More than body shape changes without a defined status contract. |
| Effective versioning and release | ADR-0002 while it remains current; clean major release; resolve the relationship with 1.0/LTS; coordinated release, verified constraints. | A partial release or one treated as minor violates the mandate and roadmap. |
| Preview/flag | Avoid a production flag; if essential, global for all producers with coordinated removal. | The matrix doubles and “full adoption” remains pending. |
| jsonBodyLimit | Separate additive work with the default intact; define cross-SDK limits under another explicit scope. | Risk of mixing capability expansion with an error-contract break. |

These are team decisions for the next phase, not requests for permission to write code in this task.

## 12. Proposed implementation sequence

1. **Finalize the contract in a new ADR.** Specify RFC 9457, strict scope, GraphQL/health, type namespace, status, issues, security, and physical limits. Correct the documentation inconsistencies found. Output: a reviewable contract and finalized catalog.
2. **Prepare fixtures and red tests in all three SDKs.** Materialize E01–E40 and variants; rewrite affected tests; extend client/OpenAPI tests. Output: visible nonconformance, without publishing partial changes.
3. **Prepare tolerant consumers.** Add ProblemDetails reading to REST/GraphQL clients and a migration guide. This may precede the server if additive and compliant with the current release policy.
4. **Create a shared model and native adapters.** Domain error and problem fragment separate from HTTP context; one writer per SDK with the same rules and catalog.
5. **Migrate complete REST admission and lifecycle.** Parser/size/media/URI; DTO; validate; handled/unhandled exceptions; error output; serialization; 404/405 and headers.
6. **Migrate the plugin host and outer barrier.** Direct responses, middleware, async, HTTPException, logger failure, streams, and writer emergency handling. No permitted HTTP error output may bypass it.
7. **Migrate GraphQL and health as part of the same work.** Engine errors and native responses, partial data, status, and safe messages; health fail/timeout/exception; negative operational cases.
8. **Align OpenAPI, documentation, and clients.** Components/responses, plugin contributions, domain metadata, complete examples and changelogs; compatibility across the five projects.
9. **Ecosystem conformance gate.** Green TDD in all three SDKs, complete-object parity matrix, consumer tests, and no duplicate output. Re-audit producers and every directly emitted error status.
10. **Prepare a coordinated major release.** Version under the current ADR, constraints, breaking-change notes, and publication/retry plan. Verify all three packages of each affected project before the announcement.
11. **Publish and communicate the complete set during the authorized implementation phase.** This document does not execute that phase. Do not release only 413 or one SDK ahead of the others as completed RFC adoption.

The jsonBodyLimit option may be developed and released before these steps as an independent capability change, under the applicable versioning policy and without altering the error format. It does not eliminate any task in this sequence.

## 13. Evidence and limits of this review

- Static review of the three current implementations, fifteen packages, docs-ui, canonical documentation, ADRs, and tests. Verified external sources: RFC Editor for 7807/9457 and the official GraphQL over HTTP draft.
- Local dependencies used to trace delegated errors: body-parser/raw-body/Express/finalhandler in code/ts/modular_api/node_modules; Starlette in code/py/modular_api/.venv/Lib/site-packages; Shelf 1.4.2, shelf_router 1.1.4, and leto_shelf 0.0.1-dev.2 from the package cache indicated by code/dart/modular_api/.dart_tool/package_config.json.
- Those dependency representations are evidence of what is installed, not a promise for every version allowed by open ranges. The implementation must fix transport fixtures in CI; do not base future guarantees on uncontrolled defaults.
- There is no claim that 52 is the final number of tests to modify: it is the identified, individually listed baseline. Coverage must be added/strengthened, scenarios contain multiple requests, and there are dependencies on open decisions. No tests have been run to estimate “how many fail.”
- Traffic, deployments, and consumer applications were not inspected. “Consumed contract” here means public and fixed by tests; the evidence does not allow counting real clients.
- Only output written by this task: this analysis file.
