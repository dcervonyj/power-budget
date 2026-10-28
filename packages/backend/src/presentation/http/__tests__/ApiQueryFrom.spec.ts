import { describe, expect, it } from 'vitest';
import { ApiPropertyOptional, DECORATORS } from '@nestjs/swagger';
import { ApiQueryFrom } from '../ApiQueryFrom.js';
import { ListTransactionsQueryDto } from '../../transactions/dto/transactions.dto.js';

class ColourQueryDto {
  @ApiPropertyOptional({ type: String, enum: ['red', 'blue'], description: 'Colour' })
  colour?: string;

  @ApiPropertyOptional({ type: Number, example: 5 })
  size?: number;
}

class NoPropertiesDto {}

class Endpoints {
  colours(): void {}

  transactions(): void {}
}

function documented(method: keyof Endpoints): unknown {
  return Reflect.getMetadata(DECORATORS.API_PARAMETERS, Endpoints.prototype[method]);
}

function documentedNames(method: keyof Endpoints): string[] {
  const parameters = documented(method);
  if (!Array.isArray(parameters)) {
    throw new Error(`${method} documents no parameters`);
  }

  return parameters.map(nameOf).sort();
}

function nameOf(parameter: unknown): string {
  return typeof parameter === 'object' && parameter !== null && 'name' in parameter
    ? String(parameter.name)
    : '';
}

describe('ApiQueryFrom', () => {
  it('documents each DTO property as a named optional query parameter, enums included', () => {
    ApiQueryFrom(ColourQueryDto)(
      Endpoints.prototype,
      'colours',
      Object.getOwnPropertyDescriptor(Endpoints.prototype, 'colours')!,
    );

    expect(documented('colours')).toEqual(
      expect.arrayContaining([
        {
          name: 'colour',
          in: 'query',
          required: false,
          type: String,
          description: 'Colour',
          schema: { type: 'string', enum: ['red', 'blue'] },
        },
        { name: 'size', in: 'query', required: false, type: Number, example: 5 },
      ]),
    );
  });

  it('documents the GET /transactions filters (audit FE-14)', () => {
    ApiQueryFrom(ListTransactionsQueryDto)(
      Endpoints.prototype,
      'transactions',
      Object.getOwnPropertyDescriptor(Endpoints.prototype, 'transactions')!,
    );

    expect(documentedNames('transactions')).toEqual(
      [
        'accountId',
        'categoryId',
        'currency',
        'cursor',
        'from',
        'limit',
        'mapped',
        'q',
        'source',
        'status',
        'to',
        'transfer',
        'unmappedOnly',
      ].sort(),
    );
  });

  it('refuses a DTO without documented properties', () => {
    expect(() => ApiQueryFrom(NoPropertiesDto)).toThrow(
      'NoPropertiesDto has no @ApiProperty to document as query parameters',
    );
  });
});
