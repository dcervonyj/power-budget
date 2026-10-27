import React, { useEffect, useRef } from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import { parseLocalIsoDate } from '@power-budget/core';
import type { RodData } from '@power-budget/shared-app';
import type { MoneyAmount } from '../../../domain/dashboard/PlanDashboard.js';
import { Icon } from '../../glass/atoms/Icon.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import { Rod } from '../../glass/light/Rod.js';
import { useLightLabels } from '../../glass/light/useLightLabels.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import '../../glass/controls/controls.css';
import {
  TransactionFilterBar,
  type TransactionFilters,
} from '../../components/TransactionFilterBar.js';
import { TransactionRow } from '../../components/TransactionRow.js';
import { mappingViewOf } from '../../../application/transactions/MappingView.js';
import type {
  DayGroup,
  MonthLeft,
  SortingProgress,
} from '../../../application/transactions/TransactionListQueryView.js';
import type { Transaction } from '../../../domain/transactions/Transaction.js';

export type TransactionListStatus = 'loading' | 'error' | 'ready';

export interface TransactionListViewProps {
  /** The month's expense plan, for the rod under the title; absent without a plan. */
  readonly month?: MonthLeft;
  readonly filters: TransactionFilters;
  readonly onFiltersChange: (filters: TransactionFilters) => void;
  readonly categories: { id: string; name: string }[];
  readonly status: TransactionListStatus;
  readonly onRetry: () => void;
  readonly groups: readonly DayGroup[];
  /** Sorted vs to sort; absent when the list is filtered, as the counts would mislead. */
  readonly sorting?: SortingProgress;
  /** Category name of the item the API suggests for a row, when known. */
  readonly suggestionLabelOf: (tx: Transaction) => string | undefined;
  readonly selectedIds: ReadonlySet<string>;
  readonly onToggleRow: (id: string) => void;
  readonly onToggleAll: () => void;
  readonly onAdd: () => void;
  readonly onRowClick: (id: string) => void;
  readonly onRowMap: (id: string) => void;
  readonly onConfirmSuggestion: (id: string) => void;
  readonly loadingMore?: boolean;
  /** Observed by the container to load the next page. */
  readonly sentinelRef?: React.Ref<HTMLDivElement>;
  /** The bulk bar, modals and toast of the container. */
  readonly children?: React.ReactNode;
}

const PAGE_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 1280,
  margin: '0 auto',
  padding: '0 var(--pb-glass-space-lg)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
};

const COLUMNS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  gap: 'var(--pb-glass-space-lg)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-title-web)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
  minHeight: 44,
  padding: '0 var(--pb-glass-space-xl)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-light-solid)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-light-edge)',
  color: 'var(--pb-glass-accent-ink)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  cursor: 'pointer',
};

const DIM_STYLE: React.CSSProperties = {
  margin: 0,
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

export function TransactionListView(props: TransactionListViewProps): React.JSX.Element {
  const { month, status, groups, sorting } = props;

  return (
    <div style={PAGE_STYLE}>
      <Header month={month} onAdd={props.onAdd} />
      <TransactionFilterBar
        filters={props.filters}
        onChange={props.onFiltersChange}
        categories={props.categories}
      />
      <div style={COLUMNS_STYLE}>
        <GlassPanel
          material="frosted"
          depth={1}
          decor={{ specular: true, film: true }}
          style={{ flex: '2 1 480px', minWidth: 0 }}
          contentStyle={{ padding: 'var(--pb-glass-space-lg)', minHeight: 160 }}
        >
          {status === 'loading' ? <LoadingRows /> : null}
          {status === 'error' ? <ErrorNotice onRetry={props.onRetry} /> : null}
          {status === 'ready' && groups.length === 0 ? <EmptyList filters={props.filters} /> : null}
          {status === 'ready' && groups.length > 0 ? <DayGroups {...props} /> : null}
          <div ref={props.sentinelRef} style={{ height: 1 }} />
          {props.loadingMore === true ? <MoreNotice /> : null}
        </GlassPanel>
        {sorting === undefined ? null : <SortingPanel sorting={sorting} />}
      </div>
      {props.children}
    </div>
  );
}

function Header({ month, onAdd }: { month?: MonthLeft; onAdd: () => void }): React.JSX.Element {
  const intl = useIntl();
  const labels = useLightLabels();
  const monthName =
    month === undefined
      ? ''
      : intl.formatDate(parseLocalIsoDate(month.periodStart), { month: 'long' });

  return (
    <header
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--pb-glass-space-lg)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}>
        <h1 style={TITLE_STYLE}>
          {intl.formatMessage({
            id: 'screen.transactionList.title',
            defaultMessage: 'Transactions',
          })}
        </h1>
        {month === undefined ? null : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--pb-glass-space-xs)',
              width: 320,
              maxWidth: '100%',
            }}
          >
            <p style={{ ...DIM_STYLE, fontSize: 'var(--pb-glass-type-body-web)' }}>
              {monthSummary(month, monthName, intl)}
            </p>
            <Rod
              rod={monthRod(
                month,
                labels.rodAria(monthName, rodState(month), monthAmount(month), month.planned),
              )}
            />
          </div>
        )}
      </div>
      <button type="button" className="pbg-ctl" onClick={onAdd} style={PRIMARY_BUTTON_STYLE}>
        {intl.formatMessage({
          id: 'screen.transactionList.add',
          defaultMessage: 'Add transaction',
        })}
      </button>
    </header>
  );
}

/** What the rod and the line show: what is left, or the positive overspend. */
function monthAmount(month: MonthLeft): MoneyAmount {
  if (month.left.amountMinor < 0n) {
    return { amountMinor: -month.left.amountMinor, currency: month.left.currency };
  }

  return month.left;
}

function monthSummary(month: MonthLeft, monthName: string, intl: IntlShape): string {
  const amount = formatAmount(monthAmount(month), intl.locale);
  if (month.left.amountMinor < 0n) {
    return intl.formatMessage(
      { id: 'tx.list.monthOver', defaultMessage: 'Over by {amount} in {month}' },
      { amount, month: monthName },
    );
  }

  return intl.formatMessage(
    { id: 'tx.list.monthLeft', defaultMessage: '{amount} left in {month}' },
    { amount, month: monthName },
  );
}

function rodState(month: MonthLeft): RodData['state'] {
  if (month.left.amountMinor < 0n) {
    return 'over';
  }

  return month.fraction > 0 ? 'under' : 'empty';
}

function monthRod(month: MonthLeft, ariaLabel: string): RodData {
  return { fraction: month.fraction, state: rodState(month), ariaLabel, size: 'pace' };
}

function DayGroups(props: TransactionListViewProps): React.JSX.Element {
  const intl = useIntl();
  const allRows = props.groups.flatMap((group) => group.transactions);
  const allSelected = allRows.every((tx) => props.selectedIds.has(tx.id));
  const someSelected = allRows.some((tx) => props.selectedIds.has(tx.id));
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const selectAll = intl.formatMessage({
    id: 'screen.transactionList.selectAll',
    defaultMessage: 'Select all',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-lg)' }}>
      <label
        style={{
          ...DIM_STYLE,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--pb-glass-space-sm)',
          minHeight: 44,
        }}
      >
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={props.onToggleAll}
          style={CHECKBOX_STYLE}
        />
        {selectAll}
      </label>
      {props.groups.map((group) => (
        <section
          key={group.day}
          aria-label={dayLabel(group.day, intl.locale)}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}
        >
          <h2 style={{ ...DIM_STYLE, fontWeight: 600 }}>{dayLabel(group.day, intl.locale)}</h2>
          {group.transactions.map((tx) => (
            <SelectableRow key={tx.id} tx={tx} {...props} />
          ))}
        </section>
      ))}
    </div>
  );
}

const CHECKBOX_STYLE: React.CSSProperties = {
  width: 20,
  height: 20,
  flex: 'none',
  accentColor: 'var(--pb-glass-accent)',
  cursor: 'pointer',
};

function dayLabel(day: string, locale: string): string {
  return parseLocalIsoDate(day).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function SelectableRow(props: TransactionListViewProps & { tx: Transaction }): React.JSX.Element {
  const intl = useIntl();
  const { tx } = props;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-sm)' }}>
      <input
        type="checkbox"
        aria-label={intl.formatMessage(
          { id: 'screen.transactionList.selectRow', defaultMessage: 'Select transaction {id}' },
          { id: tx.id },
        )}
        checked={props.selectedIds.has(tx.id)}
        onChange={() => {
          props.onToggleRow(tx.id);
        }}
        style={CHECKBOX_STYLE}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <TransactionRow
          transaction={tx}
          mapping={mappingViewOf(tx)}
          onClick={props.onRowClick}
          onMap={props.onRowMap}
          suggestionLabel={props.suggestionLabelOf(tx)}
          onConfirmSuggestion={props.onConfirmSuggestion}
        />
      </div>
    </div>
  );
}

function SortingPanel({ sorting }: { sorting: SortingProgress }): React.JSX.Element {
  const intl = useIntl();
  const total = sorting.sorted + sorting.toSort;
  const fraction = total === 0 ? 0 : sorting.sorted / total;
  const ariaLabel = intl.formatMessage(
    { id: 'tx.sorting.aria', defaultMessage: '{sorted} of {total} sorted' },
    { sorted: sorting.sorted, total },
  );

  return (
    <GlassPanel
      material="tinted"
      depth={2}
      decor={{ specular: true, film: true }}
      style={{ flex: '1 1 280px', minWidth: 0 }}
      contentStyle={{
        padding: 'var(--pb-glass-space-lg)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--pb-glass-space-md)',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 'var(--pb-glass-type-panel-label-web)',
          fontWeight: 600,
        }}
      >
        {intl.formatMessage({ id: 'tx.sorting.title', defaultMessage: 'Sorting' })}
      </h2>
      <Rod
        rod={{
          fraction,
          state: fraction > 0 ? 'under' : 'empty',
          ariaLabel,
          size: 'category',
        }}
      />
      <p style={DIM_STYLE}>
        {intl.formatMessage(
          { id: 'tx.sorting.summary', defaultMessage: '{sorted} sorted · {toSort} to sort' },
          { sorted: sorting.sorted, toSort: sorting.toSort },
        )}
      </p>
    </GlassPanel>
  );
}

function LoadingRows(): React.JSX.Element {
  const intl = useIntl();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={intl.formatMessage({
        id: 'tx.list.loading',
        defaultMessage: 'Loading transactions',
      })}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}
    >
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <span
          key={index}
          aria-hidden="true"
          data-testid="tx-skeleton"
          style={{
            display: 'block',
            height: 72,
            borderRadius: 'var(--pb-glass-radius-tile)',
            background: 'var(--pb-glass-fill)',
          }}
        />
      ))}
    </div>
  );
}

function ErrorNotice({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  const intl = useIntl();

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--pb-glass-space-md)',
        color: 'var(--pb-glass-over)',
      }}
    >
      <Icon name="warning" size={20} />
      <span style={{ flex: '1 1 200px' }}>
        {intl.formatMessage({
          id: 'screen.transactionList.error',
          defaultMessage: 'Failed to load transactions',
        })}
      </span>
      <button type="button" className="pbg-ctl" onClick={onRetry} style={RETRY_STYLE}>
        {intl.formatMessage({ id: 'tx.list.retry', defaultMessage: 'Try again' })}
      </button>
    </div>
  );
}

const RETRY_STYLE: React.CSSProperties = {
  minHeight: 44,
  padding: '0 var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill2)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-label-web)',
  cursor: 'pointer',
};

function EmptyList({ filters }: { filters: TransactionFilters }): React.JSX.Element {
  const intl = useIntl();
  const filtered = Object.values(filters).some((value) => value !== '');

  return (
    <p style={{ ...DIM_STYLE, fontSize: 'var(--pb-glass-type-body-web)' }}>
      {filtered
        ? intl.formatMessage({
            id: 'screen.transactionList.empty',
            defaultMessage: 'No transactions found',
          })
        : intl.formatMessage({
            id: 'component.shared.empty.noTransactions',
            defaultMessage: 'No transactions yet',
          })}
    </p>
  );
}

function MoreNotice(): React.JSX.Element {
  const intl = useIntl();

  return (
    <p style={{ ...DIM_STYLE, textAlign: 'center', padding: 'var(--pb-glass-space-lg)' }}>
      {intl.formatMessage({ id: 'screen.transactionList.loadMore', defaultMessage: 'Load more' })}
    </p>
  );
}
