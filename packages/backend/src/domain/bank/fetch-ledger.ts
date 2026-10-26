import type { BankAccountId, BankConnectionId, HouseholdId, SyncRunId } from './entities.js';

export type FetchCallKind = 'transactions' | 'balances' | 'details';

export interface FetchLedgerEntry {
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly connectionId: BankConnectionId;
  readonly at: Date;
  readonly callKind: FetchCallKind;
  readonly attended: boolean;
  readonly httpStatus: number | null;
  readonly errorCode: string | null;
  readonly syncRunId: SyncRunId | null;
}

/** Append-only record of provider calls, the input of the rate-limit budget (plan-banking 1.8). */
export interface BankFetchLedgerRepository {
  record(entry: FetchLedgerEntry): Promise<void>;
  /** Number of unattended calls of one kind for an account since a point in time. */
  countUnattendedSince(
    accountId: BankAccountId,
    callKind: FetchCallKind,
    since: Date,
  ): Promise<number>;
}

export interface AccountIdentity {
  readonly identificationHash: string;
  readonly providerAccountUid: string | null;
}

/** The stable, per-household identity of a bank account (plan-banking 1.10). */
export interface BankAccountIdentityRepository {
  setIdentity(
    accountId: BankAccountId,
    identity: AccountIdentity,
    householdId: HouseholdId,
  ): Promise<void>;
  findByIdentificationHash(
    identificationHash: string,
    householdId: HouseholdId,
  ): Promise<BankAccountId | null>;
}
