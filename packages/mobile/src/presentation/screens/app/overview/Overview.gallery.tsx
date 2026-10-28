import React from 'react';
import { ShellBackground } from '../../../navigation/ShellBackground.js';
import type { SyncChipState } from '../../../glass/atoms/syncChipState.js';
import { d7Model, pln } from './overviewFixtures.js';
import type { OverviewModel } from './overviewModel.js';
import { OverviewView } from './OverviewView.js';
import type { OverviewError, OverviewPlanChoice } from './useOverviewData.js';

// Fixture data lives in overviewFixtures.ts (D7 spec sample month); no JSX literals here.
const SYNC: SyncChipState = { kind: 'bank-age', ageMinutes: 120 };
const NO_PLANS: readonly OverviewPlanChoice[] = [];
const TWO_PLANS: readonly OverviewPlanChoice[] = [
  { id: 'plan-d7', name: 'October' },
  { id: 'plan-anna', name: 'Anna · October' },
];

interface FixtureProps {
  readonly model: OverviewModel | null;
  readonly loading?: boolean;
  readonly error?: OverviewError | null;
  readonly noActivePlan?: boolean;
  readonly plans?: readonly OverviewPlanChoice[];
  readonly toSortCount?: number | null;
  readonly sync?: SyncChipState | null;
}

function Fixture({
  model,
  loading = false,
  error = null,
  noActivePlan = false,
  plans = NO_PLANS,
  toSortCount = null,
  sync = null,
}: FixtureProps): React.JSX.Element {
  return (
    <ShellBackground>
      <OverviewView
        model={model}
        loading={loading}
        refreshing={false}
        error={error}
        noActivePlan={noActivePlan}
        plans={plans}
        selectedPlanId={model === null ? null : model.planId}
        toSortCount={toSortCount}
        sync={sync}
        onSelectPlan={noop}
        onRefresh={noop}
        onRetry={noop}
        onOpenToSort={noop}
        onOpenPlans={noop}
      />
    </ShellBackground>
  );
}

/** D7-M-Dashboard: 477 zł a day for 10 days, under pace, 3 to sort, PKO BP synced 2 h ago. */
export function Current(): React.JSX.Element {
  return <Fixture model={d7Model()} toSortCount={3} sync={SYNC} />;
}

/** Two active plans (picker), the plan spent: 0 a day with an Over tag, over pace. */
export function OverPlan(): React.JSX.Element {
  return (
    <Fixture
      model={d7Model({ totalActualExpenses: pln(1200000n), unplannedExpenses: pln(0n) })}
      plans={TWO_PLANS}
      sync={{ kind: 'renew' }}
    />
  );
}

/** A past plan: no lens, no pace, no forecast; only what was left. */
export function PastPlan(): React.JSX.Element {
  return <Fixture model={d7Model({ asOf: '2026-11-03' })} />;
}

/** Loading skeleton, missing FX rates and no active plan. */
export function States(): React.JSX.Element {
  return (
    <>
      <Fixture model={null} loading />
      <Fixture model={null} error="fx_unavailable" />
      <Fixture model={null} noActivePlan />
    </>
  );
}

function noop(): void {
  // Gallery fixtures do not react to input.
}
