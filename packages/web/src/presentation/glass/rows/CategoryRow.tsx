import React from 'react';
import type { CategoryRowData, RodData } from '@power-budget/shared-app';
import { AmountText } from '../atoms/AmountText.js';
import { StatusTag } from '../atoms/StatusTag.js';
import '../controls/controls.css';
import { Rod } from '../light/Rod.js';
import { useLightLabels } from '../light/useLightLabels.js';
import {
  LINE_STYLE,
  MAIN_BUTTON_STYLE,
  PLAIN_MAIN_STYLE,
  ROW_STYLE,
  SMALL_STYLE,
  TEXT_COLUMN_STYLE,
  TITLE_STYLE,
} from './rowStyles.js';
import { useRowLabels, type RowLabels } from './useRowLabels.js';

export interface CategoryRowProps {
  readonly category: CategoryRowData;
  /** Position in a list; staggers the rod entrance. */
  readonly index?: number;
  readonly onPress?: (id: string) => void;
}

interface Money {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/**
 * A plan category: name, rod, the amount left and a status tag. With `totalOnly` (privacy) the row
 * shows the total spent and nothing else: no plan, no rod, no amount left.
 */
export function CategoryRow({ category, index, onPress }: CategoryRowProps): React.JSX.Element {
  const labels = useRowLabels();
  const spent = { amountMinor: category.spentMinor, currency: category.currency };
  const totalOnly = category.totalOnly === true;
  const name = labels.categoryName(category.label, spent, totalOnly);
  const main = (
    <span style={TEXT_COLUMN_STYLE}>
      <span style={TITLE_STYLE}>{category.label}</span>
      {totalOnly ? <span style={SMALL_STYLE}>{labels.totalSpent()}</span> : null}
    </span>
  );

  return (
    <div role="group" aria-label={name} data-testid="category-row" style={ROW_STYLE}>
      <div style={LINE_STYLE}>
        {onPress === undefined ? (
          <div style={PLAIN_MAIN_STYLE}>{main}</div>
        ) : (
          <button
            type="button"
            className="pbg-ctl"
            onClick={() => onPress(category.id)}
            style={MAIN_BUTTON_STYLE}
          >
            {main}
          </button>
        )}
        {totalOnly ? (
          <span style={{ fontSize: 'var(--pb-glass-type-panel-label-web)' }}>
            <AmountText amount={spent} />
          </span>
        ) : (
          <CategoryFigures category={category} labels={labels} />
        )}
      </div>
      {totalOnly ? (
        <div>
          <StatusTag kind="neutral" label={labels.totalsOnly()} icon="lock" />
        </div>
      ) : (
        <CategoryRod category={category} index={index} labels={labels} />
      )}
    </div>
  );
}

function CategoryFigures({
  category,
  labels,
}: {
  category: CategoryRowData;
  labels: RowLabels;
}): React.JSX.Element {
  const left = {
    amountMinor: category.plannedMinor - category.spentMinor,
    currency: category.currency,
  };
  const planned = { amountMinor: category.plannedMinor, currency: category.currency };

  return (
    <span
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
        fontSize: 'var(--pb-glass-type-panel-label-web)',
      }}
    >
      <span data-testid="category-left">
        {category.status === 'over' || category.paid ? (
          <AmountText amount={{ ...left, amountMinor: category.spentMinor }} />
        ) : (
          labels.left(left)
        )}
      </span>
      <span style={SMALL_STYLE}>{labels.planned(planned)}</span>
      {category.forecastMinor === undefined ? null : (
        <span style={SMALL_STYLE}>
          {labels.forecast({ amountMinor: category.forecastMinor, currency: category.currency })}
        </span>
      )}
    </span>
  );
}

function CategoryRod({
  category,
  index,
  labels,
}: {
  category: CategoryRowData;
  index?: number;
  labels: RowLabels;
}): React.JSX.Element {
  const lightLabels = useLightLabels();
  const planned = { amountMinor: category.plannedMinor, currency: category.currency };
  const left = {
    amountMinor: category.plannedMinor - category.spentMinor,
    currency: category.currency,
  };
  const over = {
    amountMinor: category.spentMinor - category.plannedMinor,
    currency: category.currency,
  };
  const state = rodState(category, left);
  const rod: RodData = {
    fraction: rodFraction(left, planned),
    state,
    size: 'category',
    ariaLabel: lightLabels.rodAria(category.label, state, state === 'over' ? over : left, planned),
  };

  return (
    <>
      <Rod rod={rod} index={index} tagLabel={rodTagLabel(state, over, labels)} />
      {state === 'under' || state === 'empty' ? (
        <div>
          <StatusTag kind={category.status} label={labels.underPlan()} />
        </div>
      ) : null}
    </>
  );
}

function rodState(category: CategoryRowData, left: Money): RodData['state'] {
  if (category.paid) {
    return 'paid';
  }
  if (category.status === 'over' || left.amountMinor < 0n) {
    return 'over';
  }
  if (left.amountMinor === 0n) {
    return 'empty';
  }

  return 'under';
}

function rodFraction(left: Money, planned: Money): number {
  if (planned.amountMinor <= 0n || left.amountMinor <= 0n) {
    return 0;
  }

  return Math.min(1, Number(left.amountMinor) / Number(planned.amountMinor));
}

function rodTagLabel(state: RodData['state'], over: Money, labels: RowLabels): string | undefined {
  if (state === 'over') {
    return labels.overBy(over);
  }
  if (state === 'paid') {
    return labels.paid();
  }

  return undefined;
}
