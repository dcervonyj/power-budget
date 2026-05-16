import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { CustomPeriodPicker } from '../../components/CustomPeriodPicker.js';
import type { AppStackParamList } from '../../navigation/types.js';
import type { PlanPeriodKind } from '../../../infrastructure/index.js';
import { PlannedItemRow } from './PlannedItemRow.js';
import { usePlanEditor } from './usePlanEditor.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AppStackParamList, 'PlanEditor'>;

const PERIOD_KIND_OPTIONS: Array<{ value: PlanPeriodKind; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const COMMON_CURRENCIES = ['USD', 'EUR', 'PLN', 'GBP', 'UAH', 'RUB'];

export function PlanEditorScreen({ route, navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const planId = route.params?.planId;
  const isNew = planId === undefined;

  const {
    loading,
    saving,
    items,
    name,
    setName,
    periodKind,
    setPeriodKind,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    baseCurrency,
    setBaseCurrency,
    amountDrafts,
    handleSavePlan,
    handleAmountChange,
    handleAmountBlur,
    handleAddItem,
    handleDeleteItem,
    handleArchive,
  } = usePlanEditor(planId, navigation);

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={t.colorAccentDefault} />
      </View>
    );
  }

  const incomeItems = items.filter((i) => i.direction === 'income');
  const expenseItems = items.filter((i) => i.direction === 'expense');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionHeader}>
        <FormattedMessage id="plan.section.details" defaultMessage="Plan Details" />
      </Text>

      <Input
        label={intl.formatMessage({ id: 'plan.field.name', defaultMessage: 'Plan Name' })}
        value={name}
        onChangeText={setName}
        placeholder={intl.formatMessage({
          id: 'plan.field.name.placeholder',
          defaultMessage: 'e.g. January Budget',
        })}
      />

      <Select<PlanPeriodKind>
        label={intl.formatMessage({ id: 'plan.field.periodKind', defaultMessage: 'Period' })}
        options={PERIOD_KIND_OPTIONS.map((o) => ({
          value: o.value,
          label: intl.formatMessage({ id: `plan.periodKind.${o.value}`, defaultMessage: o.label }),
        }))}
        value={periodKind}
        onChange={setPeriodKind}
      />

      {periodKind === 'custom' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            <FormattedMessage id="plan.field.period" defaultMessage="Period Dates" />
          </Text>
          <CustomPeriodPicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        </View>
      )}

      {periodKind !== 'custom' && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>
            <FormattedMessage id="plan.field.startDate" defaultMessage="Start Date" />
          </Text>
          <CustomPeriodPicker
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
          />
        </View>
      )}

      <Select<string>
        label={intl.formatMessage({
          id: 'plan.field.baseCurrency',
          defaultMessage: 'Base Currency',
        })}
        options={COMMON_CURRENCIES.map((c) => ({ value: c, label: c }))}
        value={baseCurrency}
        onChange={setBaseCurrency}
      />

      <Button
        variant="primary"
        onPress={() => {
          void handleSavePlan();
        }}
        loading={saving}
      >
        {isNew
          ? intl.formatMessage({ id: 'action.createPlan', defaultMessage: 'Create Plan' })
          : intl.formatMessage({ id: 'action.savePlan', defaultMessage: 'Save Changes' })}
      </Button>

      {!isNew && planId !== undefined && (
        <>
          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>
            <FormattedMessage id="plan.section.income" defaultMessage="Income" />
          </Text>
          {incomeItems.map((item) => (
            <PlannedItemRow
              key={item.id}
              item={item}
              amountText={amountDrafts[item.id] ?? '0.00'}
              onAmountChange={handleAmountChange}
              onAmountBlur={(id) => {
                void handleAmountBlur(id);
              }}
              onDelete={(id) => {
                void handleDeleteItem(id);
              }}
            />
          ))}
          <View style={styles.addItemRow}>
            <Button
              variant="secondary"
              onPress={() => {
                void handleAddItem('income');
              }}
            >
              {intl.formatMessage({ id: 'plan.addIncome', defaultMessage: '+ Add Income' })}
            </Button>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>
            <FormattedMessage id="plan.section.expenses" defaultMessage="Expenses" />
          </Text>
          {expenseItems.map((item) => (
            <PlannedItemRow
              key={item.id}
              item={item}
              amountText={amountDrafts[item.id] ?? '0.00'}
              onAmountChange={handleAmountChange}
              onAmountBlur={(id) => {
                void handleAmountBlur(id);
              }}
              onDelete={(id) => {
                void handleDeleteItem(id);
              }}
            />
          ))}
          <View style={styles.addItemRow}>
            <Button
              variant="secondary"
              onPress={() => {
                void handleAddItem('expense');
              }}
            >
              {intl.formatMessage({ id: 'plan.addExpense', defaultMessage: '+ Add Expense' })}
            </Button>
          </View>

          <View style={styles.divider} />

          <Button variant="danger" onPress={handleArchive}>
            {intl.formatMessage({ id: 'action.archivePlan', defaultMessage: 'Archive Plan' })}
          </Button>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: t.spaceLg,
    backgroundColor: t.colorSurfaceBase,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionHeader: {
    fontSize: t.fontSizeLg,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.spaceMd,
    marginTop: t.spaceSm,
  },
  fieldGroup: {
    marginBottom: t.spaceMd,
  },
  fieldLabel: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeSm,
    marginBottom: t.spaceXs,
  },
  divider: {
    height: 1,
    backgroundColor: t.colorBorderSubtle,
    marginVertical: t.spaceLg,
  },
  addItemRow: {
    marginTop: t.spaceXs,
  },
});
