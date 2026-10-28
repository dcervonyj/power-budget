import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { toLocalIsoDate } from '@power-budget/core';
import type {
  AccountDto,
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
} from '@power-budget/shared-app/contract';
import { buildAddExpenseData, UNPLANNED_ID } from './addExpenseData.js';
import type { AddExpenseData } from './addExpenseData.js';
import { pendingCategory } from './addExpenseRecovery.js';
import { typedAmountMinor } from './addExpenseImpact.js';
import type { AddExpenseStatus } from './addExpenseModel.js';
import type { AddExpenseApi, NewExpense } from './AddExpenseApi.js';

/** The reads the container needs; the screen wires them to the real API clients. */
export interface AddExpenseGateway {
  readonly activePlans: () => Promise<PlanDto[]>;
  readonly dashboard: (planId: string) => Promise<PlanDashboardResponseDto>;
  readonly categories: () => Promise<CategoryDto[]>;
  readonly accounts: () => Promise<AccountDto[]>;
  readonly api: AddExpenseApi;
}

export type AddExpenseLoad =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | { readonly kind: 'no-plan' }
  | { readonly kind: 'ready'; readonly data: AddExpenseData };

export interface AddExpenseState {
  readonly load: AddExpenseLoad;
  readonly typed: string;
  readonly categoryId: string;
  readonly accountId: string;
  readonly status: AddExpenseStatus;
  readonly unsorted: boolean;
  readonly error: string | null;
  readonly today: string;
  readonly setTyped: (typed: string) => void;
  readonly setCategoryId: (categoryId: string) => void;
  readonly setAccountId: (accountId: string) => void;
  readonly reload: () => void;
  readonly save: () => void;
  readonly undo: () => void;
  readonly addAnother: () => void;
  readonly retryRefresh: () => void;
  readonly retryCategory: () => void;
}

/** Loads the plan, categories and accounts, and runs save / undo / add another. */
export function useAddExpense(sources: AddExpenseGateway): AddExpenseState {
  const intl = useIntl();
  const [load, setLoad] = useState<AddExpenseLoad>({ kind: 'loading' });
  const [typed, setTypedRaw] = useState('');
  const [categoryId, setCategoryIdRaw] = useState('');
  const [accountId, setAccountIdRaw] = useState('');
  const [status, setStatus] = useState<AddExpenseStatus>('editing');
  const statusRef = useRef<AddExpenseStatus>('editing');
  const changeStatus = useCallback((next: AddExpenseStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [today, setToday] = useState(() => toLocalIsoDate(new Date()));
  const [unsorted, setUnsorted] = useState(false);
  const requestId = useRef(0);
  const unplannedName = intl.formatMessage({
    id: 'add.category.unplannedName',
    defaultMessage: 'Unplanned',
  });

  /** Reopening Add expense after leaving with a half-saved expense shows it again, not a blank form. */
  const restorePending = useCallback(
    (data: AddExpenseData) => {
      const pending = pendingCategory.current;
      if (pending === null || !data.categories.some((option) => option.id === pending.categoryId)) {
        return;
      }
      setTypedRaw(pending.typed);
      setCategoryIdRaw(pending.categoryId);
      setAccountIdRaw(pending.accountId);
      setSavedId(pending.transactionId);
      setUnsorted(true);
      changeStatus('saved');
    },
    [changeStatus],
  );

  useEffect(() => {
    let active = true;
    setLoad({ kind: 'loading' });
    void loadData(sources, unplannedName).then(
      (next) => {
        if (!active) {
          return;
        }
        setLoad(next);
        if (next.kind === 'ready') {
          setCategoryIdRaw(next.data.categories[0]?.id ?? UNPLANNED_ID);
          setAccountIdRaw(next.data.accounts[0]?.id ?? '');
          restorePending(next.data);
        }
      },
      () => {
        if (active) {
          setLoad({ kind: 'failed' });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [sources, unplannedName, attempt, restorePending]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const locked = status !== 'editing';
  const setTyped = useCallback(
    (next: string) => {
      if (!locked) {
        setTypedRaw(next);
      }
    },
    [locked],
  );
  const setCategoryId = useCallback(
    (next: string) => {
      if (!locked) {
        setCategoryIdRaw(next);
      }
    },
    [locked],
  );
  const setAccountId = useCallback(
    (next: string) => {
      if (!locked) {
        setAccountIdRaw(next);
      }
    },
    [locked],
  );

  const save = useCallback(() => {
    if (load.kind !== 'ready' || statusRef.current !== 'editing') {
      return;
    }
    const category = load.data.categories.find((option) => option.id === categoryId);
    const account = load.data.accounts.find((option) => option.id === accountId);
    if (category === undefined || account === undefined) {
      return;
    }
    changeStatus('saving');
    setError(null);
    void persist(sources.api, {
      accountId: account.id,
      occurredOn: toLocalIsoDate(new Date()),
      spentMinor: typedAmountMinor(typed, account.currency),
      currency: account.currency,
      description: category.name,
      plannedItemId: category.plannedItemId,
    }).then(
      (result) => {
        pendingCategory.current = result.mapped
          ? null
          : { transactionId: result.id, typed, categoryId, accountId };
        setSavedId(result.id);
        setUnsorted(!result.mapped);
        changeStatus('saved');
      },
      () => {
        setError(
          intl.formatMessage({
            id: 'add.error.save',
            defaultMessage: 'Could not save the expense. Try again.',
          }),
        );
        changeStatus('editing');
      },
    );
  }, [accountId, categoryId, intl, load, sources.api, typed]);

  /**
   * One rule for every dashboard read: each refresh takes a ticket and only the latest ticket
   * lands, so an older read can never overwrite newer totals. A background refresh (`force`
   * false) also only lands while editing: once an expense is saved the Saved view applies it
   * on top of the totals it was saved against, so fresher totals that contain it would count
   * it twice. Resolves true when the totals were read (landed or superseded), false on failure.
   */
  const refresh = useCallback(
    (force: boolean): Promise<boolean> => {
      requestId.current += 1;
      const ticket = requestId.current;

      return loadData(sources, unplannedName).then(
        (next) => {
          if (next.kind !== 'ready') {
            return false;
          }
          if (ticket === requestId.current && (force || statusRef.current === 'editing')) {
            setLoad(next);
          }

          return true;
        },
        () => false,
      );
    },
    [sources, unplannedName],
  );

  /** Refreshes with editing locked; only a successful latest refresh unlocks it. */
  const refreshThenEdit = useCallback(
    (resetAmount: boolean) => {
      setError(null);
      changeStatus('refreshing');
      const ticket = requestId.current + 1;
      void refresh(true).then((ok) => {
        if (ticket !== requestId.current) {
          return;
        }
        if (!ok) {
          setError(refreshError(intl));
          changeStatus('stale');

          return;
        }
        if (resetAmount) {
          setTypedRaw('');
        }
        pendingCategory.current = null;
        setSavedId(null);
        setUnsorted(false);
        changeStatus('editing');
      });
    },
    [changeStatus, intl, refresh],
  );

  const undo = useCallback(() => {
    if (savedId === null || status !== 'saved') {
      return;
    }
    setError(null);
    changeStatus('undoing');
    void sources.api.undo(savedId).then(
      () => {
        pendingCategory.current = null;
        refreshThenEdit(false);
      },
      () => {
        setError(
          intl.formatMessage({
            id: 'add.error.undo',
            defaultMessage: 'Could not undo the expense. Try again.',
          }),
        );
        changeStatus('saved');
      },
    );
  }, [changeStatus, intl, refreshThenEdit, savedId, sources.api, status]);

  const refreshOrWarn = useCallback(() => {
    if (statusRef.current !== 'editing') {
      return;
    }
    void refresh(false).then((ok) => {
      if (!ok) {
        setError(refreshError(intl));
      }
    });
  }, [intl, refresh]);

  const addAnother = useCallback(() => {
    if (status !== 'saved') {
      return;
    }
    refreshThenEdit(true);
  }, [refreshThenEdit, status]);

  const retryCategory = useCallback(() => {
    if (statusRef.current !== 'saved' || savedId === null || load.kind !== 'ready') {
      return;
    }
    const plannedItemId = load.data.categories.find(
      (option) => option.id === categoryId,
    )?.plannedItemId;
    if (plannedItemId === undefined || plannedItemId === null) {
      return;
    }
    setError(null);
    changeStatus('mapping');
    void sources.api.map(savedId, plannedItemId).then(
      () => {
        pendingCategory.current = null;
        setUnsorted(false);
        changeStatus('saved');
      },
      () => {
        setError(
          intl.formatMessage({
            id: 'add.error.category',
            defaultMessage: 'Could not apply the category. Try again.',
          }),
        );
        changeStatus('saved');
      },
    );
  }, [categoryId, changeStatus, intl, load, savedId, sources.api]);

  const retryRefresh = useCallback(() => {
    if (status !== 'stale') {
      return;
    }
    refreshThenEdit(true);
  }, [refreshThenEdit, status]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') {
        return;
      }
      setToday(toLocalIsoDate(new Date()));
      refreshOrWarn();
    });

    return () => {
      subscription.remove();
    };
  }, [refreshOrWarn]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setToday(toLocalIsoDate(new Date()));
      refreshOrWarn();
    }, millisUntilNextMidnight(new Date()));

    return () => {
      clearTimeout(timer);
    };
  }, [refreshOrWarn, today]);

  return {
    load,
    typed,
    categoryId,
    accountId,
    status,
    unsorted,
    error,
    today,
    setTyped,
    setCategoryId,
    setAccountId,
    reload,
    save,
    undo,
    addAnother,
    retryRefresh,
    retryCategory,
  };
}

async function loadData(
  sources: AddExpenseGateway,
  unplannedName: string,
): Promise<AddExpenseLoad> {
  const [plan] = await sources.activePlans();
  if (plan === undefined) {
    return { kind: 'no-plan' };
  }
  const [dashboard, categories, accounts] = await Promise.all([
    sources.dashboard(plan.id),
    sources.categories(),
    sources.accounts(),
  ]);

  return {
    kind: 'ready',
    data: buildAddExpenseData({ plan, dashboard, categories, accounts, unplannedName }),
  };
}

interface Persisted {
  readonly id: string;
  /** False when the transaction exists but the planned item could not be attached. */
  readonly mapped: boolean;
}

/**
 * Creates the transaction once. If only the mapping fails the expense is already saved and is
 * never posted again; Retry category re-sends the (idempotent) mapping for the same id.
 */
async function persist(api: AddExpenseApi, expense: NewExpense): Promise<Persisted> {
  const transaction = await api.create(expense);
  if (expense.plannedItemId === null) {
    return { id: transaction.id, mapped: true };
  }
  try {
    await api.map(transaction.id, expense.plannedItemId);
  } catch {
    return {
      id: transaction.id,
      mapped: await mappedOnServer(api, transaction.id, expense.plannedItemId),
    };
  }

  return { id: transaction.id, mapped: true };
}

/** A lost mapping response may still have been applied, so ask the server before saying it was not. */
async function mappedOnServer(
  api: AddExpenseApi,
  transactionId: string,
  plannedItemId: string,
): Promise<boolean> {
  try {
    return (await api.mappedTo(transactionId)) === plannedItemId;
  } catch {
    return false;
  }
}

function refreshError(intl: IntlShape): string {
  return intl.formatMessage({
    id: 'add.error.refresh',
    defaultMessage: 'Could not refresh your plan. Try again.',
  });
}

/** Milliseconds from `now` to the next local midnight, so the date can roll over while open. */
function millisUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return next.getTime() - now.getTime();
}
