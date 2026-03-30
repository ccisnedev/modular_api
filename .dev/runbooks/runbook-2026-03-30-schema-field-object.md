# RUNBOOK – SchemaField.object / Field.object para objetos JSON anidados

## Objective

Agregar soporte para campos de tipo `object` en los DTOs de Input/Output, de modo que webhooks
y APIs externas que envían objetos JSON anidados puedan ser declarados, validados y documentados
en el schema OpenAPI. Cierra issue #8.

## Scope

**In:**
- Dart: factory `SchemaField.object()`, case `'object'` en `_isJsonTypeValid`, case `Map` en `_inferOpenApiType`
- TypeScript: método `Field.object()`, `'object'` en union `FieldMeta.type`, case `'object'` en `isJsonTypeValid`
- Python: strip `additionalProperties` en `_normalize_schema` para paridad cross-SDK
- Fixture compartida con campo `object` para tests de conformancia
- Tests de validación y conformancia en los 3 SDKs
- Entradas en CHANGELOG v0.4.5 de los 3 SDKs

**Out:**
- Sub-fields/properties anidadas (un `SchemaField.object` acepta "cualquier JSON object", no define estructura interna)
- Cambios en `buildSchema` / `buildSchemaFromMetadata` (ya manejan `type: 'object'` correctamente)
- Cambios en OpenAPI builders (toman el schema tal cual)
- Soporte para `BaseModel` anidados en Python (distinto de `dict[str, Any]`)

## Context

- Module: `core/schema` en Dart y TS, `core/usecase` en Python
- Locations:
  - Dart: `dart/lib/src/core/schema/field.dart` — `SchemaField`, `_isJsonTypeValid`, `_inferOpenApiType`, `buildSchema`
  - TypeScript: `ts/src/core/schema/field.ts` — `Field`, `FieldMeta`; `ts/src/core/usecase.ts` — `isJsonTypeValid`, `buildSchemaFromMetadata`
  - Python: `py/src/modular_api/core/usecase.py` — `_normalize_schema`
- Fixtures: `tests/fixtures/hello_input_schema.json`, `hello_output_schema.json`
- Related issue: GitHub issue #8
- Descubierto implementando el webhook de Ligo en [cacsi-dev/tigre_regalon_2#7](https://github.com/cacsi-dev/tigre_regalon_2/issues/7)
- Assumptions:
  - `buildSchema` y `buildSchemaFromMetadata` ya emiten `{type: field.type}` — si `type='object'`, producen `{"type":"object"}` sin cambios
  - Pydantic con `dict[str, Any]` genera `{type: 'object', additionalProperties: true}`. `additionalProperties: true` es semánticamente equivalente a omitirlo en OpenAPI 3.0.3, pero Dart/TS no lo emiten → se stripea en Python para paridad
  - El `default: return true` actual en las funciones de validación hace que `type: 'object'` no falle, pero tampoco valida. El fix agrega un case explícito para validación real
- Methodology: **Test Driven Development (TDD)**

## Decisions Log

- 2026-03-30: `SchemaField.object` / `Field.object` NO reciben sub-fields. El caso de uso es "aceptar cualquier JSON object" (webhooks). Sub-fields serían otro issue.
- 2026-03-30: Python solo necesita strip de `additionalProperties` en `_normalize_schema`. `dict[str, Any]` ya funciona para validación, serialización y schema.
- 2026-03-30: Se confirma via spike que `buildSchema` (Dart) y `buildSchemaFromMetadata` (TS) no necesitan cambios — ya manejan `type: 'object'` correctamente.
- 2026-03-30: Fixture nueva `webhook_input_schema.json` con campos string + object para tests de conformancia cross-SDK.
- 2026-03-30: Este cambio va dentro de la versión v0.4.5 (mismo release que servers, CORS y trace_id).

## Test Review Mode

- **Mode**: `review`
- `review`: en cada step, los tests se presentan al usuario para aprobación antes de implementar.

## Execution Plan (TDD Checklist)

Cada step sigue el ciclo Red-Green-Refactor con **Review Gate**. Al completar cada sub-paso, marcar su checkbox (`[x]`). El commit final de cada step debe incluir el RUNBOOK con los checks actualizados.

### Step 1: Dart — `SchemaField.object` factory + validación `_isJsonTypeValid` + `_inferOpenApiType`

Archivos a modificar: `dart/lib/src/core/schema/field.dart`

Cambios:
- Nuevo factory `SchemaField.object(String name, {String? description, dynamic example})` → `SchemaField(name, 'object', ...)`
- `_isJsonTypeValid`: agregar `case 'object': return value is Map;`
- `_inferOpenApiType`: agregar `if (value is Map) return 'object';` (antes del fallback `return 'string'`)

- [ ] Write failing test(s) with documentation
  - `dart/test/fromjson_validation_test.dart`: 3 nuevos tests en grupo `validateJsonFields — object type`
    - `accepts Map value for SchemaField.object` — JSON con campo `{key: value}` pasa validación
    - `rejects String value for SchemaField.object` — string donde se espera object → `"Field 'details' must be of type object"`
    - `rejects List value for SchemaField.object` — array donde se espera object → mismo error
  - `dart/test/schema_conformance_test.dart`: 1 test nuevo
    - `WebhookInput schema matches shared fixture` — schema con campo `object` coincide con fixture `webhook_input_schema.json`
- [ ] 🔍 REVIEW GATE: Present documented tests to user for approval
- [ ] Incorporate user feedback
- [ ] Implement minimum code to pass
- [ ] Refactor if needed
- [ ] Mark completed checks in this RUNBOOK
- [ ] `git add . && git commit -m "feat(dart): add SchemaField.object + object type validation (closes #8)"` (all tests green, RUNBOOK updated)

### Step 2: TypeScript — `Field.object()` + `FieldMeta.type` union + `isJsonTypeValid`

Archivos a modificar: `ts/src/core/schema/field.ts`, `ts/src/core/usecase.ts`

Cambios:
- `FieldMeta.type`: agregar `'object'` al union → `'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object'`
- Nuevo método `Field.object(options)` siguiendo el patrón de los demás
- `isJsonTypeValid`: agregar `case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);`

- [ ] Write failing test(s) with documentation
  - `ts/test/fromjson_validation.test.ts`: 3 tests nuevos en grupo `Input.validateJson — object type`
    - `accepts plain object for Field.object` — JSON con `{key: value}` pasa
    - `rejects string for Field.object` — `"Field 'details' must be of type object"`
    - `rejects array for Field.object` — mismo error
  - `ts/test/schema_conformance.test.ts`: 1 test nuevo
    - `WebhookInput schema matches shared fixture` — schema con `@Field.object()` coincide con fixture
- [ ] 🔍 REVIEW GATE: Present documented tests to user for approval
- [ ] Incorporate user feedback
- [ ] Implement minimum code to pass
- [ ] Refactor if needed
- [ ] Mark completed checks in this RUNBOOK
- [ ] `git add . && git commit -m "feat(ts): add Field.object + object type validation (closes #8)"` (all tests green, RUNBOOK updated)

### Step 3: Python — strip `additionalProperties` + tests de conformancia

Archivos a modificar: `py/src/modular_api/core/usecase.py`

Cambios:
- `_normalize_schema`: eliminar `additionalProperties` de las propiedades normalizadas (tanto en el branch de `anyOf` como en el branch normal)

- [ ] Write failing test(s) with documentation
  - `py/tests/test_fromjson_validation.py`: 3 tests nuevos en clase `TestFromJsonObjectType`
    - `test_accepts_dict_for_object_field` — `dict[str, Any]` pasa validación strict
    - `test_rejects_string_for_object_field` — string donde se espera dict → `ValidationError`
    - `test_rejects_list_for_object_field` — list donde se espera dict → `ValidationError`
  - `py/tests/test_schema_conformance.py`: 1 test nuevo
    - `test_webhook_input_schema_matches_fixture` — schema normalizado coincide con fixture
- [ ] 🔍 REVIEW GATE: Present documented tests to user for approval
- [ ] Incorporate user feedback
- [ ] Implement minimum code to pass
- [ ] Refactor if needed
- [ ] Mark completed checks in this RUNBOOK
- [ ] `git add . && git commit -m "feat(py): strip additionalProperties + object type conformance (closes #8)"` (all tests green, RUNBOOK updated)

### Step 4: Fixture compartida + parity validation + CHANGELOGs

- [ ] Crear fixture `tests/fixtures/webhook_input_schema.json` con el schema target:
  ```json
  {
    "type": "object",
    "properties": {
      "instruction_id": { "type": "string", "description": "Payment instruction ID", "example": "20260323ABC" },
      "transfer_details": { "type": "object", "description": "Nested transfer info", "example": { "amount": 2300, "currency": "PEN" } }
    },
    "required": ["instruction_id", "transfer_details"],
    "example": { "instruction_id": "20260323ABC", "transfer_details": { "amount": 2300, "currency": "PEN" } }
  }
  ```
- [ ] Correr tests en los 3 SDKs: `dart test`, `cd ts && npx vitest run`, `cd py && python -m pytest`
- [ ] Actualizar CHANGELOGs de los 3 SDKs bajo `[0.4.5]`:
  - Dart: `Added` — `SchemaField.object()` factory + `'object'` case en `_isJsonTypeValid` + `_inferOpenApiType`
  - TS: `Added` — `Field.object()` decorator + `'object'` case en `isJsonTypeValid`
  - Python: `Fixed` — `_normalize_schema` strips `additionalProperties` para paridad cross-SDK
- [ ] Mark completed checks in this RUNBOOK
- [ ] `git add . && git commit -m "feat: shared fixture + CHANGELOGs v0.4.5 (closes #8)"` (all tests green, RUNBOOK updated)

## Constraints

- No romper tests existentes (Dart ~302, TS ~215, Python ~292)
- No modificar `buildSchema` / `buildSchemaFromMetadata` — ya funcionan
- No agregar sub-fields/properties anidadas — fuera de scope
- La fixture debe ser idéntica al output de `toSchema()` en los 3 SDKs
- Cambios van en la versión 0.4.5 (no crear nueva versión)

## Validation

- `dart test` en `dart/` — todos green, incluyendo nuevos tests de object
- `npx vitest run` en `ts/` — todos green, incluyendo nuevos tests de object
- `python -m pytest` en `py/` — todos green, incluyendo nuevos tests de object
- Los 3 SDKs generan schemas idénticos para `WebhookInput` que coinciden con la fixture compartida
- `SchemaField.object('details')` en Dart, `@Field.object()` en TS, y `dict[str, Any]` en Python producen `{type: 'object'}` en el schema

## Rollback / Safety

- Cambios son aditivos (nuevo factory, nuevo case) — no rompen APIs existentes
- Si algo falla, revert del branch y el issue queda abierto

## Blockers / Open Questions

- Ninguno. El spike experimental confirmó que el camino funciona en los 3 SDKs.
