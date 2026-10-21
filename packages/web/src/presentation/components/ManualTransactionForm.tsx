import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  CURRENCIES,
  isSupportedCurrency,
  parseMoney,
  toLocalIsoDate,
  type CurrencyCode,
} from '@power-budget/core';
import type {
  AccountDto,
  AddManualTransactionDto,
  CreateManualAccountDto,
  TransactionDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { useTheme } from './ThemeContext.js';

export interface ManualTransactionFormProps {
  onSuccess?: (transactionId: string) => void;
  onCancel?: () => void;
}

type Direction = 'expense' | 'income';
type FormError = 'required' | 'amount' | 'submit' | 'account';

const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES).filter(isSupportedCurrency);

function todayIso(): string {
  return toLocalIsoDate(new Date());
}

/**
 * Exact minor units as the API's integer string, signed by the direction; null when the
 * input is not a positive amount in the currency (core parseMoney, no floats).
 */
export function toSignedMinorUnits(
  amount: string,
  currency: CurrencyCode,
  direction: Direction,
): string | null {
  try {
    const minor = parseMoney(amount, currency);
    if (minor <= 0n) {
      return null;
    }

    return (direction === 'expense' ? -minor : minor).toString();
  } catch {
    return null;
  }
}

/** The manual (cash) account first: it is where hand-kept transactions belong. */
function preferredAccount(accounts: ReadonlyArray<AccountDto>): AccountDto | undefined {
  return accounts.find((account) => account.kind === 'manual') ?? accounts[0];
}

/**
 * Adds a transaction by hand on one of the caller's own accounts (`GET /accounts`). With
 * no account yet it first offers to create a cash account (`POST /accounts`). The currency
 * is the account's; the amount is typed in normal units and the date is local.
 */
export function ManualTransactionForm({
  onSuccess,
  onCancel,
}: ManualTransactionFormProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const [accounts, setAccounts] = useState<ReadonlyArray<AccountDto>>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);

  const [cashName, setCashName] = useState(() =>
    intl.formatMessage({
      id: 'component.manualTransactionForm.cashAccount.defaultName',
      defaultMessage: 'Cash',
    }),
  );
  const [cashCurrency, setCashCurrency] = useState<CurrencyCode>('PLN');
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [direction, setDirection] = useState<Direction>('expense');
  const [occurredOn, setOccurredOn] = useState(todayIso);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<FormError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<AccountDto[]>('/accounts');
        if (!cancelled) {
          setAccounts(res.data);
          setSelectedAccountId(preferredAccount(res.data)?.id ?? '');
        }
      } catch {
        if (!cancelled) {
          setAccountsError(true);
        }
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  const handleCreateAccount = async (): Promise<void> => {
    if (!cashName.trim()) {
      setError('required');

      return;
    }
    setError(null);
    setCreatingAccount(true);
    try {
      const body: CreateManualAccountDto = { name: cashName.trim(), currency: cashCurrency };
      const res = await apiClient.post<AccountDto>('/accounts', body);
      setAccounts([res.data]);
      setSelectedAccountId(res.data.id);
    } catch {
      setError('account');
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!description.trim() || selectedAccount === undefined || !amount.trim()) {
      setError('required');

      return;
    }
    const amountMinor = toSignedMinorUnits(amount, selectedAccount.currency, direction);
    if (amountMinor === null) {
      setError('amount');

      return;
    }

    setSubmitting(true);
    try {
      const body: AddManualTransactionDto = {
        accountId: selectedAccount.id,
        occurredOn,
        amountMinor,
        currency: selectedAccount.currency,
        description: description.trim(),
        notes: notes.trim() || null,
      };
      const res = await apiClient.post<TransactionDto>('/transactions', body);
      setAmount('');
      setDescription('');
      setNotes('');
      setOccurredOn(todayIso());
      onSuccess?.(res.data.id);
    } catch {
      setError('submit');
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    color: theme.color.text.secondary,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.space.xs,
    display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: `${String(theme.space.sm)}px ${String(theme.space.md)}px`,
    border: `1px solid ${theme.color.border.subtle}`,
    borderRadius: theme.radius.md,
    background: theme.color.surface.base,
    color: theme.color.text.primary,
    fontSize: theme.fontSize.md,
    boxSizing: 'border-box',
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.xs,
  };

  const primaryButtonStyle = (busy: boolean): React.CSSProperties => ({
    padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
    border: 'none',
    borderRadius: theme.radius.md,
    background: theme.color.accent.default,
    color: theme.color.accent.onAccent,
    fontSize: theme.fontSize.md,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.7 : 1,
  });

  const errorText = error === null ? null : errorMessageId(error);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.lg }}>
      {accountsLoading && (
        <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
          <FormattedMessage id="component.manualTransactionForm.loadingAccounts" />
        </span>
      )}

      {accountsError && (
        <span
          role="alert"
          style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}
        >
          <FormattedMessage id="component.manualTransactionForm.error.accounts" />
        </span>
      )}

      {!accountsLoading && !accountsError && accounts.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
          <p style={{ margin: 0, color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="component.manualTransactionForm.cashAccount.intro" />
          </p>
          <div style={{ display: 'flex', gap: theme.space.md, flexWrap: 'wrap' }}>
            <div style={{ ...fieldStyle, flex: '2 1 160px' }}>
              <label htmlFor="mtf-cash-name" style={labelStyle}>
                <FormattedMessage id="component.manualTransactionForm.cashAccount.name" />
              </label>
              <input
                id="mtf-cash-name"
                type="text"
                value={cashName}
                onChange={(e) => {
                  setCashName(e.target.value);
                }}
                style={inputStyle}
              />
            </div>
            <div style={{ ...fieldStyle, flex: '1 1 100px' }}>
              <label htmlFor="mtf-cash-currency" style={labelStyle}>
                <FormattedMessage id="component.manualTransactionForm.currency.label" />
              </label>
              <select
                id="mtf-cash-currency"
                value={cashCurrency}
                onChange={(e) => {
                  if (isSupportedCurrency(e.target.value)) {
                    setCashCurrency(e.target.value);
                  }
                }}
                style={inputStyle}
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                void handleCreateAccount();
              }}
              disabled={creatingAccount}
              style={primaryButtonStyle(creatingAccount)}
            >
              <FormattedMessage id="component.manualTransactionForm.cashAccount.create" />
            </button>
          </div>
        </div>
      )}

      {selectedAccount !== undefined && (
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}
        >
          <div style={fieldStyle}>
            <label htmlFor="mtf-account" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.account.label" />
            </label>
            <select
              id="mtf-account"
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
              }}
              style={inputStyle}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {intl.formatMessage(
                    {
                      id: 'component.manualTransactionForm.account.option',
                      defaultMessage: '{name} · {currency}',
                    },
                    { name: account.name, currency: account.currency },
                  )}
                </option>
              ))}
            </select>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="mtf-direction" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.direction.label" />
            </label>
            <select
              id="mtf-direction"
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value === 'income' ? 'income' : 'expense');
              }}
              style={inputStyle}
            >
              <option value="expense">
                {intl.formatMessage({ id: 'component.manualTransactionForm.direction.expense' })}
              </option>
              <option value="income">
                {intl.formatMessage({ id: 'component.manualTransactionForm.direction.income' })}
              </option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: theme.space.md }}>
            <div style={{ ...fieldStyle, flex: 2 }}>
              <label htmlFor="mtf-amount" style={labelStyle}>
                <FormattedMessage id="component.manualTransactionForm.amount.label" />
              </label>
              <input
                id="mtf-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                }}
                placeholder={intl.formatMessage({
                  id: 'component.manualTransactionForm.amount.placeholder',
                })}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ ...fieldStyle, flex: 1 }}>
              <span style={labelStyle}>
                <FormattedMessage id="component.manualTransactionForm.currency.label" />
              </span>
              <span
                data-testid="mtf-currency"
                style={{ ...inputStyle, background: 'transparent', border: 'none' }}
              >
                {selectedAccount.currency}
              </span>
            </div>
          </div>

          <div style={fieldStyle}>
            <label htmlFor="mtf-occurred-on" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.occurredOn.label" />
            </label>
            <input
              id="mtf-occurred-on"
              type="date"
              value={occurredOn}
              onChange={(e) => {
                setOccurredOn(e.target.value);
              }}
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="mtf-description" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.description.label" />
            </label>
            <input
              id="mtf-description"
              type="text"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              style={inputStyle}
              required
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="mtf-notes" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.notes.label" />
            </label>
            <textarea
              id="mtf-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
              }}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', gap: theme.space.md, justifyContent: 'flex-end' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                style={{
                  padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
                  border: `1px solid ${theme.color.border.subtle}`,
                  borderRadius: theme.radius.md,
                  background: 'transparent',
                  color: theme.color.text.primary,
                  fontSize: theme.fontSize.md,
                  cursor: 'pointer',
                }}
              >
                <FormattedMessage id="component.manualTransactionForm.cancel" />
              </button>
            )}
            <button type="submit" disabled={submitting} style={primaryButtonStyle(submitting)}>
              {submitting ? (
                <FormattedMessage id="component.manualTransactionForm.loading" />
              ) : (
                <FormattedMessage id="component.manualTransactionForm.submit" />
              )}
            </button>
          </div>
        </form>
      )}

      {errorText !== null && (
        <span
          role="alert"
          style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}
        >
          <FormattedMessage id={errorText} />
        </span>
      )}
    </div>
  );
}

function errorMessageId(error: FormError): string {
  switch (error) {
    case 'required':
      return 'component.manualTransactionForm.error.required';
    case 'amount':
      return 'component.manualTransactionForm.error.amount';
    case 'submit':
      return 'component.manualTransactionForm.error.submit';
    case 'account':
      return 'component.manualTransactionForm.error.account';
  }
}
