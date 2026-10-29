import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateUserProfileDto } from '../users.dto.js';

async function failedFields(body: object): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateUserProfileDto, body));

  return errors.map((error) => error.property);
}

describe('UpdateUserProfileDto', () => {
  it('accepts a patch without the tracked currencies', async () => {
    expect(await failedFields({ displayName: 'Anna' })).toEqual([]);
  });

  it('accepts a list of tracked currencies', async () => {
    expect(await failedFields({ interestingCurrencies: ['USD', 'GBP'] })).toEqual([]);
  });

  it('rejects null tracked currencies instead of letting it reach the update', async () => {
    expect(await failedFields({ interestingCurrencies: null })).toEqual(['interestingCurrencies']);
  });

  it('rejects a null completion flag', async () => {
    expect(await failedFields({ onboardingCompleted: null })).toEqual(['onboardingCompleted']);
  });
});
