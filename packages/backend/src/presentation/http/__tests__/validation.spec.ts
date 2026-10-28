import { describe, it, expect } from 'vitest';
import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { createValidationPipe } from '../validation.js';
import {
  AddManualTransactionDto,
  ListTransactionsQueryDto,
  TRANSACTIONS_PAGE_MAX,
} from '../../transactions/dto/transactions.dto.js';
import { UnplannedQueryDto } from '../../plans/dto/plan-dashboard.dto.js';

const ACCOUNT_ID = '01900000-0000-7000-8000-0000000000d1';
const BODY: ArgumentMetadata = { type: 'body', metatype: AddManualTransactionDto };
const LIST_QUERY: ArgumentMetadata = { type: 'query', metatype: ListTransactionsQueryDto };
const UNPLANNED_QUERY: ArgumentMetadata = { type: 'query', metatype: UnplannedQueryDto };

const VALID_TX = {
  accountId: ACCOUNT_ID,
  occurredOn: '2024-06-15',
  amountMinor: '-1500',
  currency: 'PLN',
  description: 'Coffee',
};

async function rejection(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
  try {
    await createValidationPipe().transform(value, metadata);
  } catch (error) {
    return error instanceof BadRequestException ? error.getResponse() : error;
  }
  throw new Error('expected the pipe to reject the value');
}

describe('global ValidationPipe', () => {
  it('accepts a valid manual transaction and keeps the amount as a string', async () => {
    const dto = await createValidationPipe().transform(VALID_TX, BODY);

    expect(dto).toBeInstanceOf(AddManualTransactionDto);
    expect(dto).toMatchObject({ amountMinor: '-1500', currency: 'PLN' });
  });

  it('normalises a safe JSON integer amount to a string', async () => {
    const dto = await createValidationPipe().transform({ ...VALID_TX, amountMinor: 1500 }, BODY);

    expect(dto).toMatchObject({ amountMinor: '1500' });
  });

  it('rejects bad fields with per-field messages and code validation_failed', async () => {
    const response = await rejection(
      { ...VALID_TX, accountId: 'nope', amountMinor: 12.5, currency: 'XXX' },
      BODY,
    );

    expect(response).toEqual({
      code: 'validation_failed',
      message: 'Validation failed',
      errors: [
        { field: 'accountId', messages: ['accountId must be a UUID'] },
        {
          field: 'amountMinor',
          messages: ['amountMinor must be an integer amount in minor units'],
        },
        { field: 'currency', messages: [expect.stringContaining('currency must be one of')] },
      ],
    });
  });

  it('rejects properties that are not on the DTO', async () => {
    const response = await rejection({ ...VALID_TX, householdId: 'someone-else' }, BODY);

    expect(response).toEqual({
      code: 'validation_failed',
      message: 'Validation failed',
      errors: [{ field: 'householdId', messages: ['property householdId should not exist'] }],
    });
  });

  it('converts and clamps the page size, and parses booleans', async () => {
    const dto = await createValidationPipe().transform(
      { limit: '100000', unmappedOnly: 'true', mapped: 'true', transfer: 'false' },
      LIST_QUERY,
    );

    expect(dto).toMatchObject({
      limit: TRANSACTIONS_PAGE_MAX,
      unmappedOnly: true,
      mapped: true,
      transfer: false,
    });
  });

  it('rejects a non-numeric or non-positive page size', async () => {
    expect(await rejection({ limit: 'abc' }, LIST_QUERY)).toMatchObject({
      errors: [{ field: 'limit' }],
    });
    expect(await rejection({ limit: '0' }, LIST_QUERY)).toMatchObject({
      errors: [{ field: 'limit', messages: ['limit must not be less than 1'] }],
    });
  });

  it('accepts the category, currency and source filters (CLN-050)', async () => {
    const dto = await createValidationPipe().transform(
      { categoryId: ACCOUNT_ID, currency: 'EUR', source: 'enable_banking' },
      LIST_QUERY,
    );

    expect(dto).toMatchObject({
      categoryId: ACCOUNT_ID,
      currency: 'EUR',
      source: 'enable_banking',
    });
  });

  it('rejects an unknown category id, currency or source', async () => {
    const response = await rejection(
      { categoryId: 'groceries', currency: 'XYZ', source: 'gocardless' },
      LIST_QUERY,
    );

    expect(response).toEqual({
      code: 'validation_failed',
      message: 'Validation failed',
      errors: [
        { field: 'categoryId', messages: ['categoryId must be a UUID'] },
        { field: 'currency', messages: [expect.stringContaining('currency must be one of')] },
        {
          field: 'source',
          messages: [
            'source must be one of the following values: bank_sync, enable_banking, wise_webhook, pko_email, iko_push, manual',
          ],
        },
      ],
    });
  });

  it('rejects an unknown direction for unplanned transactions', async () => {
    expect(await rejection({ direction: 'sideways' }, UNPLANNED_QUERY)).toEqual({
      code: 'validation_failed',
      message: 'Validation failed',
      errors: [
        {
          field: 'direction',
          messages: ['direction must be one of the following values: income, expense'],
        },
      ],
    });
  });
});
