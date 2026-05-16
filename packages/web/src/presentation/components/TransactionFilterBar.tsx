import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';

export interface TransactionFilters {
  from: string;
  to: string;
  category: string;
  status: '' | 'mapped' | 'unmapped' | 'transfer';
  currency: string;
  source: '' | 'gocardless' | 'wise' | 'manual';
  q: string;
}

export interface TransactionFilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: { id: string; name: string }[];
}

export function TransactionFilterBar({
  filters,
  onChange,
  categories,
}: TransactionFilterBarProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const set = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]): void => {
    onChange({ ...filters, [key]: value });
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme.color.surface.raised,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.subtle}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    fontSize: theme.fontSize.md,
  };

  const labelStyle: React.CSSProperties = {
    color: theme.color.text.secondary,
    fontSize: theme.fontSize.sm,
  };

  const fieldStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.space.xs,
  };

  const allLabel = intl.formatMessage({
    id: 'screen.transactionList.filter.status.all',
    defaultMessage: 'All',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.space.sm,
        alignItems: 'flex-end',
        padding: theme.space.md,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.md,
        marginBottom: theme.space.lg,
        border: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.dateFrom',
            defaultMessage: 'From',
          })}
        </label>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => {
            set('from', e.target.value);
          }}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.dateTo',
            defaultMessage: 'To',
          })}
        </label>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => {
            set('to', e.target.value);
          }}
          style={inputStyle}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.category',
            defaultMessage: 'Category',
          })}
        </label>
        <select
          value={filters.category}
          onChange={(e) => {
            set('category', e.target.value);
          }}
          style={inputStyle}
        >
          <option value="">{allLabel}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.status',
            defaultMessage: 'Status',
          })}
        </label>
        <select
          value={filters.status}
          onChange={(e) => {
            set('status', e.target.value as TransactionFilters['status']);
          }}
          style={inputStyle}
        >
          <option value="">{allLabel}</option>
          <option value="mapped">
            {intl.formatMessage({
              id: 'screen.transactionList.filter.status.mapped',
              defaultMessage: 'Mapped',
            })}
          </option>
          <option value="unmapped">
            {intl.formatMessage({
              id: 'screen.transactionList.filter.status.unmapped',
              defaultMessage: 'Unmapped',
            })}
          </option>
          <option value="transfer">
            {intl.formatMessage({
              id: 'screen.transactionList.filter.status.transfer',
              defaultMessage: 'Transfers',
            })}
          </option>
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.currency',
            defaultMessage: 'Currency',
          })}
        </label>
        <input
          type="text"
          value={filters.currency}
          onChange={(e) => {
            set('currency', e.target.value.toUpperCase());
          }}
          placeholder={intl.formatMessage({ id: 'screen.transactionList.filter.currencyPlaceholder', defaultMessage: 'EUR' })}
          maxLength={3}
          style={{ ...inputStyle, width: 72 }}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.source',
            defaultMessage: 'Source',
          })}
        </label>
        <select
          value={filters.source}
          onChange={(e) => {
            set('source', e.target.value as TransactionFilters['source']);
          }}
          style={inputStyle}
        >
          <option value="">{allLabel}</option>
          <option value="gocardless">
            {intl.formatMessage({
              id: 'screen.transactionDetail.source.gocardless',
              defaultMessage: 'Bank (GoCardless)',
            })}
          </option>
          <option value="wise">
            {intl.formatMessage({
              id: 'screen.transactionDetail.source.wise',
              defaultMessage: 'Wise',
            })}
          </option>
          <option value="manual">
            {intl.formatMessage({
              id: 'screen.transactionDetail.source.manual',
              defaultMessage: 'Manual',
            })}
          </option>
        </select>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle}>
          {intl.formatMessage({
            id: 'screen.transactionList.filter.search',
            defaultMessage: 'Search',
          })}
        </label>
        <input
          type="text"
          value={filters.q}
          onChange={(e) => {
            set('q', e.target.value);
          }}
          placeholder={intl.formatMessage({
            id: 'screen.transactionList.filter.search',
            defaultMessage: 'Search…',
          })}
          style={{ ...inputStyle, minWidth: 160 }}
        />
      </div>
    </div>
  );
}
