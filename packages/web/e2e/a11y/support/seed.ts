import type { APIResponse } from '@playwright/test';
import type { BackendApi } from '../../support/api.js';

function localToday(): string {
  const now = new Date();

  return [
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/** A cash account with one transaction per description, through the API (as transactions.spec). */
export async function seedCashTransactions(
  api: BackendApi,
  accessToken: string,
  descriptions: readonly string[],
): Promise<string[]> {
  const account = await api.json<{ id: string }>(
    await api.post('/accounts', accessToken, { name: 'Cash', currency: 'PLN' }),
    201,
  );
  const ids: string[] = [];
  for (const description of descriptions) {
    const res: APIResponse = await api.post('/transactions', accessToken, {
      accountId: account.id,
      occurredOn: localToday(),
      amountMinor: '-1000',
      currency: 'PLN',
      description,
    });
    ids.push((await api.json<{ id: string }>(res, 201)).id);
  }

  return ids;
}
