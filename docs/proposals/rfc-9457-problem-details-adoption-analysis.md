# Adopción ecosistémica de Problem Details en modular_api

Fecha de revisión: 13 de septiembre de 2026. Documento de análisis y diseño; no implementa cambios.

## 1. Dictamen y alcance

**Recomendación: una migración breaking, completa y coordinada de TypeScript, Dart y Python, con RFC 9457 como referencia normativa y un objeto compatible con RFC 7807.** El inventario contiene **40 familias de fallos/rutas de salida**, desglosadas por SDK. No son 40 códigos HTTP ni 120 fallos garantizados: hay disparadores compartidos, condiciones dependientes de la aplicación y mecanismos que solo existen en una implementación.

La exigencia «TODO error» alcanza REST, errores de lectura del cuerpo, validación, dominio, routing, plugins, middleware, GraphQL, salud y errores al servir superficies operacionales. Incluye respuestas de error construidas directamente, sin lanzar excepciones. La publicación no debe dejar a ningún SDK ni productor con el contrato anterior.

Hay dos conflictos que el equipo debe resolver explícitamente antes de implementar: **GraphQL utiliza errores dentro de resultados HTTP 200**; **salud usa 503 con application/health+json**. Este diseño los incluye en la migración estricta. Conservar esas salidas intactas sería una excepción al requisito recibido y no se presenta aquí como adopción total. Evidencia: code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:349, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:392, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138; code/ts/modular_api/src/core/health/health_service.ts:33 y docs/architecture.md:529.

El requisito describe errores comunicables por HTTP. No puede convertir en un cuerpo JSON una desconexión, un error de TLS, un proceso que no arrancó o una respuesta cuyos bytes ya se enviaron. Tampoco transforma automáticamente en HTTP los resultados locales de los clientes REST/GraphQL o de los contratos de base de datos. Sus límites y su impacto se detallan en §4 y §8.

### Método y nivel de certeza

- Se leyeron fuentes, configuración, ADRs, arquitectura, roadmap, pruebas relevantes y dependencias ya presentes. No se ejecutaron tests, builds, instalaciones, comandos git ni servidores.
- Python está en code/py, no en code/python. Las tres raíces contienen core, rest_client, graphql_client, sqlserver y postgres. También se revisó docs-ui: es consumidor de documentación, no un cuarto servidor API. El conjunto de quince paquetes está enumerado en docs/adr/0002-synchronized-versioning-across-sdks.md:41; docs-ui queda separado en la línea 49.
- «Hoy» significa comportamiento deducido del código local inspeccionado. Las ramas de dependencias se identifican como tales; no se afirma haber reproducido cada petición por red. Los manifests de los tres cores declaran 0.7.0: code/ts/modular_api/package.json:3, code/dart/modular_api/pubspec.yaml:3, code/py/modular_api/pyproject.toml:7. No se comprobó qué versión está desplegada o publicada.
- Las referencias archivo:línea se verificaron en esta revisión. Las referencias a dependencias instaladas no se elevan a canon: sirven para explicar respuestas delegadas.
- La tabla es exhaustiva por **familia de productor y ruta de salida**, no por cada texto posible de una excepción o de un plugin arbitrario. Las extensiones permiten infinitos mensajes y status; se inventarían datos si se enumerasen como un conjunto cerrado.

## 2. Qué establece ya el canon y qué se propone

| Asunto | Canon actual verificado | Recomendación de este análisis |
| --- | --- | --- |
| Alcance de la arquitectura | Aplica a todas las implementaciones; mismo comportamiento externo y estructura de errores: docs/architecture.md:5, docs/architecture.md:795, docs/architecture.md:804. | Una sola especificación de errores y fixtures comunes para los tres SDKs. |
| Adopción prevista | Es dirección futura, no contrato implementado: docs/architecture.md:189 y docs/architecture.md:729. Incluye todos los errores en docs/architecture.md:733. | Convertirla en requisito verificable de la siguiente release breaking. |
| Cinco pasos existentes | Añadir type/title a UseCaseException; validation-error; internal-error; media type problem+json; mapear error/message y errorCode: docs/architecture.md:748, docs/architecture.md:749, docs/architecture.md:750, docs/architecture.md:751, docs/architecture.md:752. | Mantener la intención y completar parser, routers, plugins, GraphQL, salud, serialización, clientes, OpenAPI y publicación. Los pasos no autorizan releases parciales. |
| Status y seguridad | UseCaseException conserva su status; validación validate() es 400; excepción no controlada es 500 genérico sin stack: docs/architecture.md:210. | Mantener esas reglas, corrigiendo las clasificaciones accidentales de parser y documentando los cambios adicionales de GraphQL. |
| Output | Debe declarar statusCode: docs/architecture.md:140; el handler lo transmite: code/ts/modular_api/src/core/usecase_handler.ts:89, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:61, code/py/modular_api/src/modular_api/core/usecase_handler.py:113. | Un Output con 4xx/5xx debe pasar por el contrato de problemas; no puede ser una vía alternativa de errores. |
| Plugins | Oficiales y terceros usan el mismo contrato: docs/architecture.md:298. Rutas de plugins documentables: docs/adr/0003-plugin-routes-first-class-in-openapi-and-metrics.md:39. | Escritor de respuestas de error y controles de conformidad del host también para plugins. |
| Salud | 503 por fail y application/health+json: docs/architecture.md:525. | Mantener el status 503, cambiar la representación de fail a Problem Details con extensión health. Requiere enmendar §8 del canon. |
| Paridad de versiones | ADR-0002 Accepted, quince paquetes; ADR-0006 aún Proposed: docs/adr/0002-synchronized-versioning-across-sdks.md:7, docs/adr/0006-per-project-versioning-across-the-three-sdks.md:7. | Aplicar la política vigente, no asumir aceptada la propuesta. |
| Major | Breaking del core o del contrato de plugins requiere major: docs/roadmap.md:11. | Release major coordinada; no denominarla patch ni esconderla como corrección de 413. |

Observaciones documentales a corregir en la implementación futura: docs/architecture.md:205 tiene una línea ajena de métricas incrustada en el párrafo de RFC; el ejemplo usa validation-failed en la línea 738 y el plan validation-error en la 749. El roadmap dice Current State 0.6.0 en docs/roadmap.md:29 y la matriz de arquitectura todavía muestra 0.4.5 en docs/architecture.md:786. Se propone corregirlos, sin modificarlos en esta tarea. No hay un ADR específico de Problem Details entre los seis ADRs existentes.

## 3. Inventario actual y mapeo individual viejo → nuevo

### Leyenda de cuerpos, media types y pruebas

Cada celda de SDK indica **status / media type / cuerpo**:

- **J** = application/json; handlers REST TS/Dart/Python añaden charset=utf-8. El 500 exterior de Python usa JSONResponse sin ese parámetro. Referencias: code/ts/modular_api/src/core/usecase_handler.ts:15, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:16, code/py/modular_api/src/modular_api/core/usecase_handler.py:23, code/py/modular_api/src/modular_api/core/error_response_middleware.py:30.
- **G** = application/json; TS y Python fijan charset=utf-8 (code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:99, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:85), Dart usa application/json en los caminos examinados. No es application/problem+json: code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1206, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:409, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138.
- **H** = application/health+json, posiblemente charset=utf-8 en el plugin oficial: code/ts/modular_api/src/core/official_plugins.ts:124, code/dart/modular_api/lib/src/core/official_plugins.dart:159, code/py/modular_api/src/modular_api/core/official_plugins.py:140.
- **I** = {"error":"Internal server error"}.
- **V(m)** = {"error":m}.
- **U(c,m,d)** = {"error":c,"message":m,"details":d}; details se omite si no existe; c por defecto es "error". Python usa el valor por defecto también para cadena vacía; TS/Dart solo para ausencia/null: code/ts/modular_api/src/core/use_case_exception.ts:49, code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40, code/py/modular_api/src/modular_api/core/use_case_exception.py:39.
- **GErr** = {"errors":[{"message":m,"locations":...,"path":...,"extensions":...}], "data":...}; miembros opcionales según fase/motor. Python omite data cuando es None; TS puede emitir data:null. code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1225, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1138.
- **HF** = {"status":"fail","version":...,"releaseId":...,"checks":{nombre:{"status":...,"responseTime":...,"output":...}}}. Campos de cada check pueden omitirse. code/ts/modular_api/src/core/health/health_service.ts:37, code/dart/modular_api/lib/src/core/health/health_service.dart:27, code/py/modular_api/src/modular_api/core/health/health_service.py:37.
- **N/E** = el SDK no tiene ese rechazo específico en el camino revisado; no significa que toda petición sea aceptada.
- **C** = prueba comprueba cuerpo/campo antiguo; **S** = solo status/ruta; **U** = prueba unitaria de dato/excepción, no HTTP; **—** = no se encontró prueba específica. «C» prueba contrato fijado por tests; no prueba consumo real por clientes externos.
- Los códigos Q1…Q15 remiten al catálogo de §5. En todos los destinos con respuesta escribible se añaden status, instance y trace_id, y el Content-Type objetivo es application/problem+json. No se hereda del endpoint exitoso.

### 3.1 Lectura de peticiones, DTOs y casos de uso

| ID y disparador | TypeScript hoy | Dart hoy | Python hoy | Tests existentes / contrato | Destino y mapeo |
| --- | --- | --- | --- | --- | --- |
| E01. JSON malformado en endpoint REST | 400/J/V("Invalid JSON in request body"), code/ts/modular_api/src/core/body_parser_error_handler.ts:31. | 500/J/I por jsonDecode, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | 500/J/I por request.json(), code/py/modular_api/src/modular_api/core/usecase_handler.py:81, code/py/modular_api/src/modular_api/core/usecase_handler.py:138. | C TS: code/ts/modular_api/test/handler/body_parser_error.test.ts:50; — D/P específico. | Q1, 400 en los tres; error → detail. No exponer el texto nativo del parser. |
| E02. Cuerpo realmente vacío, cero bytes | express.json() produce {} o handler usa {}; puede terminar en validación 400 o éxito según DTO: code/ts/modular_api/src/core/usecase_handler.ts:54. | 500/J/I al decodificar "", code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | 500/J/I al decodificar vacío, code/py/modular_api/src/modular_api/core/usecase_handler.py:81. | Los tests llamados empty body mandan {}; no fijan cero bytes: code/dart/modular_api/test/handler/handler_pre_validation_test.dart:254, code/ts/modular_api/test/handler/handler_pre_validation.test.ts:151. | Política propuesta: normalizar vacío a {} cuando el endpoint admite entrada vacía; si faltan campos, Q3/400. Si el endpoint exige documento, Q1/400. Especificar por operación, idéntico en tres SDKs. |
| E03. JSON válido cuyo nivel superior no es objeto | Primitivo/null rechazado como E01 por strict del parser; array pasa y puede dar E10 o aceptación: code/ts/modular_api/src/core/usecase_handler.ts:54; code/ts/modular_api/node_modules/body-parser/lib/types/json.js:81. | 500/J/I por cast a Map, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:97. | 400/J/V("Request body must be a JSON object"), code/py/modular_api/src/modular_api/core/usecase_handler.py:83. | C P: code/py/modular_api/tests/test_usecase_handler.py:160; — T/D rechazo uniforme. | Q2/400; texto público → detail; errors con pointer "" si se incluye. Rechazar arrays también en REST TS. |
| E04. Cuerpo JSON mayor al límite | Dependencia genera entity.too.large/413; TB lo reenvía y TX lo convierte en **500/J/I**. code/ts/modular_api/src/core/modular_api.ts:361, code/ts/modular_api/src/core/body_parser_error_handler.ts:41, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18; code/ts/modular_api/node_modules/raw-body/index.js:162. | N/E: lectura sin límite explícito en code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:96 y code/dart/modular_api/lib/src/core/plugin.dart:591. | N/E: request.json() sin límite del core en code/py/modular_api/src/modular_api/core/usecase_handler.py:81 y code/py/modular_api/src/modular_api/core/plugin.py:484. | — No se encontró test dedicado de 413/límite. | Q4/**413** uniforme donde se aplique el límite. I no aporta detalle útil; emitir mensaje seguro propio y opcional limit_bytes. Separar de la opción de configuración (§9). |
| E05. Charset no soportado por parser JSON | Dependencia 415 charset.unsupported → 500/J/I: code/ts/modular_api/node_modules/body-parser/lib/types/json.js:128; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Sin clasificador equivalente; fallo de lectura/decodificación REST → 500/J/I: code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:96, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81. | Sin clasificador equivalente; no validación explícita del charset del header en code/py/modular_api/src/modular_api/core/usecase_handler.py:81; fallo de decodificación → 500/J/I. | — | Q5/415 para charset no admitido; validar política común antes de parsear. Mensaje fijo; no copiar bytes. |
| E06. Content-Encoding no soportado | Dependencia 415 encoding.unsupported → 500/J/I: code/ts/modular_api/node_modules/body-parser/lib/read.js:181; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No adaptador de rechazo equivalente en code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95. | No adaptador de rechazo equivalente en code/py/modular_api/src/modular_api/core/usecase_handler.py:81. | — | Q5/415; elegir encodings admitidos iguales en tres SDKs. No afirmar soporte uniforme actual. |
| E07. Cuerpo comprimido corrupto/error de descompresión | Error de lectura reenviado → 500/J/I; code/ts/modular_api/node_modules/body-parser/lib/read.js:75 y code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No descompresor equivalente del core en code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:95; fallo al parsear cae en E01. | No descompresor equivalente del core en code/py/modular_api/src/modular_api/core/usecase_handler.py:81; fallo al parsear cae en E01. | — | Q1/400 si falla un encoding admitido; Q5/415 si no se admite. Nunca convertir indiscriminadamente todo error de lectura en 413. |
| E08. Lectura abortada o longitud declarada inconsistente | Dependencia 400 request.aborted/request.size.invalid → intento 500/J/I si aún se puede responder: code/ts/modular_api/node_modules/raw-body/index.js:245, :277; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Fallo de stream REST → intento 500/J/I, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81; en plugin → code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | Fallo REST → intento 500/J/I, code/py/modular_api/src/modular_api/core/usecase_handler.py:138; code/py/modular_api/src/modular_api/core/plugin.py:485 puede absorberlo y dejar body=None. | — | Q1/400 cuando hay respuesta posible; desconexión sin respuesta se registra, no se inventa entrega de Problem Details. |
| E09. Stream no legible o encoding cambiado por código | Dependencia 500 stream.not.readable/stream.encoding.set → 500/J/I: code/ts/modular_api/node_modules/raw-body/index.js:177; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Errores internos de lectura caen en code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81 o code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | Errores internos caen en code/py/modular_api/src/modular_api/core/usecase_handler.py:138 o code/py/modular_api/src/modular_api/core/error_response_middleware.py:30; el lector de plugins también puede absorberlos, code/py/modular_api/src/modular_api/core/plugin.py:485. | — | Q6/500, detalle genérico; distinguir del error imputable a la petición. |
| E10. Campo requerido ausente o null | 400/J/V("Missing required field: n"), antes o después de factory: code/ts/modular_api/src/core/usecase.ts:153; code/ts/modular_api/src/core/usecase_handler.ts:93. | 400/J/V igual, pre/post: code/dart/modular_api/lib/src/core/schema/field.dart:203; code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:75. | 400/J/V; missing usa esa frase, pero null puede clasificarse por Pydantic como tipo inválido: code/py/modular_api/src/modular_api/core/usecase_handler.py:49, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. | C: T pre_validation:88; D pre_validation:129; P fromjson:96, rutas completas en §10. U adicionales fromjson en T/D. | Q3/400; mensaje → detail; issue estructurado {code:"required",pointer:"/n",location:"body",detail:...}. Decidir y fijar null idéntico. |
| E11. Tipo de campo incorrecto | 400/J/V("Field 'n' must be of type t"), code/ts/modular_api/src/core/usecase.ts:157; code/ts/modular_api/src/core/usecase_handler.ts:93. Solo required se comprueban. | 400/J/V mismo patrón: code/dart/modular_api/lib/src/core/schema/field.dart:203; code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:75. Solo required. | 400/J/V construido desde primer ValidationError: code/py/modular_api/src/modular_api/core/usecase_handler.py:30, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. Pydantic puede coercionar más valores. | C T/D pre_validation para string/integer/number/boolean/array; C P fromjson:103, :110. U object en fromjson de los tres. | Q3/400; errors[*] con code:"type", expected y pointer; detail de resumen. No parsear el mensaje para reconstruir el campo. |
| E12. Otras restricciones de DTO, anidados y validadores Pydantic | Sin motor general equivalente; DTO personalizado puede lanzar E16 o E14/E15. code/ts/modular_api/src/core/usecase_handler.ts:90. | Igual; casts de factory sin prevalidación pueden ser 500, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81. | Captura cualquier ValidationError del try completo, reduce al primer loc y mensaje genérico si tipo no está en mapa: code/py/modular_api/src/modular_api/core/usecase_handler.py:51, code/py/modular_api/src/modular_api/core/usecase_handler.py:128. | — en HTTP para catálogo completo de restricciones; U de DTO no equivale a conformance HTTP. | Q3/400 para validación de **entrada** tipada; errores de validación de salida o ejecución interna Q6/500. Clasificar por fase, no solo clase de excepción. |
| E13. validate() devuelve texto de regla de negocio | 400/J/V(m), code/ts/modular_api/src/core/usecase_handler.ts:79. | 400/J/V(m), code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:45. | 400/J/V(m), code/py/modular_api/src/modular_api/core/usecase_handler.py:101. | C P handler:127; C paridad: code/tests/integration_test/parity_test.ps1:406 y :546. | Q3/400; m → detail. Si solo hay string, no inventar campo: errors opcional o issue a nivel de objeto. |
| E14. UseCaseException sin errorCode | status de excepción/J/U("error",m,d), code/ts/modular_api/src/core/usecase_handler.ts:97, code/ts/modular_api/src/core/use_case_exception.ts:49. | status/J/U, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:66, code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40. | status/J/U, code/py/modular_api/src/modular_api/core/usecase_handler.py:119, code/py/modular_api/src/modular_api/core/use_case_exception.py:39. | U de serialización C D: code/dart/modular_api/test/use_case_exception_test.dart:49; P: code/py/modular_api/tests/test_use_case_exception.py:46. | Q15 about:blank por defecto con title de status; message → detail; details → extensión details filtrada. Si type explícito registrado, usarlo. Validar status 400–599. |
| E15. UseCaseException con código y/o details | status/J/U(c,m,d), code/ts/modular_api/src/core/use_case_exception.ts:49, code/ts/modular_api/src/core/usecase_handler.ts:99. | status/J/U(c,m,d), code/dart/modular_api/lib/src/core/usecase/use_case_exception.dart:40, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:73. | status/J/U(c,m,d), code/py/modular_api/src/modular_api/core/use_case_exception.py:39, code/py/modular_api/src/modular_api/core/usecase_handler.py:124. | C P handler:135; C serialización D:20, :34 y P:23, :34 de use_case_exception tests. T handler_logger:96 fija status/log, no cuerpo. | Tipo de dominio registrado Q14; código → code y URI por registro; message → detail; title estable; details no sustituye detail. |
| E16. Excepción inesperada en factory, validate, execute, output/status o serialización | 500/J/I, code/ts/modular_api/src/core/usecase_handler.ts:90; si falló al serializar U dentro del catch puede escapar del async handler. | 500/J/I, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:81; una excepción lanzada dentro de catch escapa al wrapper. | 500/J/I, code/py/modular_api/src/modular_api/core/usecase_handler.py:138; fallo al construir respuesta en except escapa al wrapper. | C P handler:144; S T/D handler_logger y D pre_validation:271. | Q6/500 y serializador de emergencia no recursivo; nunca error.toString/stack/SQL en detail. |
| E17. Output declara 4xx/5xx con cuerpo propio | status/J/output.toJson(), code/ts/modular_api/src/core/usecase_handler.ts:89. | status/J/output.toJson(), code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:61. | status/J/output.to_json(), code/py/modular_api/src/modular_api/core/usecase_handler.py:113. | — contrato HTTP negativo específico encontrado; capacidad pública explícita en code/ts/modular_api/src/core/usecase.ts:211. | ProblemOutput/UseCaseException tipado recomendado. Output no tipado de error → Q15 con status y detalle genérico; conservar datos solo mediante adaptador explícito seguro. No interpretar automáticamente message/success de cualquier objeto. |

### 3.2 Routing, plugins y protecciones exteriores

| ID y disparador | TypeScript hoy | Dart hoy | Python hoy | Tests existentes / contrato | Destino y mapeo |
| --- | --- | --- | --- | --- | --- |
| E18. Ruta inexistente, incluida ruta de plugin deshabilitado o fuera de basePath | 404/text/html/HTML "Cannot METHOD path", finalhandler por falta de fallback: code/ts/modular_api/src/core/modular_api.ts:377; code/ts/modular_api/node_modules/finalhandler/index.js:114, :299. | 404/sin Content-Type explícito en Response/"Route not found": code/dart/modular_api/lib/src/core/modular_api.dart:21; dependencia shelf_router-1.1.4/lib/src/router.dart:286. | 404/text/plain; charset=utf-8/"Not Found": code/py/modular_api/src/modular_api/core/modular_api.py:251; code/py/modular_api/.venv/Lib/site-packages/starlette/routing.py:616. | S official_plugins_basepath y graphql_runtime_integration en tres SDKs. | Q7/404; texto/HTML se reemplaza por detail fijo; no copiar página HTML al problema. Incluye fuera de basePath si la petición llegó al host. |
| E19. Método no registrado sobre ruta existente | Generalmente 404 HTML como E18; Express no crea 405 aquí. code/ts/modular_api/src/core/modular_api.ts:377. | 404 como E18 por comparación de verbos; shelf_router-1.1.4/lib/src/router.dart:179. | 405/text/plain/"Method Not Allowed", Allow del router: code/py/modular_api/.venv/Lib/site-packages/starlette/routing.py:267. | — test dedicado de paridad 405. | Q8/405 si path existe y método no; conservar Allow. 404 si no existe. OPTIONS/CORS y HEAD requieren tratamiento HTTP propio. |
| E20. Parámetro de ruta con escape URI inválido | Express genera URIError con status 400, TX lo aplana a 500/J/I: code/ts/modular_api/node_modules/express/lib/router/layer.js:166; code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | No clasificador propio equivalente; depende del parser/Router. code/dart/modular_api/lib/src/core/modular_api.dart:21. | No clasificador propio equivalente; depende del servidor ASGI y router. code/py/modular_api/src/modular_api/core/modular_api.py:251. | — | Q1/400 para URI inválida identificada en un request admitido por el host. No atribuir a D/P un status nativo no fijado por tests. |
| E21. Excepción HTTP nativa lanzada dentro de una ruta de plugin | No excepción HTTP nativa reconocida; error con status acaba en 500/J/I, code/ts/modular_api/src/core/plugin.ts:512, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. | Excepción acaba en 500/J/I, code/dart/modular_api/lib/src/core/plugin.dart:530, code/dart/modular_api/lib/src/core/error_response_middleware.dart:21. | HTTPException de ruta la atiende Starlette: status indicado/text/plain/detail; si ocurre en middleware del usuario, PX captura como 500/J/I. code/py/modular_api/src/modular_api/core/plugin.py:489; dependencia starlette/middleware/exceptions.py:65. | — test específico; diferencia de alcance demostrada por el montaje code/py/modular_api/src/modular_api/core/modular_api.py:251, code/py/modular_api/src/modular_api/core/modular_api.py:271. | Adaptador explícito de excepciones HTTP conocidas → Q15 o tipo específico, status 4xx/5xx válido y headers permitidos; no confiar en cualquier objeto con propiedad status. |
| E22. Plugin/middleware lanza excepción no controlada antes de enviar headers | Error de ruta y middleware de plugin, incluso promesa rechazada, → 500/J/I: code/ts/modular_api/src/core/plugin.ts:512, code/ts/modular_api/src/core/plugin.ts:572, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18. El middleware custom montado por api.use no recibe ese wrapper (code/ts/modular_api/src/core/modular_api.ts:367); allí un rechazo async sin next no está garantizado. | 500/J/I: code/dart/modular_api/lib/src/core/error_response_middleware.dart:13. | 500/J/I: code/py/modular_api/src/modular_api/core/error_response_middleware.py:20. | C guardrails throw en los tres: T:52, D:63, P:70; §10 da rutas completas. | Q6/500. Envolver callbacks async registrados; incluir preRouting, preHandler, postHandler y api.use. Una UseCaseException lanzada fuera del handler hoy tampoco conserva automáticamente su status. |
| E23. Middleware corta la petición devolviendo error directo (auth, autorización, rate limit, etc.) | status arbitrario/cuerpo y media arbitrarios; C de 401/J/V("blocked by plugin"): code/ts/modular_api/test/plugin_host/plugin_host.guardrails.test.ts:26. | Respuesta Shelf arbitraria atraviesa code/dart/modular_api/lib/src/core/error_response_middleware.dart:14. | Mensajes ASGI arbitrarios atraviesan code/py/modular_api/src/modular_api/core/error_response_middleware.py:21. | C tres guardrails short-circuit: T:14, D:13, P:29. No demuestra auth oficial. | Q15 o catálogo Q7–Q9 según semántica declarada. 401/403/429 mantienen status; conservar WWW-Authenticate/Retry-After cuando corresponda. Objeto legado conocido puede adaptarse; opaco → detalle genérico. |
| E24. Ruta de plugin retorna envelope/Response de error, vacío, texto o binario | status; undefined → sendStatus y text/plain; string → text/html por defecto, Buffer → application/octet-stream; objeto → J; contentType/headers pueden sustituirlo. code/ts/modular_api/src/core/plugin.ts:489, code/ts/modular_api/src/core/plugin.ts:499. | Response arbitraria, sin transformación, code/dart/modular_api/lib/src/core/plugin.dart:530. | Response nativa intacta; dict sin body → vacío, str/bytes → text/plain, otro → J; headers pueden sustituirlo. code/py/modular_api/src/modular_api/core/plugin.py:505. | — negativo dedicado por variante; rutas plugin exitosas sí tienen tests. | Q15 con status de error; Response tipada usa su problema; legado conocido mapea campos, vacío/texto/binario arbitrario usa detail genérico. Interceptar antes del envío, no después. |
| E25. Falla la capa exterior de logging/tracing o falla nuevamente el propio error handler | Throw síncrono previo a envío puede alcanzar TX; si el propio TX/logger falla queda finalhandler 500 HTML; callback async tardío puede no producir respuesta. code/ts/modular_api/src/core/modular_api.ts:340, code/ts/modular_api/src/core/modular_api.ts:349, code/ts/modular_api/src/core/unhandled_request_error_handler.ts:13. | Logging/tracing quedan fuera de DX: code/dart/modular_api/lib/src/core/modular_api.dart:273, code/dart/modular_api/lib/src/core/modular_api.dart:289; Shelf puede generar 500/text/plain/"Internal Server Error". shelf-1.4.2/lib/shelf_io.dart:129. | Logging/tracing fuera de PX, code/py/modular_api/src/modular_api/core/modular_api.py:271, code/py/modular_api/src/modular_api/core/modular_api.py:282, code/py/modular_api/src/modular_api/core/modular_api.py:319; ServerErrorMiddleware nativo puede generar 500/text/plain/"Internal Server Error". starlette/middleware/errors.py:258. | — test específico de formato con falla del logger/serializador. | Q6/500 mediante última barrera sin dependencia del logger/telemetría. Si ya empezó la respuesta, aplicar límite físico de §4; no escribir un segundo cuerpo. |


### 3.3 GraphQL y superficies operacionales

En Dart el runtime usa graphQLHttp de leto_shelf sin onError personalizado (code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:201). Se inspeccionó la dependencia instalada **leto_shelf-0.0.1-dev.2/lib/src/graphql_http.dart**; en esta tabla se referencia como **LHTTP:n**. La versión está fijada en code/dart/modular_api/pubspec.yaml:24. Es evidencia de dependencia, no código propio ni un nuevo SDK. El caso batch es una divergencia de transporte actual, no soporte uniforme prometido.

| ID y disparador | TypeScript hoy | Dart hoy | Python hoy | Tests existentes / contrato | Destino y mapeo |
| --- | --- | --- | --- | --- | --- |
| E26. Runtime GraphQL no inicializado | 503/G/{errors:[{message:"GraphQL runtime is not initialized."}]}, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:270. | Lanza StateError; DX produce 500/J/I, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:240. | 503/G/mismo envelope que TS, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:257. | — HTTP; sí pruebas de startup que normalmente impiden alcanzar este estado. | Q10/503 si existe endpoint no listo. message → detail; no publicar detalles de capabilities. |
| E27. Falta query, tipo inválido de envelope/query o JSON malformado para GraphQL | Query ausente o vacía → 400/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:336; JSON malformado interceptado globalmente por E01 antes del plugin. | LHTTP:59, :69 → 400 sin media explícito/cuerpo vacío; LHTTP:74 → 400 sin media explícito/texto de excepción al leer envelope. El host pasa JSON inválido como string, code/dart/modular_api/lib/src/core/plugin.dart:596. | Query ausente → 400/G/GErr; parser del plugin absorbe JSON inválido y pasa None: code/py/modular_api/src/modular_api/core/plugin.py:483, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:331. Cadena query vacía llega a parse y E29. | — caso específico; estados exitosos sí cubiertos. | Q11/400. Unificar envelope, query vacía y error de lectura. message o texto seguro → detail; errores tipados → errors. |
| E28. Media type GraphQL no soportado; multipart inválido; batch con alguna entrada inválida | Sin admisión tipada general: express.json puede omitir parsing; falta query → E27. Array batch sin query URL → E27. code/ts/modular_api/src/core/modular_api.ts:361, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1080. | LHTTP:38 acepta application/graphql; :41 multipart puede dar 400/texto; :51 JSON/graphql+json; otro → 400 vacío. :93 batch devuelve array de resultados 200/G y puede incluir errores. _readBody reconstruye el cuerpo, code/dart/modular_api/lib/src/core/plugin.dart:585 y code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:473: no asumir uploads interoperables. | Lector intenta JSON sin política uniforme; array batch sin query URL → E27, code/py/modular_api/src/modular_api/core/plugin.py:482, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1016. | — test específico cross-SDK. | Q5/415 para media/encoding no admitido; Q11/400 para envelope/multipart/batch rechazado. Recomendación inicial: contrato GraphQL de petición única JSON compartido; decidir retirada del batch/raw/multipart Dart en el mismo major. Si se conserva batch, una única respuesta Problem con issues indexados cuando falle alguna entrada. |
| E29. Sintaxis inválida del documento GraphQL | 200/G/GErr con mensaje y localización, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:345. | 200/G/resultado del motor, LHTTP:79, :104; no confundir con JSON inválido E27. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:339. | — test negativo específico encontrado. | Q11/400; errors con location:"graphql", code:"syntax", detail seguro y locations. No devolver error bajo 200 en el perfil estricto. |
| E30. Validación del esquema: campo/argumento desconocido, introspección deshabilitada | 200/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:364. | 200/G/GErr por validate/introspect en code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:201 y LHTTP:79. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:355. | — específico por cada regla; pruebas de límites no equivalen a probar introspección deshabilitada. | Q11/400 con issues code:"schema"/"introspection_disabled"; mensaje seguro → detail de issue. |
| E31. Profundidad supera maxDepth | 200/G/{errors:[{message,extensions:{validationError:{code:"queryDepthComplexity"}}}]}, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:352. | 200/G mismo patrón con extensions.validationError.spec adicional, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:386. | 200/G mismo patrón TS, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:344. | C tres runtime_execution: T:217 y :257; D:257 y :307; P:222 y :260. | Q12/400; code canónico "depth_limit"; conservar límite en extensión tipada; descartar URL de implementación de Leto. |
| E32. Complejidad supera maxComplexity | 200/G/validationError.code:"queryComplexity", code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:373. | 200/G/error del rule builder de Leto, code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:206 y LHTTP:104. | 200/G/mismo código, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:365. | C tres runtime_execution: T:237; D:283; P:241. | Q12/400; issue code:"complexity_limit". Texto → detail, valores medidos solo si representan la misma métrica en los tres SDKs. |
| E33. Variables no coercibles, operación ambigua/no seleccionable, tipo de operación inválido | execute devuelve errores → 200/G/GErr, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:385. readVariables/readOperationName descartan tipos no previstos, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1088. | Errores de motor 200/G; InvalidOperationType puede salir 405 sin media explícito/texto, LHTTP:113. | execute → 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:376; readers descartan tipos no previstos, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1024. | — matriz específica encontrada. | Q11/400 para entrada inválida; Q8/405 para operación incompatible con método. Política del perfil estricto, no reproducción de los defaults de cada motor. |
| E34. Validación en resolvers de key/filter/orderBy/page, incluidos límites y operadores | GraphQLError con extensions.code; 200/G/GErr, posiblemente data parcial/null, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:590, :828, :928, :964, :1239. | GraphQLError de Leto equivalente; resultado 200/G; code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:638, :889, :1014, :1075. | GraphQLError equivalente y 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:591, :803, :886, :921. | C page max/negativos: T:127, :147; D:144, :168; P:133, :152 de runtime_execution. U compilador no es test HTTP. | Q11/400; code canónico por key/filter/order/page; mensaje seguro → issue.detail, ruta GraphQL → path, sin inventar JSON Pointer del query textual. |
| E35. Excepción del executor/resolver, acceso a catálogo, compilación de lectura o serialización de campo; puede haber data parcial | 200/G/GErr con error.message y metadatos del motor, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:399, code/ts/modular_api/src/graphql/runtime/graphql_runtime_plugin.ts:1225; errores fuera de ejecución capturada pasan por E22. | 200/G/errores del motor, LHTTP:79; salida no capturada por el motor pasa por E36/E22. | 200/G/GErr, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:389, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:1158; fuera del motor E22. | — caso HTTP de excepción interna y resultado parcial específico encontrado. Los clientes sí fijan consumo de errors (§8). | Q13/500 para error no controlado. Redactar mensajes internos; extensión graphql puede conservar data parcial segura y paths. Si todos los errores son tipados de cliente, Q11/400; si alguno es interno, domina 500. |
| E36. Leto devuelve su propia respuesta de error / override / fallo fuera del resultado GraphQL | N/E para Leto; equivalente propio no controlado → E22. | LHTTP:99 y :111 pueden devolver Response nativa; :117 devuelve 500/text/plain/"Internal Server Error" por defecto, sin pasar por DX porque no lanza. | N/E para Leto; fallo propio no controlado → E22. | — | La frontera GraphQL debe normalizar respuestas además de excepciones; 500 → Q6, respuesta HTTP conocida → Q15/Q8/Q11. No basta con onError. |
| E37. HealthCheck retorna fail (incluye un runtime GraphQL unhealthy) | 503/H/HF, code/ts/modular_api/src/core/official_plugins.ts:120, code/ts/modular_api/src/core/health/health_service.ts:33. | 503/H/HF, code/dart/modular_api/lib/src/core/official_plugins.dart:159, code/dart/modular_api/lib/src/core/health/health_service.dart:24. | 503/H/HF, code/py/modular_api/src/modular_api/core/official_plugins.py:140, code/py/modular_api/src/modular_api/core/health/health_service.py:33. | C T health_handler:64 y D:68; S P health_handler:52. U health_service de los tres. | Q10/503; status textual se mueve a health.status, checks/version/releaseId a health; status superior numérico 503. |
| E38. Timeout de HealthCheck | 503/H/HF con output que incluye nombre y milisegundos, code/ts/modular_api/src/core/health/health_service.ts:141. | 503/H/HF, code/dart/modular_api/lib/src/core/health/health_service.dart:117. | 503/H/HF con timeout en segundos, code/py/modular_api/src/modular_api/core/health/health_service.py:100. | U health_service; no prueba HTTP dedicada de todos esos cuerpos. | Q10/503; health.checks con code:"timeout" y duration_ms uniforme si se expone; mensaje público genérico. |
| E39. HealthCheck lanza excepción | 503/H/HF con output:String(err), code/ts/modular_api/src/core/health/health_service.ts:129. | 503/H/HF con output:e.toString(), code/dart/modular_api/lib/src/core/health/health_service.dart:130. | 503/H/HF con output:str(exc), code/py/modular_api/src/modular_api/core/health/health_service.py:107. | U health_service; — sanitización HTTP explícita. | Q10/503; eliminar excepción cruda de salida pública, conservar información segura de check en health. Registrar causa interna. |
| E40. Fallo al servir OpenAPI/docs/metrics o serializar su respuesta | Plugins oficiales pasan por code/ts/modular_api/src/core/plugin.ts:512 → 500/J/I; spec es objeto y se serializa al responder: code/ts/modular_api/src/core/official_plugins.ts:233. | Handler operacional que lanza → code/dart/modular_api/lib/src/core/error_response_middleware.dart:21; code/dart/modular_api/lib/src/core/official_plugins.dart:290 y code/dart/modular_api/lib/src/core/official_plugins.dart:302. | Handler que lanza → code/py/modular_api/src/modular_api/core/error_response_middleware.py:30, code/py/modular_api/src/modular_api/core/official_plugins.py:264. | — fallo HTTP operacional dedicado. Tests existentes mayoritariamente verifican éxito y spec. | Q6/500 con mismo writer, aunque el éxito sea HTML/YAML/Prometheus. Distinguir fallo **al generar spec durante startup**, que no es una respuesta HTTP (§4). |

Las referencias abreviadas de tests en esta sección se resuelven a los archivos enumerados en §10. Los sufijos ":n" inmediatamente después de una ruta o alias son líneas adicionales del mismo archivo.

Precisiones del inventario:

1. **413 no es una respuesta propia actual garantizada del core TS.** Es el status que genera raw-body y que se pierde al atravesar el fallback. La evidencia de code/ts/modular_api/src/core/modular_api.ts:361 → code/ts/modular_api/src/core/body_parser_error_handler.ts:41 → code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18 importa más que el comentario de body_parser_error_handler.
2. Los errores de body-parser entity.verify.failed/403 y limitación de parámetros urlencoded no están habilitados por express.json() sin opciones; no se inventan como productores activos. verify está desactivado por defecto en code/ts/modular_api/node_modules/body-parser/lib/types/json.js:63. Si una extensión los habilita, queda cubierta por E21–E24 y la futura matriz del parser.
3. No se encontró middleware oficial actual de API key/OAuth/bearer en los directorios de middlewares del core; contienen CORS, que responde 204 a preflight: code/ts/modular_api/src/middlewares/cors.ts:46, code/dart/modular_api/lib/src/middlewares/cors.dart:56, code/py/modular_api/src/modular_api/middlewares/cors.py:58. OAuth es futuro en docs/architecture.md:773. La guía Dart code/dart/modular_api/AGENTS.md:323 describe OAuth; no se usa esa guía desactualizada para afirmar que el productor existe hoy. 401/403/429 se cubren como dominio/plugins, no como auth oficial implementada.
4. Los generadores OpenAPI **documentan** errores; no producen por sí solos una respuesta 400/500 al cliente. El error HTTP de la ruta operacional es E40; el error de generación inicial es local. El contrato documentado actual se analiza en §7.

## 4. Frontera de la garantía: otros errores del ecosistema

### Errores sin respuesta HTTP

| Productor actual | Forma actual y evidencia | Tratamiento propuesto |
| --- | --- | --- |
| Plugin host en registro/startup: duplicados, dependencias/ciclos, slots, rutas/capabilities, validación y registro congelado | PluginHostError/PluginValidationResult, sin status ni media type. code/ts/modular_api/src/core/plugin.ts:254, code/ts/modular_api/src/core/plugin.ts:405, code/ts/modular_api/src/core/plugin.ts:428, code/ts/modular_api/src/core/plugin.ts:444; code/dart/modular_api/lib/src/core/plugin.dart:361, code/dart/modular_api/lib/src/core/plugin.dart:550, code/dart/modular_api/lib/src/core/plugin.dart:632; code/py/modular_api/src/modular_api/core/plugin.py:341, code/py/modular_api/src/modular_api/core/plugin.py:473, code/py/modular_api/src/modular_api/core/plugin.py:245. Tests lifecycle y middleware_slots fijan excepciones/aborto. | Mantener error local tipado; no inventar HTTP 500 ni type URI de respuesta. Si ocurre atendiendo una petición, E22/E21 lo transforma. |
| GraphQL catalog/metadata/SDL/artifacts/compilador y configuración inválida | Diagnósticos, GraphqlArtifactCompileError/LoadError, PluginValidationResult o PluginHostError. code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:199, code/py/modular_api/src/modular_api/graphql/runtime/graphql_runtime_plugin.py:206; code/dart/modular_api/lib/src/graphql/runtime/graphql_runtime_plugin.dart:1191; code/ts/modular_api/src/graphql/runtime/graphql_artifacts.ts:101 y :176. | Diagnósticos de desarrollo siguen locales; startup debe fallar antes de escuchar. Solo una ejecución HTTP existente entra en E34/E35. |
| Construcción OpenAPI o serialización YAML en setup | buildOpenApiSpec y jsonToYaml se llaman durante preparación de startup, code/ts/modular_api/src/core/official_plugins.ts:211; build_openapi_spec en code/py/modular_api/src/modular_api/core/official_plugins.py:114; no hay petición a la cual contestar. | Error local con contexto, bloquea readiness/startup; no fingir endpoint 500. Documentación de errores y generación deben usar el mismo catálogo. |
| Clientes REST/GraphQL: HTTP no-2xx, timeout, transporte, decoding, operación no admitida | ServiceResult.failure/ServiceFailure locales; no emiten respuesta HTTP al llamante. code/ts/modular_api_rest_client/src/restClient.ts:359; code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:352; code/py/modular_api_rest_client/src/modular_api_rest_client/client.py:263; code/ts/modular_api_graphql_client/src/graphqlClient.ts:112. | Consumir y exponer Problem Details tipado cuando se recibe; no inventar status/instance de servidor para timeout local. Si la app propaga ese fallo a su API, debe usar dominio o fallback común. |
| SQL Server/Postgres: DbResult.failure, mal acceso a resultado, requireValue/fallo de adaptador | Sin media type ni status HTTP. code/ts/modular_api_postgres/src/dbClient.ts:205 y :259; code/ts/modular_api_sqlserver/src/dbClient.ts:205; code/dart/modular_api_postgres/lib/src/modular_api_postgres.dart:162 y :205; code/dart/modular_api_sqlserver/lib/src/modular_api_sqlserver.dart:164; contratos Python equivalentes en code/py/modular_api_postgres/src/modular_api_postgres/db_client.py:163 y code/py/modular_api_sqlserver/src/modular_api_sqlserver/db_client.py:166. | No convertir los contratos DB en HTTP. Adaptador explícito puede traducir conflictos/dependencia no disponible; sin traducción, E16/E35 es 500. No exponer mensajes SQL. |
| Fallo de carga de recursos de docs-ui o error del navegador | Promesas rechazadas por link.onerror/script.onerror; code/docs-ui/src/docs-ui.js:64 y :80. | No es un emisor servidor; comprobar presentación de errores en Swagger UI y ejemplos Problem Details. docs-ui conserva versión independiente. |

**Límite físico:** después de enviar headers/bytes no es posible reemplazar atómicamente un éxito parcial por otro documento. TS ya comprueba headersSent en code/ts/modular_api/src/core/unhandled_request_error_handler.ts:7; Python code/py/modular_api/src/modular_api/core/error_response_middleware.py:20 todavía no rastrea http.response.start. Diseñar seguimiento de compromiso en todos los adaptadores: antes de compromiso, Problem Details; después, terminar/abortar según transporte y registrar correlación, sin segundo status ni JSON añadido al stream. HEAD conserva status/headers y no lleva cuerpo. Desconexiones y errores previos al ingreso al host no tienen una respuesta del framework para normalizar.

El transporte HTTP nativo puede rechazar una petición antes de crear Request (línea de petición, headers, socket). Se necesita una frontera de servidor configurable donde la librería permita responder; cuando no hay contexto escribible, la garantía acaba allí. Estos casos no justifican excluir errores ordinarios de router, plugins o salud.

**Extensiones arbitrarias:** un middleware que escribe "success:false" con 200 o envía directamente por socket evita cualquier inferencia fiable de semántica. La nueva API debe exigir señalización tipada de errores, controlar el envío HTTP registrado y prohibir bypasses del contrato en plugins conformes. Buscar la palabra error en cualquier JSON exitoso no es una solución: puede ser dato legítimo.

## 5. Contrato objetivo y catálogo

### Referencia normativa

Se recomienda citar **RFC 9457**, publicado en julio de 2023 y que sustituye expresamente a RFC 7807. Conservar “adopción RFC 7807” como referencia histórica del plan. Ambos comparten type/title/status/detail/instance y application/problem+json; las extensiones propuestas no impiden compatibilidad con lectores de 7807. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html), [RFC 7807, §3](https://www.rfc-editor.org/rfc/rfc7807.html#section-3).

La norma distingue el identificador type, el resumen title y la explicación de la ocurrencia detail; exige concordancia del status declarado con el HTTP, y permite extensiones desconocidas que el cliente ignora. No convierte todos esos miembros en obligatorios. No es una herramienta para exponer debugging interno. [RFC 9457, §3](https://www.rfc-editor.org/rfc/rfc9457.html#section-3), [RFC 9457, §5](https://www.rfc-editor.org/rfc/rfc9457.html#section-5).

**El perfil siguiente es una recomendación propia de modular_api**, más estricto que el mínimo de los RFC; no se atribuyen a IETF sus decisiones particulares.

### Perfil propuesto

| Miembro | Regla del perfil modular_api |
| --- | --- |
| type | Obligatorio; URI absoluta estable del catálogo o about:blank. No construirlo con host/header de la petición. |
| title | Obligatorio; resumen estable del tipo. Inglés canónico inicial para paridad. Nunca un mensaje con identificadores variables. |
| status | Obligatorio; entero 400–599 e idéntico al status HTTP efectivo en el momento de emisión. |
| detail | Obligatorio en el perfil; texto público útil. Para errores inesperados: “An unexpected error occurred.” |
| instance | Obligatorio; URI de ocurrencia opaca, por ejemplo urn:uuid:<UUID-v4>. No necesita endpoint público de consulta. Se propone mejorar el ejemplo del canon que usa solo el path (docs/architecture.md:200). |
| trace_id | Obligatorio en respuestas del host; mismo identificador efectivo que X-Request-ID/logs. Con span válido, trace ID de ese span; sin span, correlación de request existente. No imponer regex de UUID porque el código actual admite W3C y request IDs: code/ts/modular_api/src/core/logger/logging_middleware.ts:69, code/dart/modular_api/lib/src/core/logger/logging_middleware.dart:59, code/py/modular_api/src/modular_api/core/logger/logging_middleware.py:87. |
| code | Opcional; código estable de dominio o subclase, nunca imprescindible para interpretar status. No mantener un error ambiguo que unas veces sea código y otras texto. |
| errors | Opcional, lista de issues tipados para validación. Cada issue: code, detail y location; pointer JSON Pointer cuando hay ubicación estructurada; GraphQL puede usar path/locations. Orden determinista compartido. |
| details | Opcional, contexto público de dominio con esquema registrado. Mantenerlo anidado; no mezclar mapas arbitrarios con los miembros reservados. |
| health | Solo Q10 para chequeos; incluye status textual/checks/version/releaseId seguros. Evita colisión de health.status con status HTTP superior. |
| graphql | Solo errores GraphQL que necesitan preservar resultado parcial; puede incluir data segura. Errors van en el formato común de issues, no se incrusta un segundo sobre de error incompatible. |

Ejemplo genérico:

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

El dominio example.com es solo ilustrativo. **No publicar esas URIs como identidad real del paquete.** Elegir y documentar un namespace público controlado por el proyecto antes de congelar fixtures. La ruta de petición genérica podría ser /api/example, pero no se usa como identificador único de ocurrencia.

Reglas de seguridad y consistencia propuestas:

- Crear contexto de problema antes del parser y conservarlo incluso en rutas excluidas de access logging, sin requerir exporter ni logger. Tomar IDs disponibles de tracing después de su inicialización; generar uno si falta. Validar longitud/caracteres de correlación entrante antes de reflejar headers.
- No incluir query strings, request body, credenciales, stack, rutas del sistema o diagnóstico DB en instance/detail. El detalle nativo de GraphQL y health necesita filtrado adicional frente a lo que se ve hoy (E35/E39).
- Serializer sin throw para valores ya validados; prohibir ciclos/valores no JSON en extensiones; fallback mínimo Q6 si una construcción inválida escapa. Evitar registrar ese fallback mediante el logger que acaba de fallar.
- No cambiar el formato por endpoint ni por Accept. Propuesta: todos los errores del major usan el media type problem+json, incluyendo clientes que envían Accept: application/json. Documentar la política; no devolver legacy por negociación.
- Preservar headers semánticos seguros (Allow, WWW-Authenticate, Retry-After, CORS y correlación) y recalcular Content-Length; no arrastrar Content-Type, encoding o ETag del cuerpo anterior.
- No detectar validación parseando frases. TS/Dart necesitan issues estructurados en sus excepciones y Python una traducción acotada de Pydantic, sin input/ctx que revelen valores privados.
- Propuesta inicial: errores estructurales de entrada agregados y ordenados por ubicación/pointer/code; validate() sigue admitiendo string para no inventar campos. Definir null, opcionales, arrays, anidados y coerción uniformemente. Es ampliación respecto del modelo actual de primer fallo; debe constar como decisión del major.

### Catálogo propuesto de type URIs

Se define **P** como el namespace público estable aprobado, terminado en /problems/. En ejemplos, P = https://api.example.com/problems/. Las expresiones P+suffix siguientes son especificación de construcción, no valores literales a enviar.

| Clave | type y title | Status | Familias |
| --- | --- | --- | --- |
| Q1 | P+invalid-request — Invalid request | 400 | E01/E02 documental/E07/E08/E20 |
| Q2 | P+invalid-json-object — JSON object required | 400 | E03 |
| Q3 | P+validation-error — Validation failed | 400 | E02 campos/E10/E11/E12 entrada/E13 |
| Q4 | P+payload-too-large — Content Too Large | 413 | E04 |
| Q5 | P+unsupported-media-type — Unsupported Media Type | 415 | E05/E06/E07 encoding/E28 |
| Q6 | P+internal-error — Internal Server Error | 500 | E09/E12 interno/E16/E22/E25/E36 interno/E40 |
| Q7 | about:blank — Not Found | 404 | E18; dominio genérico 404 |
| Q8 | about:blank — Method Not Allowed | 405 | E19/E33 método |
| Q9 | about:blank — Unauthorized / Forbidden / Too Many Requests | 401/403/429 respectivamente | E23/E24 cuando solo hay semántica HTTP |
| Q10 | P+service-unavailable — Service unavailable | 503 | E26/E37/E38/E39 |
| Q11 | P+graphql-request-error — Invalid GraphQL request | 400 | E27/E28 envelope/E29/E30/E33 entrada/E34 |
| Q12 | P+graphql-query-limit — GraphQL query limit exceeded | 400 | E31/E32 |
| Q13 | P+graphql-execution-error — GraphQL execution failed | 500 | E35 no controlado |
| Q14 | URI absoluta registrada por dominio, título/status declarados en registro | 4xx/5xx definidos por tipo | E15; fallos tipados de aplicación |
| Q15 | about:blank — frase HTTP del status | 4xx/5xx efectivo | E14/E17/E21/E23/E24/E36 conocidos sin tipo específico |

Las variantes about:blank no son tipos nuevos independientes. Usan la semántica del código HTTP y el título correspondiente. [RFC 9457, §4.2.1](https://www.rfc-editor.org/rfc/rfc9457.html#section-4.2.1).

**Diferencia explícita frente al plan antiguo:** docs/architecture.md:752 propone error → title y errorCode → suffix. Hoy error contiene tanto frases variables (V) como códigos (U); copiarlo literalmente daría títulos inestables o poco legibles. Se recomienda: V.error → detail; U.message → detail; U.error → code; type/title por registro. El registro puede implementar el suffix previsto para códigos conocidos, con escape/colisiones documentados; no generar URIs nuevas a partir de cualquier string. Para código sin registro, about:blank + code hasta que la aplicación declare type/title. Aprobar esta precisión del canon antes de programar.

### Matriz de compatibilidad del mapeo

- No se conserva un sobre legacy con error/message junto al problema como modo alternativo. Las extensiones code/details preservan información útil de dominio, pero el contrato sigue siendo breaking.
- Los clientes deben decidir por type/code/status; el texto de detail puede mejorar sin reinterpretarse como protocolo.
- UseCaseException incorpora type/title según el plan. Su representación de dominio no necesita un request para existir; el **writer HTTP** añade instance/trace_id. Revisar de forma explícita el contrato de toJson/to_json: devolver el fragmento de problema sin contexto es razonable; los tests de serialización deben distinguirlo de una respuesta HTTP completa.
- Validar status de excepciones: hoy no hay guardia uniforme para impedir 2xx/3xx como supuesto error. Propuesta: rechazar configuración inválida y emitir Q6 si se descubre durante petición. Las respuestas exitosas legítimas siguen usando Output.


## 6. Diseño de la frontera común y las incompatibilidades de protocolo

### Arquitectura propuesta

Un único modelo semántico de problema, un catálogo y tres adaptadores de transporte. La implementación puede ser idiomática; el resultado observable debe coincidir (docs/architecture.md:806).

Flujo propuesto:

~~~text
Petición admitida por el host
  → contexto mínimo de correlación + protección final
  → tracing / logging
  → lectura de entrada + clasificación de errores de protocolo
  → middleware registrado / routing / plugin / caso de uso
  → resultado tipado (éxito o problema)
  → validación de respuesta + writer común
  → un solo status, headers y cuerpo
~~~

La protección final no exige reordenar el ciclo de casos de uso. Convive con tracing exterior a logging, como está montado hoy (code/ts/modular_api/src/core/modular_api.ts:340, code/ts/modular_api/src/core/modular_api.ts:349; code/dart/modular_api/lib/src/core/modular_api.dart:228; code/py/modular_api/src/modular_api/core/modular_api.py:293). Debe capturar fallos de esas capas y evitar que el logger recursivamente haga fallar el fallback. La normalización ordinaria ocurre dentro de la observabilidad para que métricas y logs vean el status final. Si falla la propia observabilidad, la entrega de un problema tiene prioridad; no prometer que exista un span/log exitoso para un exporter que falló.

**No basta con un middleware catch(Exception).** E17/E23/E24/E36/E37 no lanzan. Se necesitan escritores tipados y una guardia de salida antes de comprometer headers.

- **TS/Express:** centralizar useCaseHandler, bodyParserErrorHandler, unhandledRequestErrorHandler y buildPluginRouteHandler; fallback normal 404 y resolvedor 405 antes del cierre; clasificador allowlist de errores de body-parser/router. Los middleware registrados por plugins ya capturan promesas en code/ts/modular_api/src/core/plugin.ts:572; api.use monta los custom directamente en code/ts/modular_api/src/core/modular_api.ts:367. Garantizar adaptación de ese último camino y de rechazos nacidos dentro del catch del handler. Un wrapper solo de res.json dejaría res.send/res.end/writeHead/flushHeaders fuera; la frontera debe abarcar todas las vías permitidas o restringir el contrato de extensión.
- **Dart/Shelf:** handlers retornan Response, lo que permite decidir antes del adaptador de red. Normalizar Response de error, incluidos los devueltos por Leto; mantener streaming exitoso. No consumir streams arbitrariamente solo para adivinar si son error; si status ya es 4xx/5xx y no hay problema tipado, usar fallback público, cancelando el cuerpo anterior de forma controlada.
- **Python/ASGI:** configurar handlers para HTTPException y errores de servidor además de la capa normalizadora; observar http.response.start, posponer el compromiso de respuestas de error cuando sea necesario y no enviar dos starts. ExceptionMiddleware maneja 404/405 dentro de Starlette y esos errores no alcanzan el catch actual: code/py/modular_api/src/modular_api/core/modular_api.py:251 y dependencia starlette/applications.py:69. Response nativa y dict de plugins requieren la misma política.
- **Host de plugins:** exponer una capacidad pública para construir problemas y adaptadores de errores conocidos; contratos para status/error vs éxito; validación de OpenAPI en registro; suites conformance obligatorias. Un plugin arbitrario sin contrato no permite garantizar “todos” solamente mediante convenciones.
- **Serialización y dominios:** conservar contextos internos aparte de los campos públicos. No identificar como error del cliente cualquier ValidationError encontrado durante output/execute; clasificar la fase. Las excepciones deliberadamente públicas de dominio mantienen su semántica.

Guardia de salida propuesta: problema tipado válido → serializar; respuesta de error legacy reconocida por adaptador declarado → traducir; respuesta de error arbitraria → problema genérico del status; problema inválido o status inconsistente → Q6/500. Esto evita que un plugin no migrado reintroduzca una segunda representación. La opción de abortar startup por API de plugin incompatible refuerza, pero no sustituye, la guardia en ejecución.

### GraphQL: decisión de producto necesaria, no detalle de serialización

El modelo GraphQL admite resultados con errores y datos parciales; su formato de resultado no es el objeto Problem Details. El borrador GraphQL over HTTP consultado exige representar resultados GraphQL según ese modelo y trata expresamente los resultados parciales. Cambiar todo errors[] a una respuesta Problem Details constituye un **perfil HTTP propio**, incompatible con consumidores que esperan el resultado GraphQL convencional. [GraphQL over HTTP, §6.1](https://http-spec.graphql.org/draft/#sec-Body), [resultados parciales](https://http-spec.graphql.org/draft/#sec-Partial-success).

Para satisfacer el mandato de este trabajo se diseña el perfil estricto:

1. Si no hay errores, mantener resultado de éxito GraphQL.
2. Si hay errores, convertir todos a issues de Problem Details: petición/validación/límites → 400; método no permitido → 405; no listo → 503; ejecución interna inesperada → 500. Los tipos de dominio requieren traducción registrada. La prioridad de un conjunto mixto debe ser determinista.
3. Data parcial, si el equipo decide conservarla, se expone dentro de graphql.data y queda marcada como parcial por el tipo. La aplicación cliente no debe tratarla como éxito completo ni reintentar automáticamente operaciones con posibles efectos. Alternativa estricta: descartarla. Ambas rompen contrato y necesitan una decisión.
4. No afirmar compatibilidad estándar de errores GraphQL tras ese cambio. Migrar simultáneamente los tres runtimes y los tres clientes GraphQL.
5. Si el equipo exige conservar íntegramente el protocolo GraphQL tradicional y a la vez “TODO error top-level Problem Details”, **no hay una solución que cumpla ambos requisitos**. Conforme a la decisión “general o no hacerse”, aplazar la adopción completa. Usar extensions.problem conservando el sobre GraphQL podría ser interoperable, pero no satisface el mandato literal y no se contabiliza como implementación completa.

No se recomienda adoptar un status exótico de éxito parcial como atajo: tampoco convierte el cuerpo en el contrato de errores solicitado. El borrador web es mutable; fijar su revisión si el equipo lo adopta como referencia adicional. El perfil estricto de este documento es una decisión del producto, no un requisito de RFC 9457.

### Salud y operacionales

Propuesta estricta: health pass/warn permanece 200/H; fail se transforma en 503/Problem con health.status="fail". Esto rompe los monitores que leen status textual en la raíz o validan H en fallos, aunque los probes que miran solo el status HTTP conservan su comportamiento. Requiere modificar docs/architecture.md:529 y docs/architecture.md:530 y comunicar la nueva ubicación de checks. No hay excepción oculta para /health.

Los mensajes output de fallo/timeout se sanitizan como en E38/E39; no confundir un check fallido (503/Q10) con una excepción del propio handler/serializador (500/Q6). El requisito existente de exponer mensaje de excepción en output (docs/architecture.md:527) debe precisarse junto a la política pública nueva.

## 7. OpenAPI y documentación consumible

Estado verificado:

- TS buildOpenApiSpec documenta 400/application/json/{error:string}; 500 solo description: code/ts/modular_api/src/openapi/openapi.ts:84, code/ts/modular_api/src/openapi/openapi.ts:95.
- Dart documenta 400/500 con descriptions sin cuerpo: code/dart/modular_api/lib/src/openapi/openapi.dart:212.
- Python igual: code/py/modular_api/src/modular_api/openapi/openapi.py:115.
- La especificación exige al menos éxito/400/500 por operación: docs/architecture.md:653.
- Las rutas de plugins aportan una operación estándar y el merge documenta custom/transport con metadata, no operational por defecto: docs/adr/0003-plugin-routes-first-class-in-openapi-and-metrics.md:39 y :48. Esa metadata opcional no impone aún conformidad de errores.

Diseño propuesto:

1. components.schemas.ProblemDetails, ValidationIssue y extensiones de dominio/GraphQL/health; componentes de responses reutilizables. status requerido e integer 400–599; type/instance URI; additionalProperties permite extensiones controladas por tipo. Definir con JSON Schema válido para **OpenAPI 3.0** actual, no exigir migrar a 3.1 en este cambio: code/ts/modular_api/src/openapi/openapi.ts:103 y docs/roadmap.md:97.
2. 400/500 deben incluir application/problem+json y ejemplos. Agregar 413/415 en operaciones que leen cuerpo y respuestas de dominio declaradas, 401/403/429 cuando corresponda. Utilizar default ProblemDetails para otros errores, preservando toda respuesta exitosa existente. No poner default como sustituto de los mínimos del canon.
3. 404 global, 405/Allow y fallos antes de routing deben documentarse como política del host; una ruta inexistente no puede enumerarse como operación de OpenAPI. Las operaciones conocidas pueden declarar esos responses además de la política.
4. Registrar tipos/status de dominio explícitamente, evitando suponer que el generador puede inspeccionar todos los throws de execute(). La misma declaración alimenta documentación y normalización.
5. Validar o completar las respuestas de error aportadas por plugins. Una operación que declara 4xx con image/*, text/html o legacy JSON es incompatible con el nuevo contrato y debe rechazarse o transformarse de forma declarada antes de freeze. Las respuestas binarias exitosas permanecen soportadas.
6. Documentar GraphQL y health según el perfil acordado, en contrato de transporte/operacionales y, cuando se incluyan en OpenAPI, con el mismo esquema. Metadata ausente de un plugin público debe producir error de validación de conformidad o exigir declaración documentada; no una omisión silenciosa de su contrato.
7. Mantener /openapi.json exitoso como application/json, YAML como application/x-yaml, /docs HTML y /metrics Prometheus. **Solo sus fallos** usan Problem Details. No cambiar el media type del documento OpenAPI por contener esquemas de errores.
8. QA de Swagger/docs-ui: muestran type/detail/trace_id, ejemplos y nuevos headers; comprobar que la UI no depende de response.error. Su propio código inspeccionado carga Swagger UI (code/docs-ui/src/docs-ui.js:64 y :80), por lo que no hay evidencia de que precise un breaking propio; validarlo con pruebas. Sí hay un ejemplo legacy explícito que actualizar: code/docs-ui/public/sample-spec.json:43 y :49 documenta 400 con error:string y application/json.

## 8. Clientes, versionado y transición

### Consumidores del ecosistema

Los tres clientes REST convierten una respuesta no-2xx en ServiceFailure usando status y el **texto completo** en message/details, antes del decode de éxito. Cambiar el servidor no les hace exponer automáticamente un problema tipado: code/ts/modular_api_rest_client/src/restClient.ts:359, code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:352, code/py/modular_api_rest_client/src/modular_api_rest_client/client.py:263.

Recomendación: añadir un modelo ProblemDetails de consumo y property problem opcional a ServiceFailure; parsear media type con parámetros; usar status de transporte para clasificación, conservar discrepancias para diagnóstico y exponer trace_id/instance. Para servidores ajenos o versiones antiguas mantener recepción tolerante de texto/JSON legacy. **Compatibilidad de lectura no equivale a emisión mixta del framework.** Puede prepararse antes del major como API aditiva si no cambia message/details existentes; cambiar esos campos sí debe comunicarse.

Los clientes GraphQL TS/Dart delegan al REST client, mientras Python implementa su transporte: code/ts/modular_api_graphql_client/src/graphqlClient.ts:124, code/dart/modular_api_graphql_client/lib/src/modular_api_graphql_client.dart:123, code/py/modular_api_graphql_client/src/modular_api_graphql_client/client.py:245. Hoy conservan errors[] en un resultado exitoso, probado en code/ts/modular_api_graphql_client/test/graphqlClient.test.ts:78, code/dart/modular_api_graphql_client/test/graphql_client_test.dart:70, code/py/modular_api_graphql_client/tests/test_graphql_client.py:87.

El perfil estricto requiere distinguir fallo HTTP con problema vs éxito GraphQL, preservar issues/partial data si se acuerdan y no aplicar automáticamente retryable=true a cualquier Q13/500. Los clientes actuales marcan 429 y 5xx como retryable, por ejemplo code/dart/modular_api_rest_client/lib/src/modular_api_rest_client.dart:490; la aplicación debe tener en cuenta idempotencia. Una evolución del cliente puede seguir leyendo GraphQL convencional de terceros; no es necesario borrar esos tests de interoperabilidad, sí agregar variantes del nuevo servidor.

DB/SQL no necesitan cambiar su error local por este contrato HTTP. Sus constraints, ejemplos, adaptadores y pruebas de integración sí necesitan comprobar compatibilidad con el core nuevo. Si un paquete cambia APIs propias, su impacto se versiona explícitamente.

### ADR-0002 frente a ADR-0006

**Política vigente:** ADR-0002 Accepted cubre quince paquetes y publicaciones coordinadas; ADR-0006 permanece Proposed y condiciona su efecto a aceptación y workflows. No está permitido interpretarlo como vigente por ser más reciente. docs/adr/0002-synchronized-versioning-across-sdks.md:9, :27, :41; docs/adr/0006-per-project-versioning-across-the-three-sdks.md:7 y :9. El archivo .github/workflows/release.yml:3 todavía describe la publicación de quince paquetes y su guardia de versiones en la línea 45.

Consecuencia para esta migración:

- **Con política actual:** major común en los quince manifests, con cambio real de los tres cores y trabajo coordinado en clientes; satellites sin cambio funcional reciben bump de paridad. Los tres SDKs del core deben tener la misma versión y mismo formato. No alcanza un bump sin implementación en D/P.
- **Si ADR-0006 se acepta e implementa antes:** core TS/Dart/Python publica un major compartido; REST client y GraphQL client tienen sus respectivas versiones comunes por proyecto y salen en una ventana coordinada de compatibilidad. No necesitan todos el mismo número que el core. SQLServer/Postgres solo cambian cuando constraints o APIs lo requieren, cada proyecto alineado en tres lenguajes. docs/adr/0006-per-project-versioning-across-the-three-sdks.md:54 y :81.
- El cambio de política de releases no es un prerrequisito técnico de Problem Details: se puede hacer correctamente con ADR-0002. No mezclar ambos proyectos por comodidad.
- El valor siguiente no está decidido. Desde 0.7.0, un major numérico sería 1.0.0; el roadmap también asocia 1.0.0 con estabilidad/LTS (docs/roadmap.md:15). Resolver si se cumplen esos criterios o si se enmienda explícitamente la política pre-1.0. No llamar “minor no-breaking” a un contrato que rompe clientes ni inventar una versión ya aprobada.

### Estrategia recomendada: major limpio

**Recomendación: major limpio, sin flag de emisión legacy por endpoint.** Un feature flag aplicado solo al parser o a UseCaseException viola directamente el requisito. Un flag global, aplicado a todas las familias en los tres SDKs, podría servir en pruebas/preview; no es la arquitectura final y duplica temporalmente la matriz de pruebas.

Si el equipo necesita ese preview, el flag debe ser global e inmutable al arrancar, con default y fecha de retirada iguales en los tres SDKs. No mezclar formatos según Accept, tipo de error, plugin o lenguaje. No declararlo adopción terminada hasta eliminar el modo legacy de la nueva línea. El lector tolerante del cliente puede seguir existiendo para servicios externos.

Coordinación operativa propuesta (diseño, sin ejecutarla):

1. Un ADR de errores, esquema/fixtures compartidos y matriz de compatibilidad server/client/SDK.
2. Clientes capaces de leer problemas y documentación preliminar antes de que los servidores emitan el nuevo formato.
3. Un único candidato de release con **todos los productores de los tres runtimes** conformes; gates incluyen clientes y paquetes afectados.
4. Publicación en una sola ventana. npm/pub.dev/PyPI no forman una transacción atómica: preparar los tres, ejecutar el proceso coordinado e idempotente, verificar disponibilidad de todos y solo entonces anunciar compatibilidad general. Ante fallo parcial, no recomendar actualización unilateral; completar el conjunto o retirar la recomendación del candidato.
5. Las aplicaciones consumidoras pueden actualizarse escalonadamente con clientes compatibles; no confundir eso con permitir dos formatos dentro del mismo servidor nuevo. Rollback de una aplicación debe volver a una versión completa anterior, no activar un parche aislado del error de tamaño.
6. Validar constraints cruzados; igualar version fields no evita dependencias incompatibles. Ese defecto está descrito en docs/adr/0006-per-project-versioning-across-the-three-sdks.md:39.

Changelog/comunicación: marcar BREAKING en los tres cores y en cada cliente cuyo resultado/API cambie. Incluir tablas V/U/GErr/HF → Problem, nuevos status de JSON inválido y size, 404/405, política GraphQL y partial data, health.status anidado, media type, tipo/trace IDs, APIs de plugins, catálogo de URIs, examples genéricos y guía para consumidores que hacen response.error o response.message. Explicar separadamente ajustes de status, cambios de mensajes y nuevo formato; no atribuirlos todos al RFC.

## 9. Body limit y 413 como caso del contrato general

La cadena TS actual es express.json() sin opciones (code/ts/modular_api/src/core/modular_api.ts:361), default 100kb de la dependencia (code/ts/modular_api/node_modules/body-parser/lib/types/json.js:56), entity.too.large/413 de raw-body (code/ts/modular_api/node_modules/raw-body/index.js:162) y fallback 500 (code/ts/modular_api/src/core/unhandled_request_error_handler.ts:18). El inventario E04 registra el comportamiento resultante, no solo el status de la dependencia.

En la adopción completa, entity.too.large debe convertirse en Q4/413 con exactamente el mismo writer/media type/correlación que E01, E13, E15 y el resto. Medir y documentar si el límite aplica a bytes recibidos o descomprimidos; en TS actual el reader utiliza stream de descompresión antes de aplicar lectura/limit (code/ts/modular_api/node_modules/body-parser/lib/read.js:54 y :165). Definir la misma semántica cuando se implemente en Dart/Python.

**Cambio separado:** añadir jsonBodyLimit opcional en TS, con default existente y pass-through a express.json({limit:...}), puede publicarse antes como capacidad aditiva no-breaking. No requiere cambiar el cuerpo de errores y no constituye adopción RFC parcial. Bajo ADR-0002 esa release igualmente conserva la disciplina de versiones. Si se introduce además un límite nuevo por defecto en D/P o se reduce el existente, ya se restringen peticiones antes aceptadas: evaluarlo por separado; la compatibilidad de una opción TS aditiva no prueba que imponer un límite a todo el ecosistema sea no-breaking.

Casos de diseño para 413: límite exacto y +1 byte; Content-Length conocido y chunked; texto multibyte; cuerpo comprimido; requests sin header de longitud; bypass de parser por media type; parser aplicado antes del match de ruta en TS. Determinar precedencia: ¿413/415 antes de 404 si el cuerpo inválido llega a ruta inexistente? Recomendación: validación de transporte antes de routing cuando el host procesa ese cuerpo, misma política en los tres. No limitar solo los DTO handlers dejando GraphQL o plugins al margen; los transportes binarios pueden declarar su política de admisión propia y compartir la misma representación de rechazo.


## 10. Dimensión de tests y estrategia TDD

### Recuento estático reproducible de contratos afectados

**Base de trabajo identificada: 52 casos de test existentes en 15 archivos** (TS 16, Dart 19, Python 17), más **4 escenarios de paridad** de un script común. De los 52, 51 tienen aserciones positivas del cuerpo/campo/status que el perfil modifica; el restante es una aserción negativa Dart sobre error que conviene sustituir porque podría seguir pasando aun desapareciendo el campo. Es un inventario de adaptación por inspección, **no un resultado de ejecución ni un total cerrado de todos los tests futuros**.

Se cuenta cada declaración it/test/def test una vez, no cada expect/assert ni cada request dentro del mismo test. Los cuatro escenarios de paridad se ejecutan para tres SDKs (12 ejecuciones por escenario-lenguaje en conjunto) y tienen comparaciones cruzadas adicionales. No se suman los tests de drivers, startup, logs o serialización exitosa solo por contener la palabra error.

| SDK / archivo | Casos seleccionados, por línea de declaración | Nº | Qué cambia |
| --- | --- | --- | --- |
| code/ts/modular_api/test/handler/body_parser_error.test.ts | 50 | 1 | Igualdad de cuerpo JSON malformado. |
| code/ts/modular_api/test/handler/handler_pre_validation.test.ts | 88, 97, 106, 115, 124, 133, 151 | 7 | Acceso a res.body.error y detalles de validación. |
| code/ts/modular_api/test/plugin_host/plugin_host.guardrails.test.ts | 14, 52 | 2 | Igualdad del sobre en short-circuit y excepción exterior. |
| code/ts/modular_api/test/graphql/graphql_runtime_execution.test.ts | 127, 147, 217, 237, 257 | 5 | Status 200 con errors y extensiones actuales. |
| code/ts/modular_api/test/health/health_handler.test.ts | 64 | 1 | status textual fail en raíz. |
| code/dart/modular_api/test/use_case_exception_test.dart | 20, 34, 49 | 3 | Serialización error/message/details/default. |
| code/dart/modular_api/test/handler/handler_pre_validation_test.dart | 129, 145, 159, 173, 187, 201, 233, 254 | 8 | Campos error; línea 233 es refuerzo de aserción negativa, no fallo inevitable. |
| code/dart/modular_api/test/plugin_host/plugin_host_guardrails_test.dart | 13, 63 | 2 | Igualdad del cuerpo antiguo. |
| code/dart/modular_api/test/graphql/graphql_runtime_execution_test.dart | 144, 168, 257, 283, 307 | 5 | Resultado de error GraphQL. |
| code/dart/modular_api/test/health/health_handler_test.dart | 68 | 1 | body.status pasa a health.status. |
| code/py/modular_api/tests/test_usecase_handler.py | 127, 135, 144, 160 | 4 | Validación, excepción de dominio, inesperada y body no objeto. |
| code/py/modular_api/tests/test_fromjson_validation.py | 96, 103, 110 | 3 | HTTP de errores Pydantic con error. |
| code/py/modular_api/tests/test_use_case_exception.py | 23, 34, 46 | 3 | Serialización actual/default. |
| code/py/modular_api/tests/plugin_host/test_plugin_host_guardrails.py | 29, 70 | 2 | Short-circuit y 500 exterior. |
| code/py/modular_api/tests/graphql/test_graphql_runtime_execution.py | 133, 152, 222, 241, 260 | 5 | Status/envelope/extensiones de error GraphQL. |
| **Total casos / archivos** | **16 TS + 19 D + 17 P** | **52 / 15** | **Mínimo localizado de adaptación/refuerzo.** |
| code/tests/integration_test/parity_test.ps1 | Aserciones de escenarios: 406, 434, 462, 546; comparaciones: 773, 784, 795, 821 | **4 escenarios** | Cambiar error por tipo/status/detail/issues y comparar contrato entero. |

Para verificación archivo:línea inequívoca, ejemplos de anclas del recuento: code/ts/modular_api/test/handler/handler_pre_validation.test.ts:88; code/dart/modular_api/test/graphql/graphql_runtime_execution_test.dart:144; code/py/modular_api/tests/graphql/test_graphql_runtime_execution.py:133. Las demás líneas de cada fila pertenecen al mismo archivo indicado.

**Trabajo adicional fuera de esos 52:**

- Reforzar tests que solo comprueban status/logs: handler_logger en TS/Dart y bloque de logging en code/py/modular_api/tests/test_usecase_handler.py:237; health Python en code/py/modular_api/tests/health/test_health_handler.py:52; routing en official_plugins_basepath y graphql_runtime_integration. No requieren necesariamente cambiar una aserción existente, pero deben demostrar nuevo cuerpo/header.
- Ampliar las tres suites OpenAPI y las tres de contribuciones de plugins. El test Python code/py/modular_api/tests/openapi/test_openapi_spec.py:173 solo exige presencia de 200/400/500; puede pasar aunque falte Problem Details. No contarlo como prueba actual de schema de error.
- Ampliar seis suites de clientes: httpClient/http_client y graphqlClient/graphql_client en los tres lenguajes. Tests de 401/texto externo pueden seguir siendo válidos; agregar respuestas de nuestro nuevo servidor. Los tres tests de preservación GraphQL tradicional se mantienen si se promete interoperar con terceros.
- Mantener pruebas unitarias fromjson/schema para errores locales y agregar tests de issues. Cambiar textos o reglas de coerción aumenta el alcance; no contar automáticamente toda validación local como rotura HTTP.
- Incorporar ausencia de regressions en logging/tracing/metrics: mismo trace_id, exactamente una finalización, status final, contadores correctos. Los tests actuales de logs que contienen error no son por eso contratos de cuerpo HTTP.
- El test TS code/ts/modular_api/test/handler/body_parser_error.test.ts:99 usa un **fallback de prueba propio** que emite {error:"fallback handler"}; no demuestra el fallback de ModularApi y no se contó entre los productores ni entre las 51 roturas positivas.

### TDD propuesto para cubrir TODOS los productores

**Primero rojo:**

1. Crear fixtures JSON independientes del lenguaje con un identificador E01…E40, variante, precondiciones, status, media, tipo, título, headers y esquema de body esperados. Fixtures genéricos: /api/example y datos sin referencias a aplicaciones reales.
2. Tests unitarios del modelo y catálogo: default, extensiones desconocidas, código registrado/no registrado, campos reservados, status inválido, serialización segura y mensajes redactados. El fragmento de UseCaseException y la respuesta HTTP completa se prueban por separado.
3. Tests de integración usando **ModularApi real**, no solo handlers aislados. Construir equivalentes en tres SDKs con plugins y executors falsos. Forzar cada rama del inventario, incluso error fuera del handler.
4. Convertir a rojo los 52 casos identificados para exigir el nuevo contrato; mantener los asserts de que factory/execute no se llaman cuando falla entrada.
5. Añadir una aserción universal de respuesta de error: media base problem+json, JSON objeto, campos requeridos y tipos, status HTTP=body.status, URI de type/instance, catálogo correcto, trace_id/header coherentes, sin campos legacy reservados en raíz ni información interna.
6. No usar “tiene status >=400” como detector único del error bajo prueba: marcar expresamente casos GraphQL con errors dentro de 200 para que el test inicial **falle**. Igual para Output o plugins que intentan devolver errores como éxito.
7. Probar también respuestas directamente retornadas: vacía/texto/binario/JSON/Response nativa/error tipado, en todos los slots de middleware; antes y después de parser/routing. En TS incluir res.send/res.end y callbacks async; en ASGI body multipart y compromiso de respuesta; en Shelf Response/stream.
8. Probar conformidad del spec generado con respuestas efectivas. Resolver cada $ref y revisar application/problem+json en 400/500 y restantes errores declarados, incluidos plugins.

**Luego verde, por capas pero sin publicación parcial:**

- Implementar modelo, clasificadores, writer, frontera de router/handler y salida de plugins.
- Incorporar GraphQL/health y clientes como parte del mismo candidato.
- Agregar guardia de emergencia de serialización y controlar errores después de compromiso.
- Completar OpenAPI y los tests de paridad antes de permitir release.

**Matriz negativa mínima que hoy falta:**

| Área | Variantes necesarias |
| --- | --- |
| Parser/413 | E01–E09; cero bytes vs {}, null/array/string/número; límite exacto/+1; chunked/comprimido/charset; error antes de match; abortado sin inventar body. |
| Entrada | Required/null/opcional incorrecto; string/integer/number/boolean/array/object; nested y JSON Pointer con / y ~; validación múltiple con orden; query/path; GET/DELETE (Dart hoy usa body para DELETE, code/dart/modular_api/lib/src/core/usecase/usecase_http_handler.dart:25). |
| Dominio/output | Cada status registrado; errorCode vacío/ausente; details con claves reservadas/datos no JSON/ciclos; error en getter/toJson; Output 4xx/5xx y status inválido. |
| Routing/HTTP | 404 dentro/fuera de basePath; 405 con Allow; URI inválida; HTTPException nativa; HEAD sin cuerpo; OPTIONS/CORS preservado; Accept application/json, problem+json, */* y ausente. |
| Plugins/host | Throw sync, reject async, short-circuit en cada slot/custom; Response ya construida; fallo de header/serializador; intento de escribir legacy; logger/exporter que falla; routes excluidas del log. |
| GraphQL | JSON/envelope/query inválidos; documento inválido; schema/variables/operationName; introspección; límites; validación resolver; executor que lanza; errores múltiples, data parcial y batch según decisión; respuesta nativa de Leto 400/405/500. |
| Operacionales | Health fail/timeout/throw; fallo real del servicio/serializador; docs/OpenAPI/metrics fallan antes y después de iniciar salida; startup sin HTTP. |
| Clientes | Problem válido/con parámetros; extensiones nuevas; error status discordante; cuerpo truncado o no JSON; generic fallback; legacy de servidor externo; GraphQL parcial; no inventar problema remoto para timeout local. |
| Paridad | Mismos inputs y configuración; comparar objetos completos normalizando solo instance/trace_id/timestamps/duración; **no** normalizar type/status/detail/códigos para esconder divergencias. |

**Control de exhaustividad:** un manifest de productores obliga a que cada ID y variante tenga tests en los tres SDKs o N/E documentado solo para una particularidad física del transporte. Hacer que CI rechace un productor nuevo sin fixture y detecte nuevas escrituras de error fuera del writer. Un rg/lint de status/json ayuda a descubrirlas, pero no sustituye tests de semántica ni detecta por sí solo todo HTTP dinámico.

La cobertura universal debe ser parte del contrato del plugin público. Si se permiten bypasses de transporte, no afirmar garantía absoluta para ellos. Las pruebas de headers ya enviados deben demostrar que se evita un segundo envío; no pedir una respuesta Problem imposible.

### Criterio de terminado

Adopción terminada solo cuando todos los errores emitibles antes del compromiso de respuesta usan el perfil; las tres implementaciones y clientes afectados pasan la misma suite; GraphQL y health tienen contrato aprobado y cubierto; OpenAPI coincide; no hay flag legacy en la línea nueva; el candidato de release está completo en los tres SDKs. Ningún test “verde” solo por conservar error/message cumple ese criterio.

## 11. Decisiones abiertas, con recomendación

| Decisión para el equipo | Recomendación | Consecuencia si se pospone |
| --- | --- | --- |
| RFC normativo | Adoptar 9457; mencionar 7807 como antecedente compatible; corregir §4.5/§12 y referencias. | Documentación normativa obsoleta aunque el JSON funcione. |
| GraphQL estándar vs requisito literal | Si prevalece el mandato recibido, aprobar explícitamente perfil HTTP propio con Problem Details para todos los errores y migrar clientes. Si no se acepta ese coste, no adoptar parcialmente. | Bloquea el diseño final del contrato general. |
| Data parcial GraphQL/batch/raw/multipart Dart | Conservar data parcial segura dentro de graphql, nunca éxito implícito; comenzar con petición única JSON común y documentar la retirada de extensiones no paritarias. | No hay traducción determinista ni compromiso claro de compatibilidad. |
| Salud 503/H | Aprobar 503/Problem + health; adaptar monitores; enmendar canon de salud. | Mantener H en fallo contradiría “TODO error”. |
| URI namespace y tipos de dominio | Dominio público estable controlado; catálogo de tipos/versionado semántico independiente del número de paquete; about:blank para HTTP genérico. | No congelar type URIs provisionales; cambiarlas luego rompe identidad. |
| errorCode/title/details | Registro explícito; code preservado; detail público; details anidado con esquema. | No se puede trasladar correctamente la ambigüedad del error actual. |
| Validación | Mantener 400; issues estructurados y ordenados; acordar null/opcionales/coerción/primer fallo vs agregación. | Cuerpos pueden seguir divergentes aunque compartan media type. |
| instance y correlación | URN de ocurrencia; trace_id coherente con mecanismo actual incluso sin access log; validación de header entrante. | Riesgo de usar path como falsa identidad o de romper W3C/UUID/request ID. |
| Frontera de extensión/streaming | Writers tipados y guardia previa a envío; prohibir bypass de errores en plugins conformes; delimitar compromiso de respuesta. | Un middleware puede reintroducir legacy sin que lo capture un catch. |
| Status nuevos y precedencia | Aprobar explícitamente parser 400/413/415 y método 405; errores de transporte antes de routing con política idéntica. | Se cambia más que la forma del body sin contrato de status definido. |
| Versionado efectivo y salida | ADR-0002 mientras siga vigente; major limpio; resolver la relación con 1.0/LTS; release coordinada, constraints verificadas. | Una release parcial o tratada como minor incumple el mandato y roadmap. |
| Preview/flag | Evitar flag de producción; si imprescindible, global para todos los productores y con retirada coordinada. | La matriz se duplica y “adopción completa” queda pendiente. |
| jsonBodyLimit | Trabajo aditivo separado con default intacto; definir límites cross-SDK en otro alcance explícito. | Riesgo de mezclar ampliación de capacidad con rotura de errores. |

Son decisiones del equipo para la siguiente fase, no solicitudes de permiso para escribir código en esta tarea.

## 12. Secuencia de implementación propuesta

1. **Cerrar el contrato en un ADR nuevo.** Precisar RFC 9457, alcance estricto, GraphQL/health, type namespace, status, issues, seguridad y límites físicos. Corregir inconsistencias documentales detectadas. Salida: contrato revisable y catálogo cerrado.
2. **Preparar fixtures y tests rojos en los tres SDKs.** Materializar E01–E40 y variantes; reescribir tests afectados; ampliar tests de clientes/OpenAPI. Salida: incumplimientos visibles, sin publicar cambios parciales.
3. **Preparar consumidores tolerantes.** Añadir lectura ProblemDetails a clientes REST/GraphQL y guide de migración. Puede anteceder al servidor si es aditivo y sigue política de releases vigente.
4. **Crear modelo común y adapters nativos.** Error de dominio y fragmento de problema separados de contexto HTTP; un writer por SDK con mismas reglas y catálogo.
5. **Migrar admisión y lifecycle REST completos.** Parser/tamaño/media/URI; DTO; validate; excepciones controladas/no controladas; output de error; serialización; 404/405 y headers.
6. **Migrar host de plugins y barrera exterior.** Respuestas directas, middleware, async, HTTPException, fallo de logger, streams y emergencia del writer. Ninguna salida HTTP de error permitida debe evitarlo.
7. **Migrar GraphQL y health como parte del mismo trabajo.** Errores de motor y respuestas nativas, partial data, status y mensajes seguros; health fail/timeout/excepción; casos negativos operacionales.
8. **Alinear OpenAPI, documentación y clientes.** Components/responses, contribuciones de plugin, metadata de dominio, ejemplos y changelogs completos; compatibilidad de los cinco proyectos.
9. **Gate de conformidad ecosistémica.** TDD verde en tres SDKs, matriz de paridad de objetos completos, tests de consumidores y salida no duplicada. Auditar de nuevo productores y todo status de error directo.
10. **Preparar major coordinado.** Versión bajo ADR vigente, constraints, notas breaking y plan de publicación/reintento. Verificar los tres paquetes de cada proyecto afectado antes del anuncio.
11. **Publicar y comunicar el conjunto completo en la fase autorizada de implementación.** Este documento no ejecuta esa fase. No liberar solo 413 ni un SDK adelantado como adopción RFC terminada.

La opción jsonBodyLimit puede desarrollarse y liberarse antes de estos pasos como cambio independiente de capacidad, con política de versiones aplicable y sin alterar el formato de errores. No elimina ninguna tarea de esta secuencia.

## 13. Evidencia y límites de esta revisión

- Revisión estática de las tres implementaciones actuales, quince paquetes, docs-ui, canon, ADRs y pruebas. Fuentes externas verificadas: RFC Editor para 7807/9457 y borrador oficial GraphQL over HTTP.
- Dependencias locales utilizadas para seguir errores delegados: body-parser/raw-body/Express/finalhandler en code/ts/modular_api/node_modules; Starlette en code/py/modular_api/.venv/Lib/site-packages; Shelf 1.4.2, shelf_router 1.1.4 y leto_shelf 0.0.1-dev.2 del caché de paquetes indicado por code/dart/modular_api/.dart_tool/package_config.json.
- Las formas de esas dependencias son evidencia de lo instalado, no promesa de todas las versiones admitidas por rangos abiertos. La implementación deberá fijar fixtures de transporte en CI; no basar garantías futuras en defaults no controlados.
- No se afirma que 52 sea el número final de tests a modificar: es la base nominativa identificada. Hay cobertura a añadir/reforzar, escenarios con múltiples requests y dependencias de decisiones abiertas. No se ha ejecutado ninguna prueba para estimar “cuántas fallan”.
- No se inspeccionó tráfico, despliegues ni aplicaciones consumidoras. “Contrato consumido” aquí significa público y fijado por tests; la evidencia no permite contar clientes reales.
- Única salida escrita por esta tarea: este archivo de análisis.
