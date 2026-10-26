import React from 'react';
import type { AccountDto } from '@power-budget/shared-app/contract';
import type { Transaction } from '../../domain/transactions/Transaction.js';
import {
  suggestedFirst,
  type PlannedItemOption,
} from '../../application/transactions/PlannedItemLabels.js';
import { previewCategoryRod } from '../../application/transactions/MappingViewPreview.js';
import { AmbientField } from '../glass/material/AmbientField.js';
import { Sheet } from '../glass/overlays/Sheet.js';
import { ManualTransactionForm } from './ManualTransactionForm.js';
import { TransactionDetailView } from './TransactionDetailModal.js';
import { TransactionMapView } from './TransactionMapModal.js';

const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  minHeight: 900,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

/** D7 data: Żabka and Pyszne.pl payments, Groceries 1 148,64 / 2 200, Eating out 490 / 500. */
const ZABKA: Transaction = {
  id: 'tx-zabka',
  accountId: 'acc-pko',
  occurredOn: '2026-10-22',
  amount: { amountMinor: -1890n, currency: 'PLN' },
  description: 'Żabka Z1234',
  merchant: 'Żabka',
  source: 'bank_sync',
  status: 'booked',
  suggestedPlannedItemId: 'item-groceries',
  isTransfer: false,
  ignored: false,
  notes: null,
  mapping: null,
};

const PYSZNE: Transaction = {
  ...ZABKA,
  id: 'tx-pyszne',
  occurredOn: '2026-10-20',
  amount: { amountMinor: -7250n, currency: 'PLN' },
  description: 'Pyszne.pl',
  merchant: 'Pyszne.pl',
  suggestedPlannedItemId: 'item-eating-out',
};

function option(id: string, categoryName: string, plannedMinor: string): PlannedItemOption {
  return {
    planName: 'October',
    categoryName,
    item: {
      id,
      planId: 'plan-october',
      categoryId: `cat-${id}`,
      direction: 'expense',
      amount: { amountMinor: plannedMinor, currency: 'PLN' },
      note: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  };
}

const OPTIONS: ReadonlyArray<PlannedItemOption> = [
  option('item-groceries', 'Groceries', '220000'),
  option('item-eating-out', 'Eating out', '50000'),
  option('item-transport', 'Transport', '70000'),
  option('item-health', 'Health', '40000'),
];

const money = (amountMinor: bigint) => ({ amountMinor, currency: 'PLN' });

function noop(): void {
  // Gallery fixtures do not react to input.
}

const ACCOUNTS: ReadonlyArray<AccountDto> = [
  {
    id: 'acc-cash',
    kind: 'manual',
    name: 'Cash',
    currency: 'PLN',
    connectionId: null,
    balance: null,
    lastSyncedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

/** Map sheet: suggestion first, rod preview with money left. */
export function MapSheetSuggested(): React.JSX.Element {
  return (
    <Backdrop>
      <TransactionMapView
        {...MAP_BASE}
        transaction={ZABKA}
        selectedId="item-groceries"
        preview={previewCategoryRod(money(220000n), money(114864n), ZABKA.amount)}
        previewName="Groceries"
      />
    </Backdrop>
  );
}

/** Map sheet: the pick pushes the category over budget. */
export function MapSheetOver(): React.JSX.Element {
  return (
    <Backdrop>
      <TransactionMapView
        {...MAP_BASE}
        transaction={PYSZNE}
        options={suggestedFirst(OPTIONS, 'item-eating-out')}
        selectedId="item-eating-out"
        preview={previewCategoryRod(money(50000n), money(49000n), PYSZNE.amount)}
        previewName="Eating out"
      />
    </Backdrop>
  );
}

/** Detail sheet of a transaction that waits to be sorted. */
export function DetailSheetUnmapped(): React.JSX.Element {
  return (
    <Backdrop>
      <TransactionDetailView {...DETAIL_BASE} transaction={ZABKA} mappedTo={null} />
    </Backdrop>
  );
}

/** Detail sheet of a mapped transaction with a note. */
export function DetailSheetMapped(): React.JSX.Element {
  return (
    <Backdrop>
      <TransactionDetailView
        {...DETAIL_BASE}
        transaction={PYSZNE}
        notes="Dinner after the concert"
        mappedTo={{ categoryName: 'Eating out', planName: 'October' }}
      />
    </Backdrop>
  );
}

/** Manual add form in a sheet. */
export function ManualAddSheet(): React.JSX.Element {
  return (
    <Backdrop>
      <Sheet isOpen onClose={noop} title="Add transaction">
        <ManualTransactionForm initialAccounts={ACCOUNTS} onCancel={noop} />
      </Sheet>
    </Backdrop>
  );
}

const MAP_BASE = {
  isOpen: true,
  options: suggestedFirst(OPTIONS, 'item-groceries'),
  query: '',
  currentPlannedItemId: null,
  loading: false,
  loadError: false,
  error: null,
  submitting: false,
  onQuery: noop,
  onSelect: noop,
  onConfirm: noop,
  onClear: noop,
  onClose: noop,
};

const DETAIL_BASE = {
  isOpen: true,
  onClose: noop,
  loading: false,
  fetchError: null,
  notes: '',
  onNotes: noop,
  savingNotes: false,
  notesError: null,
  onSaveNotes: noop,
  isTransfer: false,
  ignored: false,
  togglingTransfer: false,
  togglingIgnored: false,
  onToggleTransfer: noop,
  onToggleIgnored: noop,
  onOpenMap: noop,
  mapDialog: null,
};

function Backdrop({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={STAGE}>
      <AmbientField />
      {children}
    </div>
  );
}
