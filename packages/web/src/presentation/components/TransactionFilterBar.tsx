import React from 'react';
import { useIntl } from 'react-intl';
import { CURRENCIES, isSupportedCurrency, type CurrencyCode } from '@power-budget/core';
import type { TransactionStatus } from '../../domain/transactions/Transaction.js';
import { FilterChips } from '../glass/controls/FilterChips.js';
import { Icon } from '../glass/atoms/Icon.js';
import '../glass/controls/controls.css';

/** Every filter is applied by the API (`GET /transactions`, CLN-050). */
export interface TransactionFilters {
  from: string;
  to: string;
  /** Category id: rows mapped to a planned item of this category (`categoryId`). */
  category: string;
  /** Mapping filter, applied by the API (`unmappedOnly`, `mapped`, `transfer`). */
  status: '' | 'unmapped' | 'mapped' | 'transfer';
  /** Booking status, applied by the API (`status`). */
  booking: '' | TransactionStatus;
  currency: '' | CurrencyCode;
  /**
   * `bank_sync`: every bank row, whichever provider; a provider: rows that carry it (SYNC-001
   * `source_kind`; rows synced before it carry none); `manual`: rows a user entered.
   */
  source: '' | 'bank_sync' | SourceProvider | 'manual';
  q: string;
}

/** The providers the API can filter by (`source`). */
export type SourceProvider = 'enable_banking' | 'wise_webhook' | 'pko_email' | 'iko_push';

export interface TransactionFilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: { id: string; name: string }[];
}

const CURRENCY_CODES: readonly CurrencyCode[] = Object.keys(CURRENCIES).filter(isSupportedCurrency);

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
};

const TOP_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--pb-glass-space-sm)',
};

const SEARCH_WRAP_STYLE: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  flex: '1 1 220px',
  maxWidth: 360,
  color: 'var(--pb-glass-dim)',
};

const FIELD_STYLE: React.CSSProperties = {
  minHeight: 44,
  boxSizing: 'border-box',
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
};

const MORE_STYLE: React.CSSProperties = {
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const MORE_GRID_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-sm)',
  alignItems: 'flex-end',
  paddingTop: 'var(--pb-glass-space-sm)',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xxs)',
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

/**
 * The filters of the list: chips for the mapping filter (All / To sort / Mapped / Transfers, which the
 * API filters, CLN-024), a search box, and the rarer filters folded under "More filters".
 */
export function TransactionFilterBar({
  filters,
  onChange,
  categories,
}: TransactionFilterBarProps): React.JSX.Element {
  const intl = useIntl();

  const set = <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]): void => {
    onChange({ ...filters, [key]: value });
  };

  const allLabel = intl.formatMessage({
    id: 'screen.transactionList.filter.status.all',
    defaultMessage: 'All',
  });
  const searchLabel = intl.formatMessage({
    id: 'screen.transactionList.filter.search',
    defaultMessage: 'Search…',
  });

  return (
    <div style={BAR_STYLE}>
      <div style={TOP_ROW_STYLE}>
        <FilterChips<TransactionFilters['status']>
          label={intl.formatMessage({
            id: 'tx.filter.label',
            defaultMessage: 'Show transactions',
          })}
          value={filters.status}
          onChange={(value) => {
            set('status', value);
          }}
          options={[
            { value: '', label: allLabel },
            {
              value: 'unmapped',
              label: intl.formatMessage({ id: 'tx.filter.toSort', defaultMessage: 'To sort' }),
            },
            {
              value: 'mapped',
              label: intl.formatMessage({
                id: 'screen.transactionList.filter.status.mapped',
                defaultMessage: 'Mapped',
              }),
            },
            {
              value: 'transfer',
              label: intl.formatMessage({
                id: 'screen.transactionList.filter.status.transfer',
                defaultMessage: 'Transfers',
              }),
            },
          ]}
        />
        <span style={SEARCH_WRAP_STYLE}>
          <span style={{ position: 'absolute', left: 'var(--pb-glass-space-sm)', display: 'flex' }}>
            <Icon name="search" size={18} />
          </span>
          <input
            type="search"
            className="pbg-ctl pbg-ctl-field"
            aria-label={searchLabel}
            value={filters.q}
            placeholder={searchLabel}
            onChange={(e) => {
              set('q', e.target.value);
            }}
            style={{ ...FIELD_STYLE, width: '100%', paddingLeft: 40 }}
          />
        </span>
      </div>

      <details>
        <summary style={{ ...MORE_STYLE, cursor: 'pointer', minHeight: 44, lineHeight: '44px' }}>
          {intl.formatMessage({ id: 'tx.filter.more', defaultMessage: 'More filters' })}
        </summary>
        <div style={MORE_GRID_STYLE}>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.dateFrom',
              defaultMessage: 'From',
            })}
            <input
              type="date"
              className="pbg-ctl"
              value={filters.from}
              onChange={(e) => {
                set('from', e.target.value);
              }}
              style={FIELD_STYLE}
            />
          </label>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.dateTo',
              defaultMessage: 'To',
            })}
            <input
              type="date"
              className="pbg-ctl"
              value={filters.to}
              onChange={(e) => {
                set('to', e.target.value);
              }}
              style={FIELD_STYLE}
            />
          </label>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.category',
              defaultMessage: 'Category',
            })}
            <select
              className="pbg-ctl"
              value={filters.category}
              onChange={(e) => {
                set('category', e.target.value);
              }}
              style={FIELD_STYLE}
            >
              <option value="">{allLabel}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.booking',
              defaultMessage: 'Booking',
            })}
            <select
              id="tx-filter-booking"
              className="pbg-ctl"
              value={filters.booking}
              onChange={(e) => {
                set('booking', toBooking(e.target.value));
              }}
              style={FIELD_STYLE}
            >
              <option value="">{allLabel}</option>
              <option value="pending">
                {intl.formatMessage({
                  id: 'transaction.status.pending',
                  defaultMessage: 'Pending',
                })}
              </option>
              <option value="booked">
                {intl.formatMessage({ id: 'transaction.status.booked', defaultMessage: 'Booked' })}
              </option>
              <option value="cancelled">
                {intl.formatMessage({
                  id: 'transaction.status.cancelled',
                  defaultMessage: 'Cancelled',
                })}
              </option>
            </select>
          </label>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.currency',
              defaultMessage: 'Currency',
            })}
            <select
              className="pbg-ctl"
              value={filters.currency}
              onChange={(e) => {
                set('currency', toCurrency(e.target.value));
              }}
              style={FIELD_STYLE}
            >
              <option value="">{allLabel}</option>
              {CURRENCY_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label style={LABEL_STYLE}>
            {intl.formatMessage({
              id: 'screen.transactionList.filter.source',
              defaultMessage: 'Source',
            })}
            <select
              className="pbg-ctl"
              value={filters.source}
              onChange={(e) => {
                set('source', toSource(e.target.value));
              }}
              style={FIELD_STYLE}
            >
              <option value="">{allLabel}</option>
              <option value="bank_sync">
                {intl.formatMessage({
                  id: 'screen.transactionDetail.source.bankSync',
                  defaultMessage: 'Bank',
                })}
              </option>
              <option value="enable_banking">
                {intl.formatMessage({
                  id: 'screen.transactionList.filter.source.enableBanking',
                  defaultMessage: 'Enable Banking',
                })}
              </option>
              <option value="wise_webhook">
                {intl.formatMessage({
                  id: 'screen.transactionList.filter.source.wise',
                  defaultMessage: 'Wise',
                })}
              </option>
              <option value="pko_email">
                {intl.formatMessage({
                  id: 'screen.transactionList.filter.source.pkoEmail',
                  defaultMessage: 'PKO email',
                })}
              </option>
              <option value="iko_push">
                {intl.formatMessage({
                  id: 'screen.transactionList.filter.source.ikoPush',
                  defaultMessage: 'IKO push',
                })}
              </option>
              <option value="manual">
                {intl.formatMessage({
                  id: 'screen.transactionDetail.source.manual',
                  defaultMessage: 'Manual',
                })}
              </option>
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

/** URL and select values outside the known set read as "all". */
export function toMappingFilter(value: string | null): TransactionFilters['status'] {
  switch (value) {
    case 'unmapped':
    case 'mapped':
    case 'transfer':
      return value;
    default:
      return '';
  }
}

export function toBooking(value: string | null): TransactionFilters['booking'] {
  switch (value) {
    case 'pending':
    case 'booked':
    case 'cancelled':
      return value;
    default:
      return '';
  }
}

/**
 * URL and select values. The old options `gocardless` and `wise` always returned every bank row, so
 * their links keep that meaning; the providers have their own values (`wise_webhook`, ...).
 */
export function toSource(value: string | null): TransactionFilters['source'] {
  switch (value) {
    case 'gocardless':
    case 'wise':
      return 'bank_sync';
    case 'bank_sync':
    case 'enable_banking':
    case 'wise_webhook':
    case 'pko_email':
    case 'iko_push':
    case 'manual':
      return value;
    default:
      return '';
  }
}

/** A currency the API does not know reads as "all" (it would answer 400). */
export function toCurrency(value: string | null): TransactionFilters['currency'] {
  const code = value === null ? '' : value.toUpperCase();

  return isSupportedCurrency(code) ? code : '';
}
