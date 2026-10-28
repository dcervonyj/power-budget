import { EncryptedString } from '@power-budget/core';
import type {
  BankProvider,
  BankCatalogEntry,
  BankConsentStatusReport,
  CountryCode,
  RawBalance,
  RawBankAccount,
  RawTransaction,
  BankId,
} from '../../domain/bank/entities.js';
import type {
  BankConnector,
  FetchBalancesInput,
  FetchTransactionsInput,
} from '../../domain/bank/ports.js';
import type { BankConnectionId } from '@power-budget/core';

export interface InMemoryBankClock {
  now(): Date;
}

const SYSTEM_CLOCK: InMemoryBankClock = {
  now(): Date {
    return new Date();
  },
};

/** What the bank answers for an account from `from` on, until the account's next snapshot. */
export interface InMemoryBankSnapshot {
  readonly from: Date;
  readonly transactions: readonly RawTransaction[];
}

/** A scripted account: its snapshots over time (any order) and its balances. */
export interface InMemoryBankAccountScript {
  readonly account: RawBankAccount;
  readonly snapshots: readonly InMemoryBankSnapshot[];
  readonly balances: readonly RawBalance[];
}

const CONSENT_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A BankConnector for tests and for environments without provider credentials. Script accounts
 * with `scriptAccount` (see InMemoryBankScenarios for pending → booked and pending → cancelled)
 * and drive time with the clock: each fetch returns the latest snapshot at `clock.now()`.
 */
export class InMemoryBankConnector implements BankConnector {
  private readonly catalog: BankCatalogEntry[] = [
    { bankId: 'PKO_PLPKOPPLPW', name: 'PKO BP', countryCode: 'PL', logoUrl: null },
    { bankId: 'MBANK_BREXPLPW', name: 'mBank', countryCode: 'PL', logoUrl: null },
  ];

  private readonly scripts = new Map<string, InMemoryBankAccountScript>();
  private consentStatus: BankConsentStatusReport = { status: 'active', validUntil: null };
  /** Keeps consent refs unique when two consents start in the same millisecond. */
  private consentSequence = 0;

  constructor(
    readonly provider: BankProvider = 'gocardless',
    private readonly clock: InMemoryBankClock = SYSTEM_CLOCK,
  ) {}

  /** Adds or replaces the script of one account (keyed by its external id). */
  scriptAccount(script: InMemoryBankAccountScript): void {
    this.scripts.set(script.account.externalId, script);
  }

  setConsentStatus(report: BankConsentStatusReport): void {
    this.consentStatus = report;
  }

  async listSupportedBanks(country: CountryCode): Promise<BankCatalogEntry[]> {
    return this.catalog.filter((e) => e.countryCode === country);
  }

  async initiateConsent(input: {
    userId: string;
    bankId: BankId;
    redirectUri: string;
    historyDays: number;
  }): Promise<{ consentUrl: string; externalConsentRef: string }> {
    this.consentSequence += 1;
    const ref = `inmem-ref-${input.bankId}-${this.clock.now().getTime()}-${this.consentSequence}`;

    return {
      consentUrl: `https://mock.gocardless.test/consent?ref=${ref}&redirect=${encodeURIComponent(input.redirectUri)}`,
      externalConsentRef: ref,
    };
  }

  async completeConsent(input: {
    externalConsentRef: string;
    callbackPayload: Record<string, string>;
  }): Promise<{ consentToken: EncryptedString; expiresAt: Date | null }> {
    return {
      consentToken: EncryptedString.of(`inmem-token:${input.externalConsentRef}`),
      expiresAt: new Date(this.clock.now().getTime() + CONSENT_DAYS * DAY_MS),
    };
  }

  async listAccounts(): Promise<RawBankAccount[]> {
    const accounts: RawBankAccount[] = [];
    for (const script of this.scripts.values()) {
      accounts.push(script.account);
    }

    return accounts;
  }

  async fetchTransactions(input: FetchTransactionsInput): Promise<RawTransaction[]> {
    const script = this.scripts.get(input.account.externalId);
    if (script === undefined) {
      return [];
    }

    const snapshot = this.snapshotAt(script, this.clock.now());
    if (snapshot === undefined) {
      return [];
    }
    if (input.strategy === 'longest') {
      return [...snapshot.transactions];
    }

    const dateFrom = input.dateFrom.toISOString().slice(0, 10);
    const result: RawTransaction[] = [];
    for (const tx of snapshot.transactions) {
      if (this.isOnOrAfter(tx, dateFrom)) {
        result.push(tx);
      }
    }

    return result;
  }

  async fetchBalances(input: FetchBalancesInput): Promise<RawBalance[]> {
    const script = this.scripts.get(input.account.externalId);
    if (script === undefined) {
      return [];
    }

    return [...script.balances];
  }

  async getConsentStatus(): Promise<BankConsentStatusReport> {
    return this.consentStatus;
  }

  async refreshConsent(connectionId: BankConnectionId): Promise<{ consentUrl: string }> {
    return { consentUrl: `https://mock.gocardless.test/consent?reconnect=${connectionId}` };
  }

  async disconnect(): Promise<void> {
    // no-op in memory
  }

  /** The snapshot with the latest `from` that is not after `now`. */
  private snapshotAt(
    script: InMemoryBankAccountScript,
    now: Date,
  ): InMemoryBankSnapshot | undefined {
    let current: InMemoryBankSnapshot | undefined;
    for (const snapshot of script.snapshots) {
      const started = snapshot.from.getTime() <= now.getTime();
      if (started && (current === undefined || snapshot.from.getTime() > current.from.getTime())) {
        current = snapshot;
      }
    }

    return current;
  }

  /** Banks filter on the economic date; a row with no date at all is always returned. */
  private isOnOrAfter(tx: RawTransaction, dateFrom: string): boolean {
    const date = tx.transactionDate ?? tx.bookingDate ?? tx.valueDate;

    return date === null || date >= dateFrom;
  }
}
