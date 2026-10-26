import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AccountDto,
  BankConnectionDto,
  HouseholdMemberResponseDto,
  TransactionListItemDto,
  TransactionPageDto,
  UserProfileDto,
} from '@power-budget/shared-app/contract';
import { deferred } from '../../test/deferred.js';
import { ShellStore, summariseSync, type ShellApi } from './ShellStore.js';

const PROFILE: UserProfileDto = {
  id: 'user-anna',
  email: 'anna@example.com',
  displayName: 'Anna',
  locale: 'en',
  localePreference: null,
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  householdId: 'hh-1',
};

function member(userId: string, displayName: string, email: string): HouseholdMemberResponseDto {
  return { userId, email, displayName, role: 'member', joinedAt: '2026-10-01T10:00:00.000Z' };
}

function connection(id: string, status: BankConnectionDto['status']): BankConnectionDto {
  return {
    id,
    householdId: 'hh-1',
    userId: 'user-anna',
    provider: 'gocardless',
    bankId: 'PKO_BPKOPLPW',
    status,
    expiresAt: null,
    disconnectedAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function account(id: string, connectionId: string | null, lastSyncedAt: string | null): AccountDto {
  return {
    id,
    kind: connectionId === null ? 'manual' : 'bank',
    name: id,
    currency: 'PLN',
    connectionId,
    balance: null,
    lastSyncedAt,
    createdAt: '2026-06-01T00:00:00.000Z',
  };
}

function page(count: number, hasMore: boolean): TransactionPageDto {
  const items: TransactionListItemDto[] = [];
  for (let index = 0; index < count; index += 1) {
    items.push(transaction(`tx-${String(index)}`));
  }

  return { items, nextCursor: hasMore ? 'next' : null, hasMore };
}

function transaction(id: string): TransactionListItemDto {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-1890', currency: 'PLN' },
    description: 'Żabka',
    merchant: null,
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
    mapping: null,
    mappingSource: 'none',
    transfer: null,
  };
}

class FakeShellApi implements ShellApi {
  profileResult: Promise<UserProfileDto> | null = null;
  membersResult: Promise<HouseholdMemberResponseDto[]> | null = null;
  toSortResult: Promise<TransactionPageDto> | null = null;
  connectionsResult: Promise<BankConnectionDto[]> | null = null;
  accountsResult: Promise<AccountDto[]> | null = null;

  profile(): Promise<UserProfileDto> {
    return this.profileResult ?? failed();
  }

  members(): Promise<HouseholdMemberResponseDto[]> {
    return this.membersResult ?? failed();
  }

  toSortPage(): Promise<TransactionPageDto> {
    return this.toSortResult ?? failed();
  }

  bankConnections(): Promise<BankConnectionDto[]> {
    return this.connectionsResult ?? failed();
  }

  accounts(): Promise<AccountDto[]> {
    return this.accountsResult ?? failed();
  }
}

function failed<T>(): Promise<T> {
  return Promise.reject(new Error('404'));
}

describe('ShellStore', () => {
  let api: FakeShellApi;
  let store: ShellStore;

  beforeEach(() => {
    api = new FakeShellApi();
    store = new ShellStore(api);
  });

  it('reads you, your partner, the to-sort count and the sync summary', async () => {
    api.profileResult = Promise.resolve(PROFILE);
    api.membersResult = Promise.resolve([
      member('user-anna', 'Anna', 'anna@example.com'),
      member('user-marek', ' ', 'marek@example.com'),
    ]);
    api.toSortResult = Promise.resolve(page(3, false));
    api.connectionsResult = Promise.resolve([connection('conn-1', 'active')]);
    api.accountsResult = Promise.resolve([account('acc-1', 'conn-1', '2026-10-22T11:00:00.000Z')]);

    await store.load();

    expect(store.me).toEqual({ userId: 'user-anna', name: 'Anna' });
    expect(store.partner).toEqual({ userId: 'user-marek', name: 'marek@example.com' });
    expect(store.toSortCount).toBe(3);
    expect(store.sync).toEqual({
      kind: 'synced',
      lastSyncedAt: new Date('2026-10-22T11:00:00.000Z'),
    });
  });

  it('counts one more than the page when there are more to sort', async () => {
    api.toSortResult = Promise.resolve(page(100, true));

    await store.refresh();

    expect(store.toSortCount).toBe(101);
  });

  it('keeps every part hidden when its call fails', async () => {
    await store.load();

    expect(store.me).toBeNull();
    expect(store.partner).toBeNull();
    expect(store.toSortCount).toBeNull();
    expect(store.sync).toEqual({ kind: 'none' });
  });

  it('shows no sync chip when the accounts fail, instead of claiming the sync is stale', async () => {
    api.connectionsResult = Promise.resolve([connection('conn-1', 'active')]);

    await store.refresh();

    expect(store.sync).toEqual({ kind: 'none' });
  });

  it('keeps the last sync chip when a later refresh fails', async () => {
    api.connectionsResult = Promise.resolve([connection('conn-1', 'active')]);
    api.accountsResult = Promise.resolve([account('acc-1', 'conn-1', '2026-10-22T11:00:00.000Z')]);
    await store.refresh();
    api.accountsResult = null;
    api.toSortResult = null;

    await store.refresh();

    expect(store.sync).toEqual({
      kind: 'synced',
      lastSyncedAt: new Date('2026-10-22T11:00:00.000Z'),
    });
  });

  it('drops an older answer that lands after a newer one', async () => {
    const older = deferred<TransactionPageDto>();
    api.toSortResult = older.promise;
    const first = store.refresh();
    api.toSortResult = Promise.resolve(page(1, false));
    const second = store.refresh();
    await second;

    older.resolve(page(5, false));
    await first;

    expect(store.toSortCount).toBe(1);
  });

  it('has no partner in a household of one', async () => {
    api.profileResult = Promise.resolve(PROFILE);
    api.membersResult = Promise.resolve([member('user-anna', 'Anna', 'anna@example.com')]);

    await store.load();

    expect(store.me).toEqual({ userId: 'user-anna', name: 'Anna' });
    expect(store.partner).toBeNull();
  });

  it('forgets everything when the session ends', async () => {
    api.profileResult = Promise.resolve(PROFILE);
    api.membersResult = Promise.resolve([]);
    api.toSortResult = Promise.resolve(page(2, false));
    api.connectionsResult = Promise.resolve([connection('conn-1', 'expired')]);
    api.accountsResult = Promise.resolve([]);
    await store.load();
    expect(store.sync).toEqual({ kind: 'renew' });

    store.resetSession();

    expect(store.me).toBeNull();
    expect(store.toSortCount).toBeNull();
    expect(store.sync).toEqual({ kind: 'none' });
  });

  it("drops a late answer for the previous user's session", async () => {
    const late = deferred<TransactionPageDto>();
    api.toSortResult = late.promise;
    const refreshing = store.refresh();

    store.resetSession();
    late.resolve(page(4, false));
    await refreshing;

    expect(store.toSortCount).toBeNull();
  });
});

describe('summariseSync', () => {
  it('shows nothing without a live connection', () => {
    expect(summariseSync([], [])).toEqual({ kind: 'none' });
    expect(summariseSync([connection('c', 'disconnected')], [])).toEqual({ kind: 'none' });
  });

  it('asks to renew when a connection needs a new consent', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'reconnect_required')],
        [account('a1', 'c1', '2026-10-22T11:00:00.000Z')],
      ),
    ).toEqual({ kind: 'renew' });
  });

  it('shows the worst live connection, each as fresh as its newest account', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'active'), connection('c3', 'disconnected')],
        [
          account('a1', 'c1', '2026-10-22T09:00:00.000Z'),
          account('a2', 'c1', '2026-10-22T11:00:00.000Z'),
          account('b1', 'c2', '2026-10-19T08:00:00.000Z'),
          account('d1', 'c3', '2026-10-01T12:00:00.000Z'),
          account('cash', null, null),
        ],
      ),
    ).toEqual({ kind: 'synced', lastSyncedAt: new Date('2026-10-19T08:00:00.000Z') });
  });

  it('has no time before the first sync', () => {
    expect(summariseSync([connection('c1', 'active')], [account('a1', 'c1', null)])).toEqual({
      kind: 'synced',
      lastSyncedAt: null,
    });
  });

  it('lets a live connection that never synced outweigh a fresh one', () => {
    expect(
      summariseSync(
        [connection('c1', 'active'), connection('c2', 'active')],
        [account('a1', 'c1', '2026-10-22T11:00:00.000Z')],
      ),
    ).toEqual({ kind: 'synced', lastSyncedAt: null });
  });
});
