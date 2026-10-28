import { afterEach, describe, expect, it, vi } from 'vitest';
import { BankConnectionId, EncryptedString } from '@power-budget/core';
import type { Encryption } from '../../domain/auth/ports.js';
import { BankTransientError } from '../../domain/bank/errors.js';
import { GoCardlessBankConnector } from './GoCardlessBankConnector.js';

const CONSENT = EncryptedString.of('enc:{"requisitionId":"req-1","accounts":["acct-1"]}');

const CONNECTION_ID = BankConnectionId.of('01890a5d-ac96-774b-bcce-b302099a8061');

const encryption: Encryption = {
  encrypt: vi.fn(async (plaintext: string) => EncryptedString.of(`enc:${plaintext}`)),
  decrypt: vi.fn(async (ciphertext: string) => ciphertext.slice(4)),
};

function stubAccountDetails(account: Record<string, unknown>): void {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      calls += 1;
      const payload =
        calls === 1
          ? { access: 'a', refresh: 'r', access_expires: 86400, refresh_expires: 2592000 }
          : { account };

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(payload),
        text: () => Promise.resolve(JSON.stringify(payload)),
      });
    }),
  );
}

function connector(): GoCardlessBankConnector {
  return new GoCardlessBankConnector(
    'secret-id',
    'secret-key',
    encryption,
    'https://test.gocardless.test/api/v2',
  );
}

describe('GoCardlessBankConnector.listAccounts', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the currency the provider reports', async () => {
    stubAccountDetails({ name: 'Main', iban: 'PL1', currency: 'EUR' });

    const [account] = await connector().listAccounts(CONNECTION_ID, CONSENT);

    expect(account?.currency).toBe('EUR');
  });

  it('throws instead of defaulting an account without a currency', async () => {
    stubAccountDetails({ name: 'Main', iban: 'PL1' });

    await expect(connector().listAccounts(CONNECTION_ID, CONSENT)).rejects.toBeInstanceOf(
      BankTransientError,
    );
  });
});
