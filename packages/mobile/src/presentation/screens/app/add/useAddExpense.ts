import { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { toLocalIsoDate } from '@power-budget/core';
import type {
  AccountDto,
  CategoryDto,
  PlanDashboardResponseDto,
  PlanDto,
} from '@power-budget/shared-app/contract';
import { buildAddExpenseData, UNPLANNED_ID } from './addExpenseData.js';
import type { AddExpenseData } from './addExpenseData.js';
import { typedAmountMinor } from './addExpenseImpact.js';
import type { AddExpenseStatus } from './addExpenseModel.js';
import type { AddExpenseApi } from './AddExpenseApi.js';

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
  readonly error: string | null;
  readonly today: string;
  readonly setTyped: (typed: string) => void;
  readonly setCategoryId: (categoryId: string) => void;
  readonly setAccountId: (accountId: string) => void;
  readonly reload: () => void;
  readonly save: () => void;
  readonly undo: () => void;
  readonly addAnother: () => void;
}

/** Loads the plan, categories and accounts, and runs save / undo / add another. */
export function useAddExpense(sources: AddExpenseGateway): AddExpenseState {
  const intl = useIntl();
  const [load, setLoad] = useState<AddExpenseLoad>({ kind: 'loading' });
  const [typed, setTyped] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [status, setStatus] = useState<AddExpenseStatus>('editing');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => toLocalIsoDate(new Date()));
  const unplannedName = intl.formatMessage({
    id: 'add.category.unplannedName',
    defaultMessage: 'Unplanned',
  });

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
          setCategoryId(next.data.categories[0]?.id ?? UNPLANNED_ID);
          setAccountId(next.data.accounts[0]?.id ?? '');
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
  }, [sources, unplannedName, attempt]);

  const reload = useCallback(() => {
    setAttempt((current) => current + 1);
  }, []);

  const save = useCallback(() => {
    if (load.kind !== 'ready' || status !== 'editing') {
      return;
    }
    const category = load.data.categories.find((option) => option.id === categoryId);
    const account = load.data.accounts.find((option) => option.id === accountId);
    if (category === undefined || account === undefined) {
      return;
    }
    setStatus('saving');
    setError(null);
    void sources.api
      .add({
        accountId: account.id,
        occurredOn: today,
        spentMinor: typedAmountMinor(typed, account.currency),
        currency: account.currency,
        description: category.name,
        plannedItemId: category.plannedItemId,
      })
      .then(
        (transaction) => {
          setSavedId(transaction.id);
          setStatus('saved');
        },
        () => {
          setError(
            intl.formatMessage({
              id: 'add.error.save',
              defaultMessage: 'Could not save the expense. Try again.',
            }),
          );
          setStatus('editing');
        },
      );
  }, [accountId, categoryId, intl, load, sources.api, status, today, typed]);

  const undo = useCallback(() => {
    if (savedId === null) {
      return;
    }
    setError(null);
    void sources.api.undo(savedId).then(
      () => {
        setSavedId(null);
        setStatus('editing');
      },
      () => {
        setError(
          intl.formatMessage({
            id: 'add.error.undo',
            defaultMessage: 'Could not undo the expense. Try again.',
          }),
        );
      },
    );
  }, [intl, savedId, sources.api]);

  const addAnother = useCallback(() => {
    setTyped('');
    setSavedId(null);
    setError(null);
    setStatus('editing');
  }, []);

  return {
    load,
    typed,
    categoryId,
    accountId,
    status,
    error,
    today,
    setTyped,
    setCategoryId,
    setAccountId,
    reload,
    save,
    undo,
    addAnother,
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
