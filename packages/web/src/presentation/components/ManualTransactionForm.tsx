import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';
import { useTheme } from './ThemeContext.js';

interface BankConnection {
  id: string;
  provider: string;
  bankId: string;
  status: string;
  displayName?: string;
}

interface BankAccount {
  id: string;
  connectionId: string;
  name: string;
  currency?: string;
  iban?: string;
}

interface AccountWithConnection {
  account: BankAccount;
  connection: BankConnection;
}

export interface ManualTransactionFormProps {
  onSuccess?: (transactionId: string) => void;
  onCancel?: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ManualTransactionForm({
  onSuccess,
  onCancel,
}: ManualTransactionFormProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const [accountsWithConn, setAccountsWithConn] = useState<AccountWithConnection[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState(false);

  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [occurredOn, setOccurredOn] = useState(todayIso);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('PLN');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<'required' | 'submit' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const connectionsRes = await apiClient.get<BankConnection[]>('/bank-connections');
        const items: AccountWithConnection[] = [];
        for (const conn of connectionsRes.data) {
          const accsRes = await apiClient.get<BankAccount[]>(
            `/bank-connections/${conn.id}/accounts`,
          );
          for (const account of accsRes.data) {
            items.push({ account, connection: conn });
          }
        }
        setAccountsWithConn(items);
        if (items.length > 0) {
          const first = items[0];
          if (first) {
            setSelectedAccountId(first.account.id);
            if (first.account.currency) {
              setCurrency(first.account.currency);
            }
          }
        }
      } catch {
        setAccountsError(true);
      } finally {
        setAccountsLoading(false);
      }
    })();
  }, []);

  const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const id = e.target.value;
    setSelectedAccountId(id);
    const found = accountsWithConn.find((item) => item.account.id === id);
    if (found?.account.currency) {
      setCurrency(found.account.currency);
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (!description.trim() || !selectedAccountId || !amount) {
      setError('required');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      setError('required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post<{ id: string }>('/transactions', {
        accountId: selectedAccountId,
        occurredOn,
        amountMinor: Math.round(parsedAmount * 100),
        currency: currency.trim().toUpperCase(),
        description: description.trim(),
        notes: notes.trim() || null,
      });
      onSuccess?.(res.data.id);
      setAmount('');
      setDescription('');
      setNotes('');
      setOccurredOn(todayIso());
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
    padding: `${theme.space.sm} ${theme.space.md}`,
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

  const groupedByConnection = accountsWithConn.reduce<Record<string, AccountWithConnection[]>>(
    (acc, item) => {
      const key = item.connection.id;
      acc[key] = [...(acc[key] ?? []), item];
      return acc;
    },
    {},
  );

  return (
    <div
      style={{
        background: theme.color.surface.raised,
        borderRadius: theme.radius.lg,
        padding: theme.space.xl,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.lg,
      }}
    >
      <h2 style={{ color: theme.color.text.primary, margin: 0, fontSize: theme.fontSize.lg }}>
        <FormattedMessage id="component.manualTransactionForm.title" />
      </h2>

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}
      >
        {/* Account */}
        <div style={fieldStyle}>
          <label htmlFor="mtf-account" style={labelStyle}>
            <FormattedMessage id="component.manualTransactionForm.account.label" />
          </label>
          {accountsLoading ? (
            <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
              <FormattedMessage id="component.manualTransactionForm.loadingAccounts" />
            </span>
          ) : accountsError ? (
            <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
              <FormattedMessage id="component.manualTransactionForm.error.submit" />
            </span>
          ) : (
            <select
              id="mtf-account"
              value={selectedAccountId}
              onChange={handleAccountChange}
              style={inputStyle}
              required
            >
              <option value="" disabled>
                {intl.formatMessage({ id: 'component.manualTransactionForm.account.placeholder' })}
              </option>
              {Object.entries(groupedByConnection).map(([connId, items]) => {
                const connName =
                  items[0]?.connection.displayName ?? items[0]?.connection.bankId ?? connId;
                return (
                  <optgroup key={connId} label={connName}>
                    {items.map(({ account }) => {
                      const optionLabel = account.iban
                        ? `${account.name} (${account.iban})`
                        : account.name;
                      return (
                        <option key={account.id} value={account.id}>
                          {optionLabel}
                        </option>
                      );
                    })}
                  </optgroup>
                );
              })}
            </select>
          )}
        </div>

        {/* occurred_on */}
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

        {/* amount + currency row */}
        <div style={{ display: 'flex', gap: theme.space.md }}>
          <div style={{ ...fieldStyle, flex: 2 }}>
            <label htmlFor="mtf-amount" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.amount.label" />
            </label>
            <input
              id="mtf-amount"
              type="number"
              step="0.01"
              min="0"
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
            <label htmlFor="mtf-currency" style={labelStyle}>
              <FormattedMessage id="component.manualTransactionForm.currency.label" />
            </label>
            <input
              id="mtf-currency"
              type="text"
              maxLength={3}
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value.toUpperCase());
              }}
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* description */}
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

        {/* notes */}
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

        {/* error messages */}
        {error === 'required' && (
          <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="component.manualTransactionForm.error.required" />
          </span>
        )}
        {error === 'submit' && (
          <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}>
            <FormattedMessage id="component.manualTransactionForm.error.submit" />
          </span>
        )}

        {/* actions */}
        <div style={{ display: 'flex', gap: theme.space.md, justifyContent: 'flex-end' }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              style={{
                padding: `${theme.space.sm} ${theme.space.lg}`,
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
          <button
            type="submit"
            disabled={submitting || accountsLoading}
            style={{
              padding: `${theme.space.sm} ${theme.space.lg}`,
              border: 'none',
              borderRadius: theme.radius.md,
              background: theme.color.accent.default,
              color: theme.color.text.onAccent,
              fontSize: theme.fontSize.md,
              cursor: submitting || accountsLoading ? 'not-allowed' : 'pointer',
              opacity: submitting || accountsLoading ? 0.7 : 1,
            }}
          >
            {submitting ? (
              <FormattedMessage id="component.manualTransactionForm.loading" />
            ) : (
              <FormattedMessage id="component.manualTransactionForm.submit" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
