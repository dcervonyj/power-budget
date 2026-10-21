import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  Alert,
  TextInput,
  TouchableOpacity,
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
import {
  formatMoneyInput,
  isSupportedCurrency,
  parseMinorUnits,
  parseMoney,
} from '@power-budget/core';
import type {
  CreatePlanDto,
  MoneyDto,
  PlanPeriodKindDto,
  PlannedItemDirectionDto,
  PlannedItemDto,
  UpdatePlanDto,
} from '@power-budget/shared-app/contract';
import { plansApi } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AppStackParamList, 'PlanEditor'>;

const PERIOD_KIND_OPTIONS: Array<{ value: PlanPeriodKindDto; label: string }> = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const COMMON_CURRENCIES = ['USD', 'EUR', 'PLN', 'GBP', 'UAH', 'RUB'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfMonthIso(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

/** Minor units (API integer string) as major-unit input text, with the currency's exponent. */
function formatAmount(amount: MoneyDto): string {
  try {
    return formatMoneyInput(parseMinorUnits(amount.amountMinor), amount.currency);
  } catch {
    return '';
  }
}

/** Major-unit input text as exact minor units, or null when it is not an amount. */
function parseAmount(text: string, currency: string): string | null {
  try {
    return parseMoney(text, currency).toString();
  } catch {
    return null;
  }
}

interface PlannedItemRowProps {
  readonly item: PlannedItemDto;
  readonly onAmountChange: (itemId: string, amountText: string) => void;
  readonly onAmountBlur: (itemId: string) => void;
  readonly onDelete: (itemId: string) => void;
  readonly amountText: string;
}

function PlannedItemRow({
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
        <Text style={styles.itemCurrency}>{item.amount.currency}</Text>
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

export function PlanEditorScreen({ route, navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const planId = route.params?.planId;
  const isNew = planId === undefined;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PlannedItemDto[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [periodKind, setPeriodKind] = useState<PlanPeriodKindDto>('monthly');
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(endOfMonthIso);
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  const pendingItemSaves = useRef<Set<string>>(new Set());

  const loadPlan = useCallback(
    async (id: string) => {
      try {
        const [p, its] = await Promise.all([plansApi.get(id), plansApi.listItems(id)]);
        setName(p.name);
        setPeriodKind(p.periodKind);
        setStartDate(p.period.start);
        setEndDate(p.period.end);
        setBaseCurrency(p.baseCurrency);
        setItems(its);
        const drafts: Record<string, string> = {};
        for (const item of its) {
          drafts[item.id] = formatAmount(item.amount);
        }
        setAmountDrafts(drafts);
      } catch {
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.planLoadFailed',
            defaultMessage: 'Could not load plan.',
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [intl],
  );

  useEffect(() => {
    if (!isNew && planId !== undefined) {
      void loadPlan(planId);
    }
  }, [isNew, planId, loadPlan]);

  // Auto-adjust end date based on periodKind
  useEffect(() => {
    if (periodKind === 'weekly') {
      const start = new Date(`${startDate}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() + 6);
      setEndDate(start.toISOString().slice(0, 10));
    } else if (periodKind === 'monthly') {
      const start = new Date(`${startDate}T00:00:00Z`);
      start.setUTCMonth(start.getUTCMonth() + 1, 0);
      setEndDate(start.toISOString().slice(0, 10));
    }
  }, [periodKind, startDate]);

  const handleSavePlan = async (): Promise<void> => {
    if (!name.trim()) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({
          id: 'error.plan.nameRequired',
          defaultMessage: 'Plan name is required.',
        }),
      );
      return;
    }

    if (!isSupportedCurrency(baseCurrency)) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({
          id: 'error.plan.currencyUnsupported',
          defaultMessage: 'This currency is not supported.',
        }),
      );
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        // Weekly and monthly plans get their end date from the API.
        const body: CreatePlanDto =
          periodKind === 'custom'
            ? {
                name: name.trim(),
                type: 'personal',
                periodKind,
                periodStart: startDate,
                periodEnd: endDate,
                baseCurrency,
              }
            : {
                name: name.trim(),
                type: 'personal',
                periodKind,
                periodStart: startDate,
                baseCurrency,
              };
        const created = await plansApi.create(body);
        navigation.replace('PlanEditor', { planId: created.id });
      } else if (planId !== undefined) {
        // UpdatePlanDto has no periodKind: the kind of an existing plan is fixed.
        const body: UpdatePlanDto =
          periodKind === 'custom'
            ? { name: name.trim(), baseCurrency, periodStart: startDate, periodEnd: endDate }
            : { name: name.trim(), baseCurrency };
        await plansApi.update(planId, body);
        Alert.alert(
          intl.formatMessage({ id: 'success.title', defaultMessage: 'Saved' }),
          intl.formatMessage({ id: 'plan.saved', defaultMessage: 'Plan saved.' }),
        );
      }
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.planSaveFailed', defaultMessage: 'Could not save plan.' }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (itemId: string, text: string): void => {
    setAmountDrafts((prev) => ({ ...prev, [itemId]: text }));
  };

  const handleAmountBlur = async (itemId: string): Promise<void> => {
    const item = items.find((i) => i.id === itemId);
    if (!planId || !item || pendingItemSaves.current.has(itemId)) return;
    const amountMinor = parseAmount(amountDrafts[itemId] ?? '', item.amount.currency);
    const { currency } = item.amount;
    if (amountMinor === null || !isSupportedCurrency(currency)) {
      setAmountDrafts((prev) => ({ ...prev, [itemId]: formatAmount(item.amount) }));
      return;
    }
    pendingItemSaves.current.add(itemId);
    try {
      const updated = await plansApi.updateItem(planId, itemId, { amountMinor, currency });
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      setAmountDrafts((prev) => ({ ...prev, [itemId]: formatAmount(updated.amount) }));
    } catch {
      // silently revert
      setAmountDrafts((prev) => ({ ...prev, [itemId]: formatAmount(item.amount) }));
    } finally {
      pendingItemSaves.current.delete(itemId);
    }
  };

  const handleAddItem = async (direction: PlannedItemDirectionDto): Promise<void> => {
    if (!planId || !isSupportedCurrency(baseCurrency)) return;
    try {
      // TODO(CLN-015): pick a real category; the API needs a category id.
      const created = await plansApi.createItem(planId, {
        categoryId: 'uncategorized',
        direction,
        amountMinor: '0',
        currency: baseCurrency,
      });
      setItems((prev) => [...prev, created]);
      setAmountDrafts((prev) => ({ ...prev, [created.id]: formatAmount(created.amount) }));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.itemAddFailed', defaultMessage: 'Could not add item.' }),
      );
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    if (!planId) return;
    try {
      await plansApi.deleteItem(planId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.itemDeleteFailed',
          defaultMessage: 'Could not delete item.',
        }),
      );
    }
  };

  const handleArchive = (): void => {
    if (!planId) return;
    Alert.alert(
      intl.formatMessage({ id: 'plan.archive.confirm.title', defaultMessage: 'Archive Plan' }),
      intl.formatMessage({
        id: 'plan.archive.confirm.body',
        defaultMessage: 'Are you sure you want to archive this plan?',
      }),
      [
        {
          text: intl.formatMessage({ id: 'action.cancel', defaultMessage: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: intl.formatMessage({ id: 'action.archive', defaultMessage: 'Archive' }),
          style: 'destructive',
          onPress: () => {
            void plansApi.archive(planId).then(() => {
              navigation.goBack();
            });
          },
        },
      ],
    );
  };

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

      <Select<PlanPeriodKindDto>
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
  addItemRow: {
    marginTop: t.spaceXs,
  },
});
