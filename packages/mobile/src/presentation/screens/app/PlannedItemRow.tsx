import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useIntl } from 'react-intl';
import { rnDarkTheme as t } from '@power-budget/design-tokens/rn';
import type { PlannedItem } from '../../../infrastructure/index.js';

interface PlannedItemRowProps {
  readonly item: PlannedItem;
  readonly onAmountChange: (itemId: string, amountText: string) => void;
  readonly onAmountBlur: (itemId: string) => void;
  readonly onDelete: (itemId: string) => void;
  readonly amountText: string;
}

export function PlannedItemRow({
  item,
  onAmountChange,
  onAmountBlur,
  onDelete,
  amountText,
}: PlannedItemRowProps): React.JSX.Element {
  const intl = useIntl();
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMeta}>
        <Text style={styles.itemDirection}>
          {item.direction === 'income'
            ? intl.formatMessage({ id: 'plan.direction.income', defaultMessage: '↑ Income' })
            : intl.formatMessage({ id: 'plan.direction.expense', defaultMessage: '↓ Expense' })}
        </Text>
        <Text style={styles.itemCurrency}>{item.currency}</Text>
      </View>
      <View style={styles.itemControls}>
        <TextInput
          style={styles.amountInput}
          value={amountText}
          onChangeText={(text) => {
            onAmountChange(item.id, text);
          }}
          onEndEditing={() => {
            onAmountBlur(item.id);
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={t.colorTextMuted}
        />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            onDelete(item.id);
          }}
          accessibilityLabel={intl.formatMessage({
            id: 'action.delete',
            defaultMessage: 'Delete',
          })}
        >
          <Text style={styles.deleteButtonText}>
            {intl.formatMessage({ id: 'action.close', defaultMessage: '×' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  itemRow: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusSm,
    padding: t.spaceSm,
    marginBottom: t.spaceSm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  itemMeta: {
    flex: 1,
  },
  itemDirection: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeSm,
    fontWeight: t.fontWeightMedium,
  },
  itemCurrency: {
    color: t.colorTextMuted,
    fontSize: t.fontSizeXs,
  },
  itemControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountInput: {
    backgroundColor: t.colorSurfaceMid,
    color: t.colorTextPrimary,
    fontSize: t.fontSizeMd,
    borderRadius: t.radiusSm,
    paddingHorizontal: t.spaceSm,
    paddingVertical: t.spaceXs,
    minWidth: 90,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
    fontFamily: 'monospace',
  },
  deleteButton: {
    marginLeft: t.spaceSm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.colorStatusDanger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: t.fontSizeLg,
    lineHeight: 20,
    fontWeight: t.fontWeightBold,
  },
});
