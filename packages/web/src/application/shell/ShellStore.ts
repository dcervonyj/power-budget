import { makeAutoObservable, runInAction } from 'mobx';
import type {
  AccountDto,
  BankConnectionDto,
  HouseholdMemberResponseDto,
  TransactionPageDto,
  UserProfileDto,
} from '@power-budget/shared-app/contract';
import type { SessionScoped } from '../auth/ClientSession.js';

export interface ShellPerson {
  readonly userId: string;
  readonly name: string;
}

/**
 * The viewer's own bank sync, as far as the header shows it. Only the caller's own connections
 * and accounts are readable (a partner's sync is not), so there is one summary, not one per person.
 */
export type ShellSync =
  | { readonly kind: 'none' }
  | { readonly kind: 'renew' }
  | { readonly kind: 'synced'; readonly lastSyncedAt: Date | null };

/** What the shell reads from the API (port; `HttpShellApi` is the adapter). */
export interface ShellApi {
  profile(): Promise<UserProfileDto>;
  members(): Promise<HouseholdMemberResponseDto[]>;
  /** The first page of transactions to sort (unmapped). */
  toSortPage(): Promise<TransactionPageDto>;
  bankConnections(): Promise<BankConnectionDto[]>;
  accounts(): Promise<AccountDto[]>;
}

/**
 * Data of the app shell (DSN-017): who is signed in and their partner (avatar pair), how many
 * transactions wait to be sorted (header badge) and the bank sync summary (sync chip). Every
 * part loads on its own; a part that fails stays hidden instead of showing a guess.
 */
export class ShellStore implements SessionScoped {
  me: ShellPerson | null = null;
  partner: ShellPerson | null = null;
  /** Transactions to sort; null until known. Above TO_SORT_PAGE - 1 the exact number is unknown. */
  toSortCount: number | null = null;
  sync: ShellSync = { kind: 'none' };

  private readonly api: ShellApi;
  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;
  /** Latest request per part: an older answer that lands after a newer one is dropped. */
  private toSortRequest = 0;
  private syncRequest = 0;

  constructor(api: ShellApi) {
    this.api = api;
    makeAutoObservable<ShellStore, 'api' | 'session' | 'toSortRequest' | 'syncRequest'>(this, {
      api: false,
      session: false,
      toSortRequest: false,
      syncRequest: false,
    });
  }

  /** Everything the shell shows; called when the shell mounts. */
  async load(): Promise<void> {
    await Promise.all([this.loadPeople(), this.refresh()]);
  }

  /** The parts that change while the user works: the to-sort count and the sync summary. */
  async refresh(): Promise<void> {
    await Promise.all([this.loadToSort(), this.loadSync()]);
  }

  resetSession(): void {
    this.session += 1;
    this.me = null;
    this.partner = null;
    this.toSortCount = null;
    this.sync = { kind: 'none' };
  }

  private async loadPeople(): Promise<void> {
    const session = this.session;
    const [profile, members] = await Promise.all([
      this.api.profile().catch(nothing),
      this.api.members().catch(nothing),
    ]);
    if (session !== this.session) {
      return;
    }
    runInAction(() => {
      this.me = profile === null ? null : { userId: profile.id, name: nameOf(profile) };
      this.partner = partnerOf(members ?? [], profile?.id ?? null);
    });
  }

  private async loadToSort(): Promise<void> {
    const session = this.session;
    this.toSortRequest += 1;
    const request = this.toSortRequest;
    const page = await this.api.toSortPage().catch(nothing);
    if (session !== this.session || request !== this.toSortRequest || page === null) {
      return;
    }
    runInAction(() => {
      this.toSortCount = page.items.length + (page.hasMore ? 1 : 0);
    });
  }

  /**
   * Both reads must succeed to change the chip: without the accounts there are no sync times, and
   * guessing "stale" from a failed call would be a false claim. A failed refresh keeps the last chip.
   */
  private async loadSync(): Promise<void> {
    const session = this.session;
    this.syncRequest += 1;
    const request = this.syncRequest;
    const [connections, accounts] = await Promise.all([
      this.api.bankConnections().catch(nothing),
      this.api.accounts().catch(nothing),
    ]);
    if (session !== this.session || request !== this.syncRequest) {
      return;
    }
    if (connections === null || accounts === null) {
      return;
    }
    runInAction(() => {
      this.sync = summariseSync(connections, accounts);
    });
  }
}

/**
 * No live connection: nothing to show. A connection that needs a new consent wins (the user has
 * to act). Otherwise the worst live connection decides: each connection is as fresh as its newest
 * synced account, and the chip shows the oldest of those; a live connection without any synced
 * account yet makes it null (stale), so one fresh bank never hides a stuck one.
 */
export function summariseSync(
  connections: readonly BankConnectionDto[],
  accounts: readonly AccountDto[],
): ShellSync {
  const live = connections.filter(isNotDisconnected);
  if (live.length === 0) {
    return { kind: 'none' };
  }
  if (live.some(needsConsent)) {
    return { kind: 'renew' };
  }
  const perConnection = live.map((connection) => newestSyncOf(connection.id, accounts));
  if (perConnection.some(isUnknownTime)) {
    return { kind: 'synced', lastSyncedAt: null };
  }

  return { kind: 'synced', lastSyncedAt: new Date(Math.min(...perConnection)) };
}

/** Newest sync among the connection's accounts; NaN when none has synced yet. */
function newestSyncOf(connectionId: string, accounts: readonly AccountDto[]): number {
  const times = accounts
    .filter((account) => account.connectionId === connectionId)
    .map(lastSyncOf)
    .filter(isKnownTime);

  return times.length === 0 ? Number.NaN : Math.max(...times);
}

function nameOf(person: { readonly displayName: string; readonly email: string }): string {
  const name = person.displayName.trim();

  return name.length > 0 ? name : person.email;
}

function partnerOf(
  members: readonly HouseholdMemberResponseDto[],
  myUserId: string | null,
): ShellPerson | null {
  const partner = members.find((member) => member.userId !== myUserId);
  if (myUserId === null || partner === undefined) {
    return null;
  }

  return { userId: partner.userId, name: nameOf(partner) };
}

function nothing(): null {
  return null;
}

function isNotDisconnected(connection: BankConnectionDto): boolean {
  return connection.status !== 'disconnected';
}

function needsConsent(connection: BankConnectionDto): boolean {
  return connection.status === 'expired' || connection.status === 'reconnect_required';
}

function lastSyncOf(account: AccountDto): number {
  return account.lastSyncedAt === null ? Number.NaN : Date.parse(account.lastSyncedAt);
}

function isKnownTime(time: number): boolean {
  return !Number.isNaN(time);
}

function isUnknownTime(time: number): boolean {
  return Number.isNaN(time);
}
