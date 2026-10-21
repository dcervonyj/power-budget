import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Runtime web <-> backend contract check (CLN-017).
 *
 * The web mappers are typed against `@power-budget/shared-app/contract`
 * (api-types), which is generated from packages/backend/openapi.json, and CI
 * already fails when either file drifts from the code. What no static check
 * can see is whether the running backend answers what the spec says. This
 * validates a real response body against the response schema of the spec, so
 * a passing check means the mapper input type matches the wire.
 *
 * Supports the OpenAPI 3.0 subset @nestjs/swagger emits: $ref, type, nullable,
 * enum, required, properties, items, allOf/oneOf/anyOf, format uuid/date-time.
 * Properties the spec does not declare are reported too: they are drift as well.
 */

interface Schema {
  readonly $ref?: string;
  readonly type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  readonly nullable?: boolean;
  readonly enum?: readonly unknown[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, Schema>>;
  readonly additionalProperties?: boolean | Schema;
  readonly items?: Schema;
  readonly allOf?: readonly Schema[];
  readonly oneOf?: readonly Schema[];
  readonly anyOf?: readonly Schema[];
  readonly format?: string;
}

interface Operation {
  readonly responses: Readonly<
    Record<string, { readonly content?: Record<string, { readonly schema?: Schema }> }>
  >;
}

interface OpenApiDocument {
  readonly paths: Readonly<Record<string, Readonly<Record<string, Operation>>>>;
  readonly components: { readonly schemas: Readonly<Record<string, Schema>> };
}

const SPEC_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../backend/openapi.json',
);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let spec: OpenApiDocument | null = null;

function loadSpec(): OpenApiDocument {
  spec ??= JSON.parse(readFileSync(SPEC_PATH, 'utf8')) as OpenApiDocument;

  return spec;
}

/** The documented JSON body schema of `method path` for `status`, e.g. ('get', '/plans/{id}', 200). */
export function responseSchema(method: string, specPath: string, status: number): Schema {
  const operation = loadSpec().paths[specPath]?.[method.toLowerCase()];
  if (operation === undefined) {
    throw new Error(`openapi.json has no ${method.toUpperCase()} ${specPath}`);
  }
  const schema = operation.responses[String(status)]?.content?.['application/json']?.schema;
  if (schema === undefined) {
    throw new Error(
      `openapi.json documents no JSON body for ${method.toUpperCase()} ${specPath} ${status}`,
    );
  }

  return schema;
}

/** Every mismatch between `value` and `schema`, as `$.path: problem` lines (empty = valid). */
export function contractErrors(schema: Schema, value: unknown): string[] {
  const errors: string[] = [];
  check(schema, value, '$', errors);

  return errors;
}

/** Validates a real response against the spec: throws with every mismatch. */
export function assertMatchesSpec(
  method: string,
  specPath: string,
  status: number,
  body: unknown,
): void {
  const errors = contractErrors(responseSchema(method, specPath, status), body);
  if (errors.length > 0) {
    throw new Error(
      `${method.toUpperCase()} ${specPath} ${status} does not match openapi.json:\n  ${errors.join('\n  ')}`,
    );
  }
}

function resolve(schema: Schema): Schema {
  if (schema.$ref === undefined) {
    return schema;
  }
  const name = schema.$ref.replace('#/components/schemas/', '');
  const target = loadSpec().components.schemas[name];
  if (target === undefined) {
    throw new Error(`Unknown schema ${schema.$ref}`);
  }

  return resolve(target);
}

function check(rawSchema: Schema, value: unknown, at: string, errors: string[]): void {
  const schema = resolve(rawSchema);
  if (value === null) {
    if (schema.nullable !== true) {
      errors.push(`${at}: null, but the spec does not mark it nullable`);
    }

    return;
  }
  if (schema.allOf !== undefined) {
    for (const part of schema.allOf) {
      check(part, value, at, errors);
    }

    return;
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives !== undefined) {
    if (!alternatives.some((alternative) => contractErrors(alternative, value).length === 0)) {
      errors.push(`${at}: matches none of the ${String(alternatives.length)} alternatives`);
    }

    return;
  }
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  checkType(schema, value, at, errors);
}

function checkType(schema: Schema, value: unknown, at: string, errors: string[]): void {
  switch (schema.type) {
    case 'object':
      checkObject(schema, value, at, errors);
      break;
    case 'array':
      if (!Array.isArray(value)) {
        errors.push(`${at}: expected an array, got ${typeof value}`);
        break;
      }
      for (const [index, item] of value.entries()) {
        if (schema.items !== undefined) {
          check(schema.items, item, `${at}[${String(index)}]`, errors);
        }
      }
      break;
    case 'string':
      checkString(schema, value, at, errors);
      break;
    case 'number':
    case 'integer':
      if (typeof value !== 'number' || (schema.type === 'integer' && !Number.isInteger(value))) {
        errors.push(`${at}: expected ${schema.type}, got ${JSON.stringify(value)}`);
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${at}: expected boolean, got ${JSON.stringify(value)}`);
      }
      break;
    case undefined:
      // An untyped schema ({}) accepts anything; an object schema without `type` is still an object.
      if (schema.properties !== undefined) {
        checkObject(schema, value, at, errors);
      }
      break;
  }
}

function checkString(schema: Schema, value: unknown, at: string, errors: string[]): void {
  if (typeof value !== 'string') {
    errors.push(`${at}: expected string, got ${JSON.stringify(value)}`);

    return;
  }
  if (schema.format === 'uuid' && !UUID.test(value)) {
    errors.push(`${at}: "${value}" is not a uuid`);
  }
  if (schema.format === 'date-time' && Number.isNaN(Date.parse(value))) {
    errors.push(`${at}: "${value}" is not a date-time`);
  }
}

function checkObject(schema: Schema, value: unknown, at: string, errors: string[]): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push(`${at}: expected an object, got ${JSON.stringify(value)}`);

    return;
  }
  const fields = new Map<string, unknown>(Object.entries(value));
  const properties = schema.properties ?? {};
  for (const key of schema.required ?? []) {
    if (!fields.has(key)) {
      errors.push(`${at}.${key}: required by the spec, missing in the response`);
    }
  }
  for (const [key, child] of fields) {
    const propertySchema = properties[key];
    if (propertySchema !== undefined) {
      check(propertySchema, child, `${at}.${key}`, errors);
    } else if (typeof schema.additionalProperties === 'object') {
      check(schema.additionalProperties, child, `${at}.${key}`, errors);
    } else if (schema.additionalProperties !== true && schema.properties !== undefined) {
      errors.push(`${at}.${key}: in the response, not declared in the spec`);
    }
  }
}
