import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { useIntl } from 'react-intl';

const t = rnDarkTheme;

export type TransactionStatus = 'mapped' | 'unmapped' | 'transfer';

interface TransactionStatusChipProps {
  readonly status: TransactionStatus;
}

export function TransactionStatusChip({ status }: TransactionStatusChipProps): React.JSX.Element {
  const intl = useIntl();
  const label =
    status === 'mapped'
      ? intl.formatMessage({ id: 'component.transactionStatus.mapped', defaultMessage: 'Mapped' })
      : status === 'transfer'
        ? intl.formatMessage({ id: 'component.transactionStatus.transfer', defaultMessage: 'Transfer' })
        : intl.formatMessage({ id: 'component.transactionStatus.unmapped', defaultMessage: 'Unmapped' });

  const bgColor =
    status === 'mapped'
      ? t.colorStatusSuccess
      : status === 'transfer'
        ? t.colorAccentDefault
        : t.colorStatusWarning;

  return (
    <View style={[styles.chip, { backgroundColor: bgColor }]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: t.radiusPill,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: t.fontSizeXs,
    color: t.colorSurfaceBase,
    fontWeight: t.fontWeightMedium,
  },
});
