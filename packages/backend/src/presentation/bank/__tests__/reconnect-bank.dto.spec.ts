import 'reflect-metadata';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ReconnectBankDto } from '../dto/bank.dto.js';

function dtoWith(redirectUri: string | undefined): ReconnectBankDto {
  const dto = new ReconnectBankDto();
  if (redirectUri !== undefined) {
    dto.redirectUri = redirectUri;
  }

  return dto;
}

describe('ReconnectBankDto', () => {
  it('accepts a redirect URI', async () => {
    expect(await validate(dtoWith('https://app.example/connect/callback'))).toEqual([]);
  });

  it('rejects a missing redirect URI instead of defaulting one', async () => {
    const errors = await validate(dtoWith(undefined));

    expect(errors.map((error) => error.property)).toEqual(['redirectUri']);
  });
});
