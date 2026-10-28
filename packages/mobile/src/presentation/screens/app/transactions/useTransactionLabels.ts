import { useIntl } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { parseLocalIsoDate } from '@power-budget/core';
import { formatLightAmount } from '../../../glass/light/formatLightAmount.js';
import type { ListFilter } from '../../../../infrastructure/transactions/TransactionListModel.js';

export interface TransactionLabels {
  monthLine(left: MinorUnitAmount, monthName: string): string;
  monthName(periodStart: string): string;
  waiting(amount: MinorUnitAmount | undefined): string;
  sortAll(count: number): string;
  filterGroup(): string;
  filterOption(filter: ListFilter, count: number): string;
  dayLabel(day: string): string;
  longDate(day: string): string;
  loading(): string;
  empty(filtered: boolean): string;
  listError(): string;
  loadMore(): string;
  transfersNote(): string;
  sortError(): string;
  detailError(): string;
  detailNotFound(): string;
  detailRetry(): string;
  category(): string;
  notSorted(): string;
  choose(): string;
  change(): string;
  clear(): string;
  transferSwitch(): string;
  transferHint(): string;
  notes(): string;
  notesPlaceholder(): string;
  save(): string;
  saveError(): string;
  mappingError(): string;
  pickerTitle(): string;
  pickerEmpty(): string;
  statusTransfer(): string;
  statusToSort(): string;
  sourceBank(): string;
  sourceManual(): string;
}

const FILTER_DEFAULTS: Readonly<Record<ListFilter, string>> = {
  all: 'All {count}',
  toSort: 'To sort {count}',
  sorted: 'Sorted {count}',
  transfers: 'Transfers {count}',
};

/** i18n strings of the transaction list and detail screens (tx.* messages). */
export function useTransactionLabels(): TransactionLabels {
  const intl = useIntl();
  const text = (id: string, defaultMessage: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id, defaultMessage }, values);

  return {
    monthLine(left, monthName) {
      const amount = formatLightAmount(
        {
          amountMinor: left.amountMinor < 0n ? -left.amountMinor : left.amountMinor,
          currency: left.currency,
        },
        intl.locale,
      );
      if (left.amountMinor < 0n) {
        return text('tx.month.over', 'Over by {amount} in {month}', { amount, month: monthName });
      }

      return text('tx.month.left', '{amount} left in {month}', { amount, month: monthName });
    },
    monthName(periodStart) {
      return intl.formatDate(parseLocalIsoDate(periodStart), { month: 'long' });
    },
    waiting(amount) {
      if (amount === undefined) {
        return text('tx.month.nothingWaiting', 'Nothing waiting to sort');
      }

      return text('tx.month.waiting', '{amount} waiting to sort', {
        amount: formatLightAmount(amount, intl.locale),
      });
    },
    sortAll(count) {
      return text(
        'tx.month.sortAll',
        '{count, plural, one {Sort the last one} other {Sort all #}}',
        { count },
      );
    },
    filterGroup: () => text('tx.filter.group', 'Show'),
    filterOption(filter, count) {
      return text(`tx.filter.${filter}`, FILTER_DEFAULTS[filter], { count });
    },
    dayLabel(day) {
      return intl.formatDate(parseLocalIsoDate(day), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
    },
    longDate(day) {
      return intl.formatDate(parseLocalIsoDate(day), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    },
    loading: () => text('tx.list.loading', 'Loading transactions'),
    empty(filtered) {
      return filtered
        ? text('tx.list.emptyFiltered', 'Nothing here for this filter')
        : text('tx.list.empty', 'No transactions yet');
    },
    listError: () => text('tx.list.error', 'Could not load transactions.'),
    loadMore: () => text('tx.list.loadMore', 'Load more'),
    transfersNote: () =>
      text('tx.list.transfersNote', 'Transfers between your accounts are not spending.'),
    sortError: () => text('tx.list.sortError', 'Could not sort the transaction.'),
    detailError: () => text('tx.detail.error', 'Could not load the transaction.'),
    detailNotFound: () => text('tx.detail.notFound', 'Transaction not found'),
    detailRetry: () => text('tx.detail.retry', 'Try again'),
    category: () => text('tx.detail.category', 'Category'),
    notSorted: () => text('tx.detail.notSorted', 'Not sorted yet'),
    choose: () => text('tx.detail.choose', 'Choose a category'),
    change: () => text('tx.detail.change', 'Change'),
    clear: () => text('tx.detail.clear', 'Clear'),
    transferSwitch: () => text('tx.detail.transfer', 'Mark as transfer'),
    transferHint: () =>
      text('tx.detail.transferHint', 'A transfer between your own accounts is not spending.'),
    notes: () => text('tx.detail.notes', 'Notes'),
    notesPlaceholder: () => text('tx.detail.notesPlaceholder', 'Add a note'),
    save: () => text('tx.detail.save', 'Save'),
    saveError: () => text('tx.detail.saveError', 'Could not save.'),
    mappingError: () => text('tx.detail.mappingError', 'Could not change the category.'),
    pickerTitle: () => text('tx.detail.pickerTitle', 'Choose a category'),
    pickerEmpty: () =>
      text('tx.detail.pickerEmpty', 'No expense categories in an active plan yet.'),
    statusTransfer: () => text('tx.detail.statusTransfer', 'Transfer'),
    statusToSort: () => text('tx.detail.statusToSort', 'To sort'),
    sourceBank: () => text('tx.detail.sourceBank', 'From bank'),
    sourceManual: () => text('tx.detail.sourceManual', 'Added by hand'),
  };
}
