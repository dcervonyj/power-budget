import React from 'react';
import { useIntl } from 'react-intl';
import type { TransactionStatus } from '../../domain/transactions/Transaction.js';
import { FilterChips } from '../glass/controls/FilterChips.js';
import { Icon } from '../glass/atoms/Icon.js';
import '../glass/controls/controls.css';

export interface TransactionFilters {
  from: string;
  to: string;
  category: string;
  /** Mapping filter, applied by the API (`unmappedOnly`, `mapped`, `transfer`). */
  status: '' | 'unmapped' | 'mapped' | 'transfer';
  /** Booking status, applied by the API (`status`). */
  booking: '' | TransactionStatus;
  currency: string;
  source: '' | 'gocardless' | 'wise' | 'manual';
  q: string;
}

export interface TransactionFilterBarProps {
  filters: TransactionFilters;
  onChange: (filters: TransactionFilters) => void;
  categories: { id: string; name: string }[];
}

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
            <input
              type="text"
              className="pbg-ctl pbg-ctl-field"
              value={filters.currency}
              onChange={(e) => {
                set('currency', e.target.value.toUpperCase());
              }}
              placeholder={intl.formatMessage({
                id: 'screen.transactionList.filter.currencyPlaceholder',
                defaultMessage: 'EUR',
              })}
              maxLength={3}
              style={{ ...FIELD_STYLE, width: 88 }}
            />
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

export function toSource(value: string | null): TransactionFilters['source'] {
  switch (value) {
    case 'gocardless':
    case 'wise':
    case 'manual':
      return value;
    default:
      return '';
  }
}
