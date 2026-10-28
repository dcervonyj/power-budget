import React, { useState } from 'react';
import type { PlanDto, PlannedItemVersionDto } from '@power-budget/shared-app/contract';
import { computePlanTotals } from '../../../application/plans/PlanTotals.js';
import { ClonePlanForm } from '../../components/ClonePlanForm.js';
import { Drawer } from '../../components/Drawer.js';
import { Modal } from '../../components/Modal.js';
import { PlannedItemHistoryView } from '../../components/PlannedItemHistoryView.js';
import { AmbientField } from '../../glass/material/AmbientField.js';
import {
  NO_DRAFT_ERRORS,
  PlanEditorView,
  type PlanDraftItem,
  type PlanEditorViewProps,
} from './PlanEditorView.js';
import type { PlanItemRowModel } from './PlanItemRows.js';
import { PlansListView, type PlansListViewProps } from './PlansListView.js';

/** Sample data of the D7 spec: October 2026, income 14 200, planned 11 800. */
const STAGE: React.CSSProperties = {
  position: 'relative',
  isolation: 'isolate',
  margin: 'calc(-1 * var(--pb-glass-space-3xl))',
  minHeight: 600,
  overflow: 'hidden',
  color: 'var(--pb-glass-fg)',
};

const LAYER: React.CSSProperties = { position: 'relative', zIndex: 1 };

function plan(id: string, name: string, start: string, end: string, archived = false): PlanDto {
  return {
    id,
    name,
    type: 'household',
    ownerUserId: 'user-anna',
    periodKind: 'monthly',
    period: { start, end },
    baseCurrency: 'PLN',
    archivedAt: archived ? '2026-10-01T00:00:00.000Z' : null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const OCTOBER = plan('plan-oct', 'October', '2026-10-01', '2026-10-31');
const PLANS: readonly PlanDto[] = [
  OCTOBER,
  plan('plan-nov', 'November', '2026-11-01', '2026-11-30'),
  plan('plan-sep', 'September', '2026-09-01', '2026-09-30', true),
];

function row(
  id: string,
  name: string,
  direction: PlanItemRowModel['direction'],
  minor: string,
  spentMinor: bigint | null,
  currency = 'PLN',
): PlanItemRowModel {
  return {
    id,
    name,
    direction,
    amountMinor: minor,
    currency,
    amountInput: `${minor.slice(0, -2)}.${minor.slice(-2)}`,
    spentMinor,
  };
}

const INCOME: readonly PlanItemRowModel[] = [
  row('i-anna', 'Anna salary', 'income', '840000', null),
  row('i-marek', 'Marek salary', 'income', '460000', null),
  row('i-free', 'Marek freelance', 'income', '120000', null),
];

const LIMITS: readonly PlanItemRowModel[] = [
  row('l-rent', 'Rent', 'expense', '340000', 340000n),
  row('l-food', 'Groceries', 'expense', '220000', 114864n),
  row('l-out', 'Eating out', 'expense', '50000', 56250n),
  row('l-bills', 'Bills & insurance', 'expense', '100000', 54800n),
  row('l-transport', 'Transport', 'expense', '70000', 31239n),
];

function noop(): void {
  // Gallery fixtures do not react to input.
}

const DRAFT: PlanDraftItem = { categoryId: '', direction: 'expense', amount: '', currency: '' };

function editorProps(overrides: Partial<PlanEditorViewProps> = {}): PlanEditorViewProps {
  const items = [...INCOME, ...LIMITS];
  const totals = {
    currency: 'PLN',
    incomeMinor: 1420000n,
    expensesMinor: 1180000n,
    leftMinor: 240000n,
    excludedCount: 0,
  };

  return {
    plan: OCTOBER,
    totals: items.length > 0 ? totals : computePlanTotals([], 'PLN'),
    income: INCOME,
    limits: LIMITS,
    draft: DRAFT,
    draftErrors: NO_DRAFT_ERRORS,
    draftCategories: [
      { value: 'cat-home', label: 'Home' },
      { value: 'cat-health', label: 'Health' },
    ],
    saving: false,
    saveError: null,
    onNameChange: noop,
    onBaseCurrencyChange: noop,
    onPeriodKindChange: noop,
    onCustomDatesChange: noop,
    onDraftChange: noop,
    onAddItem: noop,
    onSave: noop,
    onChange: noop,
    onHistory: noop,
    onInvalidAmount: noop,
    onRemove: noop,
    ...overrides,
  };
}

function listProps(overrides: Partial<PlansListViewProps> = {}): PlansListViewProps {
  return {
    plans: PLANS,
    loading: false,
    error: null,
    creating: false,
    onCreate: noop,
    onOpen: noop,
    onClone: noop,
    onDelete: noop,
    onRetry: noop,
    ...overrides,
  };
}

function Stage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div style={STAGE}>
      <AmbientField />
      <div style={LAYER}>{children}</div>
    </div>
  );
}

/** Plan cards: two active plans and an archived one. */
export function PlansList(): React.JSX.Element {
  return (
    <Stage>
      <PlansListView {...listProps()} />
    </Stage>
  );
}

export function PlansListEmpty(): React.JSX.Element {
  return (
    <Stage>
      <PlansListView {...listProps({ plans: [] })} />
    </Stage>
  );
}

export function PlansListLoading(): React.JSX.Element {
  return (
    <Stage>
      <PlansListView {...listProps({ plans: [], loading: true })} />
    </Stage>
  );
}

export function PlansListError(): React.JSX.Element {
  return (
    <Stage>
      <PlansListView {...listProps({ plans: [], error: 'Failed to load plans' })} />
    </Stage>
  );
}

/** Totals tiles, income panel, category limits with rods and steppers, and the add row. */
export function PlanEditor(): React.JSX.Element {
  return (
    <Stage>
      <PlanEditorView {...editorProps()} />
    </Stage>
  );
}

/** Over-planned: limits above income, a save error and an item in another currency. */
export function PlanEditorOverPlanned(): React.JSX.Element {
  return (
    <Stage>
      <PlanEditorView
        {...editorProps({
          totals: {
            currency: 'PLN',
            incomeMinor: 1300000n,
            expensesMinor: 1420000n,
            leftMinor: -120000n,
            excludedCount: 1,
          },
          saveError: 'Failed to save plan',
          limits: [...LIMITS, row('l-eur', 'Holidays', 'expense', '30000', null, 'EUR')],
        })}
      />
    </Stage>
  );
}

/** Nothing planned yet. */
export function PlanEditorEmpty(): React.JSX.Element {
  return (
    <Stage>
      <PlanEditorView
        {...editorProps({
          income: [],
          limits: [],
          totals: computePlanTotals([], 'PLN'),
        })}
      />
    </Stage>
  );
}

/** Custom period: the date picker shows inside the plan details. */
export function PlanEditorCustomPeriod(): React.JSX.Element {
  return (
    <Stage>
      <PlanEditorView {...editorProps({ plan: { ...OCTOBER, periodKind: 'custom' } })} />
    </Stage>
  );
}

/** Clone dialog with a custom period. */
export function ClonePlanDialog(): React.JSX.Element {
  const [dates, setDates] = useState({ startDate: '2026-11-01', endDate: '2026-11-30' });

  return (
    <Stage>
      <Modal
        isOpen
        title="Clone Plan"
        onClose={noop}
        footerButtons={[
          { label: 'Cancel', variant: 'secondary', onClick: noop },
          { label: 'Clone', variant: 'primary', onClick: noop },
        ]}
      >
        <ClonePlanForm
          period="custom"
          customDates={dates}
          loading={false}
          error={null}
          onPeriodChange={noop}
          onCustomDatesChange={setDates}
        />
      </Modal>
    </Stage>
  );
}

export function ClonePlanDialogError(): React.JSX.Element {
  return (
    <Stage>
      <Modal isOpen title="Clone Plan" onClose={noop}>
        <ClonePlanForm
          period="monthly"
          customDates={{ startDate: '', endDate: '' }}
          loading={false}
          error="Failed to clone plan"
          onPeriodChange={noop}
          onCustomDatesChange={noop}
        />
      </Modal>
    </Stage>
  );
}

const VERSIONS: readonly PlannedItemVersionDto[] = [
  {
    id: 'v-2',
    plannedItemId: 'l-food',
    changedBy: 'user-anna',
    changedAt: '2026-10-03T10:00:00.000Z',
    reason: null,
    before: { amount: { amountMinor: '200000', currency: 'PLN' } },
    after: { amount: { amountMinor: '220000', currency: 'PLN' } },
  },
  {
    id: 'v-1',
    plannedItemId: 'l-food',
    changedBy: 'user-marek',
    changedAt: '2026-09-28T08:30:00.000Z',
    reason: 'Prices went up',
    before: { amount: { amountMinor: '180000', currency: 'PLN' } },
    after: { amount: { amountMinor: '200000', currency: 'PLN' } },
  },
];

/** History drawer with two changes, one by you and one by a household member. */
export function PlannedItemHistory(): React.JSX.Element {
  return (
    <Stage>
      <Drawer isOpen onClose={noop} title="History" width={480}>
        <PlannedItemHistoryView
          versions={VERSIONS}
          loading={false}
          failed={false}
          currentUserId="user-anna"
        />
      </Drawer>
    </Stage>
  );
}

export function PlannedItemHistoryEmpty(): React.JSX.Element {
  return (
    <Stage>
      <Drawer isOpen onClose={noop} title="History" width={480}>
        <PlannedItemHistoryView versions={[]} loading={false} failed={false} currentUserId="u" />
      </Drawer>
    </Stage>
  );
}
