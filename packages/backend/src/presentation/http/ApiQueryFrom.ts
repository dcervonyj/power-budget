import { applyDecorators, type Type } from '@nestjs/common';
import { ApiQuery, DECORATORS, type ApiQueryOptions } from '@nestjs/swagger';

/**
 * Documents every `@ApiProperty` of a query DTO as a named query parameter (audit FE-14). tsx/swc
 * emit no decorator metadata, so Swagger cannot see the type of `@Query() query: Dto` and the
 * spec (and the generated `api-types`) had no query parameters. `@ApiQuery({ type: Dto })` would
 * flatten the DTO but drops every `enum`, so each property becomes its own `@ApiQuery` here; the
 * DTO stays the single source of the names, types, enums and descriptions.
 */
export function ApiQueryFrom(dto: Type<unknown>): MethodDecorator {
  return applyDecorators(...queryParametersOf(dto).map(toApiQuery));
}

function queryParametersOf(dto: Type<unknown>): ApiQueryOptions[] {
  const keys: unknown = Reflect.getMetadata(DECORATORS.API_MODEL_PROPERTIES_ARRAY, dto.prototype);
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error(`${dto.name} has no @ApiProperty to document as query parameters`);
  }

  return keys.filter(isPropertyKey).map((key) => queryParameterOf(dto, key.slice(1)));
}

/** Swagger stores each property as `:<name>`. */
function isPropertyKey(key: unknown): key is string {
  return typeof key === 'string' && key.startsWith(':');
}

function queryParameterOf(dto: Type<unknown>, name: string): ApiQueryOptions {
  const metadata: unknown = Reflect.getMetadata(
    DECORATORS.API_MODEL_PROPERTIES,
    dto.prototype,
    name,
  );
  if (!isRecord(metadata)) {
    throw new Error(`${dto.name}.${name} has no @ApiProperty metadata`);
  }
  const { type, description, example } = metadata;
  const values = metadata['enum'];

  return {
    name,
    required: metadata['required'] === true,
    ...(typeof type === 'function' ? { type } : {}),
    ...(Array.isArray(values) ? { enum: values.filter(isEnumValue) } : {}),
    ...(typeof description === 'string' ? { description } : {}),
    ...(example === undefined ? {} : { example }),
  };
}

function toApiQuery(options: ApiQueryOptions): MethodDecorator {
  return ApiQuery(options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isEnumValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}
