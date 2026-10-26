import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinorUnitAmount } from '@power-budget/core';
import type { CategoryRowData, RodData } from '@power-budget/shared-app';
import { AmountText } from '../atoms/AmountText.js';
import { StatusTag } from '../atoms/StatusTag.js';
import { Rod } from '../light/Rod.js';
import { useLightLabels } from '../light/useLightLabels.js';
import { useRowStyles } from './rowStyles.js';
import { useRowLabels, type RowLabels } from './useRowLabels.js';

export interface CategoryRowProps {
  readonly category: CategoryRowData;
  /** Position in a list; staggers the rod entrance. */
  readonly index?: number;
  readonly onPress?: (id: string) => void;
}

/**
 * A plan category: name, rod, the amount left and a status tag. With `totalOnly` (privacy) the row
 * shows the total spent and nothing else: no plan, no rod, no amount left.
 */
export function CategoryRow({ category, index, onPress }: CategoryRowProps): React.JSX.Element {
  const styles = useRowStyles();
  const labels = useRowLabels();
  const spent = { amountMinor: category.spentMinor, currency: category.currency };
  const totalOnly = category.totalOnly === true;
  const name = labels.categoryName(category.label, spent, totalOnly);
  const main = (
    <View style={styles.textColumn}>
      <Text style={styles.title}>{category.label}</Text>
      {totalOnly ? <Text style={styles.small}>{labels.totalSpent()}</Text> : null}
    </View>
  );

  return (
    <View testID="category-row" role="group" accessibilityLabel={name} style={styles.row}>
      <View style={styles.line}>
        {onPress === undefined ? (
          <View testID="category-main" style={styles.mainArea}>
            {main}
          </View>
        ) : (
          <Pressable
            testID="category-main"
            accessibilityRole="button"
            onPress={() => onPress(category.id)}
            style={styles.mainArea}
          >
            {main}
          </Pressable>
        )}
        {totalOnly ? (
          <AmountText amount={spent} style={styles.figure} />
        ) : (
          <CategoryFigures category={category} labels={labels} />
        )}
      </View>
      {totalOnly ? (
        <StatusTag kind="neutral" label={labels.totalsOnly()} icon="lock" />
      ) : (
        <CategoryRod category={category} index={index} labels={labels} />
      )}
    </View>
  );
}

function CategoryFigures({
  category,
  labels,
}: {
  readonly category: CategoryRowData;
  readonly labels: RowLabels;
}): React.JSX.Element {
  const styles = useRowStyles();
  const left = leftOf(category);
  const planned = { amountMinor: category.plannedMinor, currency: category.currency };

  return (
    <View style={styles.figures}>
      <View testID="category-left">
        {category.status === 'over' || category.paid ? (
          <AmountText
            amount={{ amountMinor: category.spentMinor, currency: category.currency }}
            style={styles.figure}
          />
        ) : (
          <Text style={styles.figure}>{labels.left(left)}</Text>
        )}
      </View>
      <Text style={styles.small}>{labels.planned(planned)}</Text>
      {category.forecastMinor === undefined ? null : (
        <Text style={styles.small}>
          {labels.forecast({ amountMinor: category.forecastMinor, currency: category.currency })}
        </Text>
      )}
    </View>
  );
}

function CategoryRod({
  category,
  index,
  labels,
}: {
  readonly category: CategoryRowData;
  readonly index?: number;
  readonly labels: RowLabels;
}): React.JSX.Element {
  const lightLabels = useLightLabels();
  const planned = { amountMinor: category.plannedMinor, currency: category.currency };
  const left = leftOf(category);
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
        <StatusTag kind={category.status} label={labels.underPlan()} />
      ) : null}
    </>
  );
}

function leftOf(category: CategoryRowData): MinorUnitAmount {
  return {
    amountMinor: category.plannedMinor - category.spentMinor,
    currency: category.currency,
  };
}

function rodState(category: CategoryRowData, left: MinorUnitAmount): RodData['state'] {
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

function rodFraction(left: MinorUnitAmount, planned: MinorUnitAmount): number {
  if (planned.amountMinor <= 0n || left.amountMinor <= 0n) {
    return 0;
  }

  return Math.min(1, Number(left.amountMinor) / Number(planned.amountMinor));
}

function rodTagLabel(
  state: RodData['state'],
  over: MinorUnitAmount,
  labels: RowLabels,
): string | undefined {
  if (state === 'over') {
    return labels.overBy(over);
  }
  if (state === 'paid') {
    return labels.paid();
  }

  return undefined;
}
