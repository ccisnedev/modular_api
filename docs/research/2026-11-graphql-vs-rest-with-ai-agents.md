# GraphQL frente a REST en un framework de APIs cuando agentes de IA escriben casi todo el código

## Abstract

Se investiga si las ventajas clásicas de GraphQL sobre REST siguen siendo relevantes para `modular_api` cuando agentes de IA escriben más del 99 % del código y crear un endpoint cuesta casi cero. Se aplicó un protocolo de cinco etapas sobre fuentes primarias (OWASP, graphql.org, documentación de MCP y de Anthropic), encuestas (Postman) y ensayos de practicantes, con sesgo de proveedor explicitado (Apollo, WunderGraph, ChilliCream, Hasura). Conclusiones principales: (1) la ventaja de "autonomía del frontend" pierde casi todo su peso cuando el costo marginal de un endpoint tiende a cero, aunque no desaparece del todo (el costo que queda es de revisión, contrato y mantenimiento, no de escritura); (2) las ventajas que sobreviven son el contrato tipado con introspección y la evolución de esquema por campo, y ambas se pueden obtener con OpenAPI más codegen a menor superficie de ataque; (3) los costos de GraphQL (DoS por consultas, autorización por campo, N+1) no bajan con IA y aumentan si el esquema se genera directo desde tablas; (4) para agentes como consumidores, la evidencia disponible es débil y mayormente de proveedores; la guía de Anthropic favorece herramientas pequeñas orientadas a tareas, no envolturas de la API completa; (5) recomendación: congelar el runtime GraphQL en el core (sin inversión nueva), con un plan de extracción a paquete opcional si aparece un consumidor real. Confianza global: media.

## Research Question

¿Qué ventajas reales tiene GraphQL frente a REST para un framework de APIs, y siguen siendo ventajas cuando agentes de IA escriben más del 99 % del código (un agente puede crear un endpoint REST o caso de uso nuevo a costo casi cero)?

Subpreguntas: (a) ventajas clásicas; (b) costos, en particular GraphQL autogenerado sobre tablas frente a casos de uso de dominio; (c) evidencia de industria 2023-2026; (d) ángulo de agentes de IA; (e) recomendación para un fundador individual.

## Scope and Constraints

- Contexto: `modular_api` (Dart, TypeScript, Python), casos de uso REST con DTOs tipados y OpenAPI automático, más un runtime GraphQL opcional de solo lectura generado desde un catálogo (SQL Server y PostgreSQL), con límites de profundidad, complejidad y paginación e introspección desactivada por defecto. Hoy el runtime GraphQL tiene un solo consumidor, `tigre_regalon_2`, sin actividad desde junio de 2026 y fijado en la versión 0.4.8; el consumidor en producción (`socia`) no lo usa. Clientes empresariales del sector financiero en Perú.
- Dentro del alcance: ventajas y costos generales de GraphQL, evidencia 2023-2026, uso por agentes de IA, decisión de producto.
- Fuera de alcance: rendimiento medido del runtime propio, benchmarks propios, revisión del código del repositorio, comparación detallada de librerías de servidor GraphQL, suscripciones y mutaciones (el runtime es de solo lectura).
- Restricciones: investigación solo web, fecha de corte 2026-11-28. Las afirmaciones se atribuyen a la fuente; los hechos se separan de las interpretaciones. Los datos de la propia empresa del fundador no se enviaron a servicios externos.
- Criterios de éxito de la investigación: cada conclusión con evidencia atribuida, sesgos de proveedor señalados, nivel de confianza por conclusión y criterios explícitos que cambiarían la decisión.

## Method (Staged Protocol)

Se siguió el protocolo en orden: Etapa 1 encuadre del problema; Etapa 2 descubrimiento de fuentes diversas (especificaciones y documentación oficial, OWASP, encuestas, ensayos de practicantes, blogs de proveedores); Etapa 3 triaje con puntuación de relevancia, credibilidad, recencia y tipo de evidencia; Etapa 4 extracción de afirmaciones con atribución, separando hecho de interpretación; Etapa 5 síntesis, acuerdos y conflictos, confianza y límites. Se usaron búsquedas web y recuperación de páginas; varias páginas se leyeron completas y otras solo por resultados de búsqueda (se marca en Limitations). Las citas textuales se limitan a menos de 15 palabras.

## Findings by Stage

### Stage 1 - Problem Framing

**Pregunta normalizada.** El valor de GraphQL como superficie de lectura en un framework de APIs, evaluado cuando (i) el costo de escribir y mantener un endpoint nuevo es casi cero y (ii) los consumidores pueden ser humanos (frontends) o agentes (MCP, tool use).

**Racional declarado del fundador.** (1) GraphQL da orden y estructura; (2) el frontend puede evolucionar sus lecturas sin cambios permanentes en el backend. El punto (2) es la hipótesis bajo prueba.

**Hipótesis operativas.**
- H1: la autonomía del frontend es la ventaja más dependiente del costo humano de escribir endpoints y se erosiona con agentes.
- H2: los costos de seguridad y operación de GraphQL son independientes de quién escribe el código.
- H3: un esquema tipado e introspectable es útil a agentes, pero la forma óptima para agentes son herramientas estrechas por tarea.
- H4: sin consumidor real, mantener el runtime en el core es costo sin retorno.

**Éxito.** Respuestas con evidencia, sesgos explícitos y criterios de reversión de la decisión.

### Stage 2 - Source Discovery

Se identificaron las siguientes fuentes (clave, tipo, autor, fecha):

| Clave | Título | Tipo | Autor/Organización | Fecha |
|---|---|---|---|---|
| owaspgqlcheat | GraphQL Cheat Sheet | Guía de seguridad | OWASP Cheat Sheet Series | vigente (sin fecha en la página) |
| owaspwstggql | Testing GraphQL (WSTG) | Guía de pruebas | OWASP | vigente (solo vía resultado de búsqueda) |
| owaspapi2023bopla | API3:2023 Broken Object Property Level Authorization | Estándar de riesgos | OWASP API Security | 2023 |
| graphqlorgsecurity | GraphQL Security | Documentación oficial | GraphQL Foundation | vigente |
| graphqlorgbp | GraphQL Best Practices | Documentación oficial | GraphQL Foundation | vigente |
| bessey2024over | Why, after 6 years, I'm over GraphQL | Ensayo de practicante | Matt Bessey | 2024-05-24 |
| willison2024 | Link blog sobre el ensayo de Bessey | Comentario | Simon Willison | 2024-05-30 (solo vía búsqueda) |
| wundergraph2024wrong | I was wrong about GraphQL | Ensayo de proveedor | Jens Neuse (WunderGraph) | 2024-12-03, act. 2026-05 |
| brandur2018graphql | Why GraphQL (con actualización 2025) | Ensayo de practicante | Brandur Leach | 2018-06-08, act. 2025-08-03 |
| postman2025 | 2025 State of the API Report | Encuesta | Postman | 2025-10 |
| postman2023 | State of the API 2023 | Encuesta | Postman | 2023 (solo cifra vía búsqueda) |
| anthropic2025tools | Writing effective tools for agents | Guía de ingeniería | Ken Aizawa y colegas, Anthropic | 2025-09-11 |
| mcpspec | MCP specification, Tools | Especificación | Model Context Protocol | versiones 2025-06-18 a 2026-07-28 (solo vía búsqueda) |
| apollo2025ops | Every Token Counts: efficient AI agents with GraphQL and Apollo MCP Server | Blog de proveedor | Matt Hawkins (Apollo) | 2025-06-24 |
| apollo2025schema | Smart schema discovery in Apollo MCP Server | Blog de proveedor | Dale Seo (Apollo) | 2025-09-17 |
| apollocomm2025 | Large Tool Contexts from Apollo MCP Server? | Foro de comunidad | Usuario anónimo | s/f (solo vía búsqueda) |
| chillicream2026 | Semantic Introspection | Blog de proveedor | Pascal Senn (ChilliCream) | 2026-04-22 |
| wundergraph2026agents | GraphQL Is the API Layer AI Agents Actually Need | Blog de proveedor | Jens Neuse (WunderGraph) | 2026-03-20, act. 2026-09 |
| thoughtworks2025radar | GraphQL as data access pattern for LLMs | Radar tecnológico (Assess) | Thoughtworks | 2025-11-05 |
| hasuradocs | Hasura permissions | Documentación de proveedor | Hasura | vigente |
| postgraphilesec | PostGraphile security / best practices | Documentación de proveedor | Graphile | vigente (solo vía búsqueda) |
| infoqnetflix | Federated GraphQL platform at Netflix | Charla/artículo | InfoQ | 2020-2022 (solo vía búsqueda) |
| gartnerviaapollo | Predicción Gartner sobre federación (30 % a 2027) | Dato de segunda mano | Gartner citado por Apollo | 2024-2025 (solo vía búsqueda) |

Se intentó también el trabajo CEUR-WS Vol-4260 paper07 (posible comparación de GraphQL para LLM), pero el PDF no pudo leerse; se descartó (ver Limitations). No se logró obtener datos de State of JS sobre GraphQL ni tRPC.

### Stage 3 - Source Triage

Escala 1-5 (R relevancia, C credibilidad, T recencia, E fuerza del tipo de evidencia). Decisión: se usa, se usa con cautela o se descarta.

| Clave | R | C | T | E | Decisión y razón |
|---|---|---|---|---|---|
| owaspgqlcheat | 5 | 5 | 4 | 4 | Se usa. Fuente de autoridad para mitigaciones de DoS, autorización e introspección. |
| owaspwstggql | 4 | 5 | 4 | 3 | Se usa con cautela: solo leído por resumen de búsqueda. |
| owaspapi2023bopla | 5 | 5 | 4 | 4 | Se usa. Base del riesgo de exponer propiedades de un modelo. |
| graphqlorgsecurity | 5 | 4 | 4 | 4 | Se usa. Fundación del propio estándar; no es neutral a favor, pero admite los riesgos. |
| graphqlorgbp | 3 | 4 | 4 | 3 | Se usa, página índice con resúmenes de una línea. |
| bessey2024over | 5 | 3 | 3 | 3 | Se usa. Experiencia de practicante, no estudio; muy citado. |
| willison2024 | 2 | 4 | 3 | 1 | Solo contexto de recepción; no se cita como evidencia. |
| wundergraph2024wrong | 4 | 2 | 4 | 2 | Se usa con cautela. Sesgo: vende Cosmo (federación). Valioso porque el proveedor concede límites. |
| brandur2018graphql | 4 | 4 | 3 | 2 | Se usa. Defensa de GraphQL por un practicante sin producto que vender, con matiz 2025. |
| postman2025 | 4 | 3 | 5 | 3 | Se usa con cautela. Muestra autoseleccionada de usuarios de Postman; sesgo hacia desarrolladores de API. |
| postman2023 | 2 | 3 | 2 | 2 | Solo como punto de comparación; cifra leída en resumen de búsqueda. |
| anthropic2025tools | 5 | 4 | 5 | 3 | Se usa. Fuente primaria sobre diseño de herramientas; no es estudio controlado sobre GraphQL. |
| mcpspec | 3 | 5 | 5 | 3 | Se usa con cautela: leído por resumen de búsqueda. |
| apollo2025ops | 4 | 2 | 4 | 2 | Se usa con cautela. Sesgo: Apollo vende GraphOS y MCP Server. Sin análisis de seguridad. |
| apollo2025schema | 4 | 2 | 4 | 2 | Se usa con cautela. Sin metodología; las cifras son internamente laxas. |
| apollocomm2025 | 3 | 2 | 4 | 1 | Anécdota de un usuario; solo ilustra el costo de definiciones de herramientas. |
| chillicream2026 | 4 | 2 | 5 | 2 | Se usa con cautela. Experimento sin método, proveedor con interés. |
| wundergraph2026agents | 4 | 1 | 5 | 1 | Se usa solo como declaración de postura de proveedor; sin datos independientes. |
| thoughtworks2025radar | 4 | 4 | 5 | 3 | Se usa. Anillo "Assess": es decir, aún no recomendado como práctica asentada. |
| hasuradocs | 3 | 3 | 4 | 3 | Se usa para describir el modelo de permisos por rol, tabla y operación. |
| postgraphilesec | 3 | 3 | 4 | 3 | Se usa con cautela (resumen de búsqueda). |
| infoqnetflix | 3 | 4 | 2 | 3 | Se usa con cautela para el caso de federación a gran escala. |
| gartnerviaapollo | 2 | 2 | 4 | 1 | Se descarta como evidencia: cifra de segunda mano relayada por un proveedor, informe original no encontrado. |
| Artículos de DEV Community con cifras de "State of TypeScript/JS" sobre tRPC | 2 | 1 | 4 | 1 | Descartados: cifras no verificables y errores evidentes (versiones inexistentes). |
| Cosmic, Hygraph, itechguides, Medium/DZone sobre "REST vs GraphQL para agentes" | 2 | 1 | 4 | 1 | Descartados como evidencia (sesgos opuestos y sin datos); solo se usan para constatar que no hay consenso. |
| CEUR-WS Vol-4260 paper07 | ? | ? | 5 | ? | No evaluable: PDF ilegible en la recuperación. |

Sesgos señalados: Apollo, WunderGraph, ChilliCream y Hygraph venden infraestructura GraphQL; Cosmic y Hasura/PostGraphile tienen sus propios intereses (Hasura y PostGraphile venden o promueven la generación desde la base de datos). Postman vende tooling de APIs.

### Stage 4 - Evidence Extraction

**4.1 Ventajas clásicas de GraphQL**

- Selección explícita de campos. Hecho (atribuido): el cliente nombra cada campo, sin comodín, lo que reduce carga útil y deja al proveedor observar qué campos se usan [@brandur2018graphql]. Interpretación: es la base de la evolución sin versiones.
- Evolución sin versiones. La documentación oficial describe diseñar y evolucionar el esquema "sin versiones" [@graphqlorgbp]. Brandur sostiene que con REST el proveedor debe asumir que todo campo está en uso, mientras que con GraphQL se puede deprecar, medir y retirar [@brandur2018graphql]. Matiz: Bessey afirma que GraphQL desaconseja cambios que rompen sin dar herramientas para gestionarlos [@bessey2024over]. Brandur, en su actualización de 2025, dice que hoy lo recomendaría con menos entusiasmo y menciona HTTP/3 con diseño dirigido por SDK como posible mejor compromiso [@brandur2018graphql]. Él mismo admite que GraphQL no es "mejor lo suficiente" que REST (cita parcial) [@brandur2018graphql].
- Esquema tipado e introspección. Brandur contrasta la introspección nativa con OpenAPI, que es una descripción añadida que a menudo falta o es inexacta porque no está atada a la implementación [@brandur2018graphql]. Interpretación: ese argumento pierde fuerza en un framework como `modular_api`, donde el OpenAPI se genera desde los DTOs tipados del propio código.
- Bessey valora que GraphQL es autodocumentado y con tipos, y propone para equipos que controlan sus clientes un REST con OpenAPI 3.0+ o un flujo schema-first con TypeSpec [@bessey2024over]. Condiciones que él enumera para esa alternativa: controlar todos los clientes, tres o menos clientes, lenguaje de cliente tipado estáticamente, y más de un lenguaje entre servidor y clientes [@bessey2024over].
- Round trips y over/under-fetching. Brandur menciona recorrer el grafo en una sola petición y cita la expansión de objetos de Stripe como solución REST equivalente [@brandur2018graphql]. Bessey cuestiona que una sola consulta supere a peticiones paralelas con HTTP/2 [@bessey2024over].
- Federación. WunderGraph (proveedor) afirma que el valor principal de GraphQL es habilitar federación y colaboración entre equipos, no rendimiento ni DX, y recomienda tRPC para monolitos de un equipo y REST para APIs públicas [@wundergraph2024wrong]. Netflix reporta GraphQL federado como estándar para más de 1000 ingenieros según resumen de InfoQ (leído solo vía búsqueda) [@infoqnetflix]. Interpretación: la federación es una ventaja organizacional de muchos equipos; no aplica a un fundador individual con un backend.

**4.2 Costos**

- Superficie de DoS. OWASP recomienda limitar profundidad y cantidad, paginar, timeouts a nivel de aplicación, análisis de costo (señalando que es complejo y puede no ser necesario), rate limiting consciente de GraphQL, batching y límites de recursos [@owaspgqlcheat]. La documentación oficial agrega que contar peticiones es mala medida de carga porque el cliente elige los campos [@graphqlorgsecurity]. Bessey reporta una consulta de introspección de unos 128 bytes que devolvió megabytes y tardó unos 10 segundos [@bessey2024over]. Hecho: el runtime de `modular_api` ya incluye topes de profundidad, complejidad y límite, coherentes con estas guías (dato del contexto del usuario, no de las fuentes).
- Introspección. OWASP: desactivarla y GraphiQL en producción o restringirlos a roles, y considerar apagar sugerencias "did you mean" [@owaspgqlcheat]. La Fundación la califica de "seguridad por oscuridad" (cita parcial) y útil solo dentro de una estrategia amplia [@graphqlorgsecurity]. WSTG añade que desactivar la introspección no basta si las sugerencias de campo siguen activas (leído vía búsqueda) [@owaspwstggql].
- Autorización por campo. OWASP exige verificar autorización por cada objeto pedido por ID (BOLA), por campo en lectura, y revisar los campos `node`/`nodes` [@owaspgqlcheat]. Bessey sostiene que los chequeos por campo con contexto son una tarea mucho mayor que los chequeos por endpoint en REST, y que las comprobaciones por elemento fueron "la mayor fuente de problemas de rendimiento" de su equipo (cita parcial) [@bessey2024over]. La guía oficial recomienda delegar la autorización a la capa de lógica de negocio [@graphqlorgbp].
- N+1. Bessey describe resolvers anidados que repiten consultas y el patrón DataLoader, y un segundo N+1 por autorización [@bessey2024over]. OWASP menciona DataLoader como mitigación [@owaspgqlcheat]. Interpretación: en un runtime que compila GraphQL a SQL (como el de `modular_api`) el N+1 clásico se evita por diseño, pero el costo se traslada a la complejidad del compilador SQL (dato de contexto, no de fuentes).
- Caché HTTP. Bessey afirma que el caché HTTP rara vez es problema en SaaS por datos específicos de usuario [@bessey2024over]. WunderGraph acepta persisted queries por GET con caché de borde como solución [@wundergraph2024wrong]. Thoughtworks mantiene el caché y el versionado como desafíos estándar [@thoughtworks2025radar].
- Semántica de errores y tooling. Bessey se queja de que los errores quedan enterrados en el JSON y de la fricción con códigos HTTP [@bessey2024over]. Hecho de contexto: GraphQL devuelve habitualmente 200 con arreglo de errores (no verificado con fuente primaria en esta investigación).
- Acoplamiento y lógica en el transporte. Bessey: en bases maduras, autorización, DataLoaders y conexiones personalizadas llevan lógica de negocio a la capa de transporte y obligan a pruebas de integración [@bessey2024over].
- Concesión de proveedor. WunderGraph ya considera que GraphQL monolítico no vale la complejidad añadida [@wundergraph2024wrong]. Es una afirmación contra su propio interés comercial parcial, por lo que tiene peso adicional.

**4.3 GraphQL autogenerado sobre tablas frente a casos de uso**

- OWASP API3:2023 define como riesgo exponer propiedades sensibles de un objeto o permitir modificarlas, y aconseja evitar métodos genéricos tipo `to_json` y seleccionar explícitamente las propiedades a devolver [@owaspapi2023bopla]. Interpretación: un esquema derivado de tablas es el caso extremo de "devolver todo lo que el modelo tenga" salvo que un catálogo de metadatos lo restrinja, que es justamente lo que hace el archivo de metadatos de `modular_api`; la mitigación existe pero es una lista de permitidos que hay que mantener.
- Hasura aplica permisos por tabla, rol y operación, con reglas de fila booleanas y de columna [@hasuradocs]. PostGraphile recomienda RLS en todas las tablas expuestas porque sin RLS el acceso es implícitamente abierto (leído vía búsqueda) [@postgraphilesec]. Interpretación: ambos mueven la autorización al nivel de datos; en SQL Server (cliente financiero) la política de filas equivalente exige diseño adicional que el runtime propio debería proveer.
- No se encontró en esta investigación una fuente independiente y sólida que critique directamente "el esquema de BD como contrato de API". Es una inferencia a partir de OWASP API3 y del acoplamiento descrito por Bessey, no un hallazgo documentado (ver Limitations).
- Reglas de negocio. Interpretación: un compilador a SQL de solo lectura no ejecuta invariantes de dominio; solo sirve para lecturas donde la regla se expresa como filtro o columna visible. Una lectura que requiere cálculo de dominio (saldo disponible, estado derivado) pertenece a un caso de uso.

**4.4 Evidencia de industria 2023-2026**

- Postman 2025: REST 93 %, webhooks 50 %, WebSockets 35 %, GraphQL 33 % de los encuestados [@postman2025]. La edición 2023 daba 29 % para GraphQL (cifra vía búsqueda) [@postman2023]. Interpretación: GraphQL se mantiene como minoría estable y creciente levemente; no hay señal de abandono masivo ni de sustitución de REST. La muestra es de usuarios de Postman.
- Postman 2025 sobre agentes: 24 % diseña APIs pensando en agentes (13 % por igual, 7 % principalmente, 5 % en transición), 60 % principalmente para humanos, 16 % no lo ha considerado; 51 % cita llamadas excesivas o no autorizadas de agentes como principal preocupación de seguridad; 10 % usa MCP regularmente [@postman2025].
- Bessey (2024) es el ensayo más citado contra GraphQL; Willison lo resume como una colección de críticas conocidas más un problema nuevo (leído vía búsqueda) [@willison2024]. Respuestas matizadas coinciden en que el valor está en la federación [@wundergraph2024wrong].
- Alternativas tRPC y RPC tipado: las comparaciones encontradas son blogs de calidad baja y con cifras no verificables, por lo que no se usan como evidencia de adopción. Se registra solo la tesis repetida: tRPC infiere tipos de TypeScript y está limitado a TypeScript, mientras que REST y GraphQL siguen siendo la respuesta para APIs públicas o multilenguaje (síntesis de resultados de búsqueda, no citada como fuente).
- Federación a gran escala (Netflix, Expedia, Airbnb) está documentada por charlas y blogs, parte de ellos de proveedores [@infoqnetflix]. La predicción Gartner relayada por Apollo no se usa [@gartnerviaapollo].

**4.5 Ángulo de agentes de IA**

- Guía de Anthropic: consolidar herramientas alrededor de flujos de trabajo en lugar de exponer list/read/create sueltos; no envolver cada endpoint de la API; priorizar eficiencia de tokens con paginación, filtros y truncado; nombres claros; control del formato de respuesta [@anthropic2025tools]. Interpretación: esto favorece herramientas estrechas orientadas a tarea sobre una superficie genérica de consulta.
- MCP: las herramientas se describen con `inputSchema` y `outputSchema` en JSON Schema 2020-12 y anotaciones de comportamiento (solo lectura, destructivo, idempotente), con separación entre errores de protocolo y de ejecución (leído vía búsqueda) [@mcpspec]. Interpretación: el contrato nativo para agentes es JSON Schema, que es también lo que OpenAPI 3.1 usa; un caso de uso con DTOs tipados se mapea casi directamente a una herramienta MCP.
- Apollo ofrece un MCP Server que convierte operaciones GraphQL predefinidas en herramientas ("la operación es la definición de la herramienta", cita parcial), con variables ocultas al LLM [@apollo2025ops]. Esto es en la práctica el modelo "herramienta estrecha por tarea" con GraphQL como mecanismo de implementación, no el modelo "agente que arma consultas libres". Apollo también ofrece herramientas de introspección para exploración dinámica, y recomienda según resúmenes combinar operaciones predefinidas para escrituras e introspección para lecturas (vía búsqueda). El artículo de junio de 2025 no trata seguridad [@apollo2025ops].
- Costo de contexto de la introspección: Apollo admite que la introspección tradicional puede consumir porciones significativas del contexto y propone búsqueda semántica y minificación, con cifras (36 a 56 % menos tokens implícito; 5000-9500 frente a 3200-5300 tokens) sin metodología [@apollo2025schema]. Un usuario reportó definiciones de herramientas de 31 657 tokens con 8 operaciones y un esquema de unas 9000 líneas [@apollocomm2025]. Interpretación: el costo de contexto es real y está reconocido por los propios proveedores.
- ChilliCream: en un experimento sin método publicado, descubrir la API costó 665 564 tokens con OpenAPI, 133 441 con esquema GraphQL y 59 067 con introspección semántica [@chillicream2026]. Interpretación: no se conoce el tamaño del OpenAPI usado ni la tarea; el resultado dice más sobre el tamaño del documento OpenAPI completo que sobre el protocolo, y un OpenAPI filtrado a las operaciones necesarias cambiaría la comparación. No se midió éxito de tarea.
- WunderGraph argumenta que los agentes sufren más el over-fetching y que envolver muchos endpoints REST como herramientas MCP reproduce una lista plana, pero no aporta datos independientes [@wundergraph2026agents].
- Thoughtworks (Assess, noviembre de 2025): GraphQL como capa de acceso a datos uniforme para LLM, punto medio gobernado entre REST y SQL, con la salvedad de que depende de esquemas bien nombrados, aumenta la exposición a DoS y mantiene los problemas de caché y versionado [@thoughtworks2025radar]. Es la fuente más equilibrada de la sección, aunque sigue siendo una posición de radar y no una medición.
- Postman: 51 % de preocupación por llamadas excesivas de agentes [@postman2025]. Interpretación: un agente que compone consultas libres sobre un esquema amplio amplifica precisamente el riesgo de consultas costosas que OWASP describe [@owaspgqlcheat].

### Stage 5 - Synthesis and Limits

**Acuerdos entre fuentes**
- GraphQL aporta contrato tipado, introspección y evolución por campo; las críticas de Bessey y las defensas de Brandur y WunderGraph coinciden en esos hechos y discrepan en su peso [@bessey2024over; @brandur2018graphql; @wundergraph2024wrong].
- Los costos de seguridad (profundidad, costo, autorización por campo, introspección) están en la guía oficial y en OWASP, no solo en críticos [@graphqlorgsecurity; @owaspgqlcheat].
- Incluso los proveedores reconocen costo de contexto de la introspección para agentes y proponen mitigaciones [@apollo2025schema; @chillicream2026].
- Federación como valor central para grandes organizaciones: acuerdo entre un proveedor y un crítico equilibrado [@wundergraph2024wrong; @bessey2024over].

**Conflictos**
- Agentes: proveedores GraphQL afirman ventaja de tokens y navegación [@wundergraph2026agents; @apollo2025ops]; Anthropic recomienda herramientas consolidadas por tarea y no envolver APIs completas [@anthropic2025tools]. No son contradictorios si GraphQL se usa solo como implementación de operaciones predefinidas.
- OpenAPI frente a GraphQL como contrato: Brandur lo considera más fiable en GraphQL [@brandur2018graphql]; Bessey lo considera suficiente con OpenAPI y TypeSpec cuando se controlan los clientes [@bessey2024over].

**Conclusiones y confianza**

| # | Conclusión | Confianza |
|---|---|---|
| C1 | La ventaja "el frontend evoluciona lecturas sin tocar el backend" depende del costo humano de crear endpoints; con agentes, ese costo de escritura desaparece, y queda el costo de revisar, probar, versionar y mantener cada endpoint. La ventaja se debilita mucho pero no a cero. | Media (inferencia razonada; ninguna fuente mide este efecto directamente) |
| C2 | Las ventajas de contrato tipado e introspección son reproducibles con OpenAPI generado desde DTOs más codegen, que es lo que `modular_api` ya ofrece. | Media-alta (Bessey, estructura del framework; Brandur discrepa con argumento sobre exactitud del OpenAPI, que no aplica si se genera del código) |
| C3 | Los costos de seguridad y operación de GraphQL no dependen de quién escribe el código y no bajan con IA. | Alta (OWASP, graphql.org) |
| C4 | GraphQL autogenerado desde tablas expone el modelo físico como contrato y desplaza la autorización a filas y columnas; solo es defendible con lista explícita de campos publicados y política de filas. | Media (OWASP API3 y documentación de Hasura/PostGraphile; sin fuente directa sobre "esquema de BD como contrato") |
| C5 | GraphQL sigue siendo minoría estable (aprox. 30 % de usuarios de Postman) sin señal de reemplazo de REST; su valor más defendido es la federación entre muchos equipos. | Media (Postman es muestra sesgada; federación solo por proveedor e InfoQ vía búsqueda) |
| C6 | Para agentes, la mejor práctica documentada son herramientas estrechas por tarea; GraphQL puede ser su implementación (operaciones persistidas), pero el esquema libre con introspección cuesta contexto y amplía el riesgo. | Media-baja (única guía primaria es de Anthropic; el resto es de proveedores sin metodología) |
| C7 | OpenAPI ya da a un agente un contrato suficiente si se filtra a las operaciones relevantes; el experimento de tokens a favor de GraphQL no controla ese filtrado. | Baja-media |
| C8 | La demanda del runtime GraphQL es mínima: un consumidor (`tigre_regalon_2`) inactivo desde junio de 2026 y en 0.4.8, que usó GraphQL para dos o tres lecturas a costa de un catálogo escrito a mano, un traductor T-SQL→PostgreSQL y parches de tipos. Su costo de mantenimiento es hoy casi todo costo de oportunidad. | Alta (verificado en el repositorio del consumidor) |

**Incertidumbres**: efecto real de agentes de IA sobre la economía de endpoints; comparación empírica independiente de GraphQL y OpenAPI para agentes; adopción de tRPC y RPC tipado; práctica de autorización por fila en SQL Server en el sector financiero peruano.

## Discussion

> **Decisión del fundador (2026-11-28).** El runtime GraphQL no se congela ni se cierra: sigue como **experimental**, con trabajo eventual. Ya funciona como plugin, de modo que puede extraerse a un paquete aparte sin cambios en el core. Las recomendaciones de este informe se leen como criterios para priorizar ese trabajo, no como una decisión de abandono. Ver también `2026-11-graphql-community-ai-agents.md`.


**Sobre la autonomía del frontend.** El argumento clásico era que un cambio de lectura en el frontend no debe esperar un sprint de backend. Cuando un agente crea un caso de uso REST en minutos, la espera desaparece y el argumento se convierte en una discusión sobre calidad: cada endpoint nuevo es superficie que revisar, autorizar y mantener. Aquí GraphQL sí reduce el número de superficies, pero a cambio traslada el costo a un único punto grande (el motor de consultas) cuyos riesgos están bien documentados [@owaspgqlcheat; @graphqlorgsecurity]. Para un fundador individual con un solo consumidor que ya usa casos de uso y SQL escrito a mano, esa transferencia no se amortiza.

**Sobre "orden y estructura".** Ese beneficio existe, pero `modular_api` ya lo obtiene con DTOs tipados de entrada y salida y OpenAPI automático. Es consistente con la salida que Bessey propone cuando se controlan los clientes [@bessey2024over].

**Sobre agentes como consumidores.** Es el argumento nuevo y más interesante, pero también el peor respaldado. Los proveedores lo promueven [@wundergraph2026agents; @apollo2025schema; @chillicream2026]. La guía de ingeniería de Anthropic pide herramientas por tarea, con respuestas acotadas [@anthropic2025tools], y la forma en que Apollo sirve a agentes de manera responsable (operaciones predefinidas expuestas como herramientas) es en esencia un caso de uso nombrado con entradas tipadas [@apollo2025ops]. Eso es lo que `modular_api` ya produce. Un agente que usa el esquema libre añade riesgo de consultas costosas, y Postman muestra que la preocupación principal sobre agentes es el consumo excesivo [@postman2025]. Un posible beneficio diferencial de GraphQL sería la lectura exploratoria sobre datos relacionales que no se pueden prever; incluso ahí Thoughtworks ubica la práctica en "Assess" y enumera DoS y esquemas bien nombrados como condiciones [@thoughtworks2025radar].

**Sobre autogeneración desde la base de datos.** El catálogo con archivo de metadatos que elige tablas, columnas y relaciones es la mitigación correcta frente a API3:2023 [@owaspapi2023bopla]. Aun así, el contrato público sigue siendo el modelo físico renombrado; cualquier cambio de esquema físico se vuelve cambio de contrato, y las reglas de dominio no se ejecutan. Para clientes financieros, esto pide autorización por fila y auditoría que el runtime debería demostrar antes de tener un consumidor real. Esta es una inferencia, no un hallazgo documentado.

**Costo de oportunidad.** Mantener dos compiladores SQL (SQL Server y PostgreSQL) y otras tres implementaciones de lenguaje (Dart, TypeScript, Python) de un runtime sin consumidores activos es el costo más concreto que la evidencia permite señalar, aunque con agentes el costo de escribir ese código sea bajo; el costo de verificarlo y de responder por su seguridad no lo es.

## Conclusion

**Recomendación: congelar el runtime GraphQL en el core (sin inversión nueva) y preparar su extracción a un paquete opcional, sin eliminarlo todavía.**

Justificación: (a) la ventaja que motivó GraphQL, la autonomía del frontend, está muy erosionada por agentes (C1); (b) lo que queda (tipado, introspección) ya lo cubre el OpenAPI generado (C2); (c) los costos de seguridad persisten (C3) y son especialmente delicados en el sector financiero; (d) su único consumidor está inactivo (C8); (e) eliminarlo descarta una opción barata de conservar y el trabajo ya hecho (incluido el compilador PostgreSQL recién añadido).

Pasos concretos sugeridos:
1. Congelar: sin nuevas funciones ni nuevos dialectos; solo correcciones de seguridad; mantener introspección apagada por defecto y los topes actuales.
2. Aislar: garantizar que el runtime no sea dependencia del núcleo de casos de uso (ya es opcional), documentándolo como experimental. Si la separación en paquete es barata, hacerla en el próximo cambio mayor de versión.
3. Usar el esfuerzo liberado en lo que sí sirve a agentes: exportar casos de uso como herramientas MCP desde los DTOs (JSON Schema), con anotaciones de solo lectura o destructivo, respuestas acotadas y paginadas [@anthropic2025tools; @mcpspec].

**Criterios que cambiarían la decisión**
- A favor de volver a invertir (o mantener en el core): un consumidor real con muchas lecturas ad hoc sobre un modelo relacional estable, que cambie más rápido de lo que se pueden revisar nuevos casos de uso; o un cliente que exija una capa de consulta flexible sobre un modelo ya publicado; o varios equipos consumidores donde la federación o un grafo único valga la coordinación.
- A favor de extraer: aparición de un segundo ecosistema de consumidores que quiera el runtime sin el resto del framework, o coste de CI/mantenimiento medible.
- A favor de eliminar: 12 meses sin consumidor y una brecha de seguridad o de mantenimiento que no se justifique; o una auditoría del sector financiero que objete la superficie.
- Evidencia externa que haría revisar la conclusión sobre agentes: un benchmark independiente, con tarea y tasa de éxito medidas, donde GraphQL con operaciones libres supere a herramientas por tarea o a OpenAPI filtrado.

## Limitations

- Varias fuentes se verificaron solo por resumen de resultados de búsqueda y no por lectura de la página: WSTG de OWASP, Willison, la edición 2023 de Postman (29 %), PostGraphile, InfoQ/Netflix, MCP specification, el hilo de la comunidad Apollo, la cifra de Gartner (que se descarta) y el contexto de "GraphQL Is Dead".
- No se pudo leer el PDF CEUR-WS Vol-4260 paper07 (contenido binario ilegible tras la recuperación); no se usó. No se pudo recuperar el texto de "Why, After Eight Years, I Still Like GraphQL Sometimes", solo su título en una lista. La página original de Bessey se recuperó, pero el primer intento vía búsqueda dependió de réplicas.
- No se obtuvieron datos de State of JS ni de encuestas sobre tRPC o RPC tipado; las comparaciones encontradas eran de baja calidad y se descartaron. La sección de alternativas (tRPC, codegen) queda poco respaldada.
- No se localizó una fuente independiente que critique específicamente exponer el esquema físico de la base de datos como contrato (la sección 4.3 es en parte inferencia).
- Afirmaciones sobre "200 con errores" y semántica HTTP provienen del ensayo de Bessey y de conocimiento general, sin fuente primaria específica recuperada.
- Casi toda la evidencia sobre agentes proviene de proveedores con interés comercial y sin metodología reproducible; ninguna mide éxito de tarea. El experimento de ChilliCream no declara modelo, tarea ni número de ejecuciones.
- Postman usa una muestra autoseleccionada de sus usuarios; no representa a la industria.
- Los efectos sobre el costo de mantenimiento en el repositorio propio no se midieron; la recomendación se basa en el contexto declarado por el fundador y en la revisión de sus dos repositorios consumidores (`socia`, que no usa GraphQL, y `tigre_regalon_2`, inactivo).
- La fecha de la investigación (2026-11-28) y el ritmo del tema implican que la guía de MCP y los productos citados pueden haber cambiado.

## References

```bibtex
@misc{owaspgqlcheat,
  title = {GraphQL Cheat Sheet},
  author = {{OWASP Cheat Sheet Series}},
  note = {Accessed: 2026-11-28},
  url = {https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html}
}

@misc{owaspwstggql,
  title = {Testing GraphQL, Web Security Testing Guide},
  author = {{OWASP}},
  note = {Accessed: 2026-11-28. Read via search-result summary only},
  url = {https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/99-Testing_GraphQL}
}

@misc{owaspapi2023bopla,
  title = {API3:2023 Broken Object Property Level Authorization, OWASP API Security Top 10},
  author = {{OWASP API Security Project}},
  year = {2023},
  note = {Accessed: 2026-11-28},
  url = {https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/}
}

@misc{graphqlorgsecurity,
  title = {GraphQL Security},
  author = {{GraphQL Foundation}},
  note = {Accessed: 2026-11-28},
  url = {https://graphql.org/learn/security/}
}

@misc{graphqlorgbp,
  title = {GraphQL Best Practices (index page)},
  author = {{GraphQL Foundation}},
  note = {Accessed: 2026-11-28},
  url = {https://graphql.org/learn/best-practices/}
}

@article{bessey2024over,
  author = {Bessey, Matt},
  title = {Why, after 6 years, I'm over GraphQL},
  year = {2024},
  url = {https://bessey.dev/blog/2024/05/24/why-im-over-graphql/}
}

@misc{willison2024,
  title = {Link blog: Why, after 6 years, I'm over GraphQL},
  author = {Willison, Simon},
  year = {2024},
  note = {Accessed: 2026-11-28. Read via search-result summary only},
  url = {https://simonwillison.net/2024/May/30/why-after-6-years-im-over-graphql/}
}

@article{wundergraph2024wrong,
  author = {Neuse, Jens},
  title = {I was wrong about GraphQL},
  year = {2024},
  note = {Published 2024-12-03, updated 2026-05-26. Vendor (WunderGraph)},
  url = {https://wundergraph.com/blog/six-year-graphql-recap}
}

@article{brandur2018graphql,
  author = {Leach, Brandur},
  title = {Why GraphQL (with 2025 update)},
  year = {2018},
  note = {Updated 2025-08-03},
  url = {https://brandur.org/graphql}
}

@misc{postman2025,
  title = {2025 State of the API Report},
  author = {{Postman}},
  year = {2025},
  note = {Accessed: 2026-11-28},
  url = {https://www.postman.com/state-of-api/2025/}
}

@misc{postman2023,
  title = {State of the API Report 2023},
  author = {{Postman}},
  year = {2023},
  note = {Accessed: 2026-11-28. GraphQL 29 percent figure read via search-result summary only},
  url = {https://www.postman.com/state-of-api/}
}

@article{anthropic2025tools,
  author = {Aizawa, Ken and others},
  title = {Writing effective tools for agents -- with agents},
  year = {2025},
  note = {Anthropic Engineering, 2025-09-11},
  url = {https://www.anthropic.com/engineering/writing-tools-for-agents}
}

@misc{mcpspec,
  title = {Model Context Protocol Specification: Tools},
  author = {{Model Context Protocol}},
  year = {2025},
  note = {Accessed: 2026-11-28. Read via search-result summary only},
  url = {https://modelcontextprotocol.io/specification/latest/server/tools}
}

@article{apollo2025ops,
  author = {Hawkins, Matt},
  title = {Every Token Counts: Building Efficient AI Agents with GraphQL and Apollo MCP Server},
  year = {2025},
  note = {Apollo GraphQL blog, 2025-06-24. Vendor},
  url = {https://www.apollographql.com/blog/building-efficient-ai-agents-with-graphql-and-apollo-mcp-server}
}

@article{apollo2025schema,
  author = {Seo, Dale},
  title = {Smart Schema Discovery: How Apollo MCP Server Maximizes AI Context Efficiency},
  year = {2025},
  note = {Apollo GraphQL blog, 2025-09-17. Vendor},
  url = {https://www.apollographql.com/blog/smart-schema-discovery-how-apollo-mcp-server-maximizes-ai-context-efficiency}
}

@misc{apollocomm2025,
  title = {Large Tool Contexts from Apollo MCP Server?},
  author = {{Apollo community forum user}},
  note = {Accessed: 2026-11-28. Read via search-result summary only},
  url = {https://community.apollographql.com/t/large-tool-contexts-from-apollo-mcp-server/9354}
}

@article{chillicream2026,
  author = {Senn, Pascal},
  title = {Semantic Introspection},
  year = {2026},
  note = {ChilliCream blog, 2026-04-22. Vendor; experiment without published method},
  url = {https://chillicream.com/blog/2026/04/22/semantic-introspection}
}

@article{wundergraph2026agents,
  author = {Neuse, Jens},
  title = {GraphQL Is the API Layer AI Agents Actually Need},
  year = {2026},
  note = {WunderGraph blog, 2026-03-20, updated 2026-09-18. Vendor},
  url = {https://wundergraph.com/blog/graphql-api-layer-for-ai-agents}
}

@misc{thoughtworks2025radar,
  title = {GraphQL as data access pattern for LLMs},
  author = {{Thoughtworks}},
  year = {2025},
  note = {Technology Radar, ring Assess, 2025-11-05},
  url = {https://www.thoughtworks.com/radar/techniques/graphql-as-data-access-pattern-for-llms}
}

@misc{hasuradocs,
  title = {Hasura GraphQL permissions},
  author = {{Hasura}},
  note = {Accessed: 2026-11-28. Vendor documentation},
  url = {https://hasura.io/docs/2.0/auth/authorization/permissions/}
}

@misc{postgraphilesec,
  title = {PostGraphile security and best practices},
  author = {{Graphile}},
  note = {Accessed: 2026-11-28. Vendor documentation, read via search-result summary only},
  url = {https://postgraphile.org/postgraphile/5/security}
}

@misc{infoqnetflix,
  title = {Federated GraphQL platform at Netflix},
  author = {{InfoQ}},
  note = {Accessed: 2026-11-28. Read via search-result summary only},
  url = {https://www.infoq.com/articles/federated-GraphQL-platform-Netflix}
}

@misc{gartnerviaapollo,
  title = {Gartner prediction on GraphQL federation (30 percent by 2027), as relayed on the Apollo site},
  author = {{Apollo GraphQL}},
  note = {Accessed: 2026-11-28. Second-hand vendor claim; original report not found; not used as evidence},
  url = {https://apollographql.com/}
}
```
