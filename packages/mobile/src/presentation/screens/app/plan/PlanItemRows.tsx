import React from 'react';
import { Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import { formatMoneyParts } from '@power-budget/shared-app';
import type { CategoryRowData } from '@power-budget/shared-app';
import { Icon } from '../../../glass/atoms/Icon.js';
import { toSupportedLocale } from '../../../glass/atoms/supportedLocale.js';
import { IconButton } from '../../../glass/controls/IconButton.js';
import { Stepper } from '../../../glass/controls/Stepper.js';
import { CategoryRow } from '../../../glass/rows/CategoryRow.js';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { PlanAmountField } from './PlanAmountField.js';
import type { PlanItemHandlers, PlanItemRowModel } from './planModels.js';
import { stepMinorUnits, toSteppableMinor } from './planAmounts.js';
import { usePlanStyles } from './planStyles.js';

interface RowsProps extends PlanItemHandlers {
  readonly rows: readonly PlanItemRowModel[];
}

interface RowProps extends PlanItemHandlers {
  readonly row: PlanItemRowModel;
  readonly index: number;
}

const useStyles = makeStyles((glass) => ({
  list: { gap: glass.space.md },
  item: { gap: glass.space.xs },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: glass.space.xs },
  name: { flex: 1, minWidth: 120 },
}));

export function PlanLimitList({ rows, ...handlers }: RowsProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <LimitRow key={row.id} row={row} index={index} {...handlers} />
      ))}
    </View>
  );
}

export function PlanIncomeList({ rows, ...handlers }: RowsProps): React.JSX.Element {
  const styles = useStyles();
  const shared = usePlanStyles();

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <View key={row.id} style={styles.controls}>
          <Text style={[shared.label, styles.name]}>{row.name}</Text>
          <ItemControls row={row} index={index} {...handlers} />
        </View>
      ))}
    </View>
  );
}

function LimitRow({ row, index, ...handlers }: RowProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const shared = usePlanStyles();
  const step = stepMinorUnits(row.currency);
  const value = toSteppableMinor(row.amountMinor);
  const category = toCategoryRowData(row);

  return (
    <View style={styles.item}>
      {category === null ? (
        <Text style={shared.label}>{row.name}</Text>
      ) : (
        <CategoryRow category={category} index={index} />
      )}
      <View style={styles.controls}>
        {step === null || value === null ? null : (
          <Stepper
            value={value}
            step={step}
            min={0}
            label={intl.formatMessage(
              { id: 'plan.limit.label', defaultMessage: '{category} limit' },
              { category: row.name },
            )}
            decrementLabel={intl.formatMessage(
              { id: 'plan.limit.decrease', defaultMessage: 'Decrease the {category} limit' },
              { category: row.name },
            )}
            incrementLabel={intl.formatMessage(
              { id: 'plan.limit.increase', defaultMessage: 'Increase the {category} limit' },
              { category: row.name },
            )}
            formatValue={(next) => formatLimit(intl, next, row.currency)}
            onChange={(next) => {
              handlers.onAmountChange(row.id, String(next));
            }}
          />
        )}
        <ItemControls row={row} index={index} {...handlers} />
      </View>
    </View>
  );
}

/** Keyboard amount and remove: the same for every item. */
function ItemControls({ row, onAmountChange, onRemove }: RowProps): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();

  return (
    <>
      <PlanAmountField
        label={intl.formatMessage(
          { id: 'plan.item.amount', defaultMessage: '{name} amount' },
          { name: row.name },
        )}
        value={row.amountInput}
        currency={row.currency}
        amountMinor={row.amountMinor}
        onCommit={(amountMinor) => {
          onAmountChange(row.id, amountMinor);
        }}
      />
      <IconButton
        label={intl.formatMessage(
          { id: 'plan.item.remove', defaultMessage: 'Remove {name}' },
          { name: row.name },
        )}
        onPress={() => {
          onRemove(row.id);
        }}
      >
        <Icon name="trash" size={18} color={glass.colors.fg} />
      </IconButton>
    </>
  );
}

function formatLimit(intl: IntlShape, amountMinor: number, currency: string): string {
  return formatMoneyParts(
    { amountMinor: BigInt(amountMinor), currency },
    toSupportedLocale(intl.locale),
  )
    .map((part) => part.value)
    .join('');
}

function toCategoryRowData(row: PlanItemRowModel): CategoryRowData | null {
  const planned = parseMinor(row.amountMinor);
  if (row.spentMinor === null || planned === null) {
    return null;
  }

  return {
    id: row.id,
    label: row.name,
    spentMinor: row.spentMinor,
    plannedMinor: planned,
    currency: row.currency,
    status: row.spentMinor > planned ? 'over' : 'ok',
    paid: false,
  };
}

function parseMinor(amountMinor: string): bigint | null {
  return /^-?\d+$/.test(amountMinor) ? BigInt(amountMinor) : null;
}
