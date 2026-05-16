import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { planService, apiClient } from '../../../infrastructure/index.js';
import type { Plan } from '../../../infrastructure/index.js';
import { ProgressBar } from '../../components/ProgressBar.js';
import { MoneyText } from '../../components/MoneyText.js';

const t = rnDarkTheme;

interface ActualsRow {
  plannedItemId: string;
  categoryId: string;
  name: string;
  direction: 'income' | 'expense';
  plannedAmountMinor: number;
  actualAmountMinor: number;
  currency: string;
}

interface PlanActualsView {
  planId: string;
  planName: string;
  period: { start: string; end: string };
  baseCurrency: string;
  items: ActualsRow[];
  unplannedCount: number;
  unplannedAmountMinor: number;
  totalIncomeActualMinor: number;
  totalIncomePlannedMinor: number;
  totalExpenseActualMinor: number;
  totalExpensePlannedMinor: number;
}

const POLL_INTERVAL_MS = 30_000;

export function DashboardScreen(): React.JSX.Element {
  const intl = useIntl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [actuals, setActuals] = useState<PlanActualsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadActuals = useCallback(
    async (planId: string, silent = false): Promise<void> => {
      if (!silent) setLoading(true);
      try {
        const response = await apiClient.get<PlanActualsView>(`/plans/${planId}/dashboard`);
        setActuals(response.data);
      } catch {
        if (!silent) {
          Alert.alert(
            intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
            intl.formatMessage({
              id: 'error.dashboardLoadFailed',
              defaultMessage: 'Could not load dashboard data.',
            }),
          );
        }
      } finally {
        if (!silent) setLoading(false);
        setRefreshing(false);
      }
    },
    [intl],
  );

  const loadPlans = useCallback(async (): Promise<void> => {
    try {
      const data = await planService.listPlans();
      const active = data.filter((p) => p.archivedAt === null);
      setPlans(active);
      if (active.length > 0 && active[0]) {
        setSelectedPlanId(active[0].id);
      }
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.plansLoadFailed',
          defaultMessage: 'Could not load plans. Please try again.',
        }),
      );
      setLoading(false);
    }
  }, [intl]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (!selectedPlanId) return;
    void loadActuals(selectedPlanId);

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      void loadActuals(selectedPlanId, true);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [selectedPlanId, loadActuals]);

  const handleRefresh = (): void => {
    if (!selectedPlanId) return;
    setRefreshing(true);
    void loadActuals(selectedPlanId);
  };

  if (loading && !actuals) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={t.colorAccentDefault} />
      </View>
    );
  }

  if (!selectedPlanId || plans.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>
          <FormattedMessage id="screen.dashboard.noPlan" defaultMessage="No active plan" />
        </Text>
      </View>
    );
  }

  const incomeItems = actuals?.items.filter((r) => r.direction === 'income') ?? [];
  const expenseItems = actuals?.items.filter((r) => r.direction === 'expense') ?? [];
  const net = (actuals?.totalIncomeActualMinor ?? 0) - (actuals?.totalExpenseActualMinor ?? 0);
  const baseCurrency = actuals?.baseCurrency ?? '';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={t.colorAccentDefault}
        />
      }
    >
      {/* Plan picker */}
      {plans.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.planPicker}>
          {plans.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.planChip, selectedPlanId === p.id && styles.planChipActive]}
              onPress={() => setSelectedPlanId(p.id)}
            >
              <Text
                style={[
                  styles.planChipText,
                  selectedPlanId === p.id && styles.planChipTextActive,
                ]}
              >
                {p.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Plan header */}
      {actuals && (
        <View style={styles.header}>
          <Text style={styles.planName}>{actuals.planName}</Text>
          <Text style={styles.planPeriod}>
            {intl.formatMessage(
              { id: 'screen.dashboard.period', defaultMessage: '{start} → {end}' },
              { start: actuals.period.start, end: actuals.period.end },
            )}
          </Text>
          <Text style={styles.planCurrency}>{actuals.baseCurrency}</Text>
        </View>
      )}

      {/* Income section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <FormattedMessage id="screen.dashboard.income" defaultMessage="Income" />
        </Text>
        {incomeItems.length === 0 ? (
          <Text style={styles.emptySection}>{intl.formatMessage({ id: 'common.emptyIndicator', defaultMessage: '—' })}</Text>
        ) : (
          incomeItems.map((row) => (
            <View key={row.plannedItemId} style={styles.row}>
              <Text style={styles.rowName} numberOfLines={1}>
                {row.name}
              </Text>
              <View style={styles.rowAmounts}>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>
                    <FormattedMessage id="screen.dashboard.planned" defaultMessage="Planned" />
                  </Text>
                  <MoneyText amountMinor={row.plannedAmountMinor} currency={row.currency} />
                </View>
                <View style={styles.amountCol}>
                  <Text style={styles.amountLabel}>
                    <FormattedMessage id="screen.dashboard.actual" defaultMessage="Actual" />
                  </Text>
                  <MoneyText
                    amountMinor={row.actualAmountMinor}
                    currency={row.currency}
                    style={{ color: t.colorIncomeDefault }}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Expense section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          <FormattedMessage id="screen.dashboard.expenses" defaultMessage="Expenses" />
        </Text>
        {expenseItems.length === 0 ? (
          <Text style={styles.emptySection}>{intl.formatMessage({ id: 'common.emptyIndicator', defaultMessage: '—' })}</Text>
        ) : (
          expenseItems.map((row) => {
            const ratio =
              row.plannedAmountMinor > 0 ? row.actualAmountMinor / row.plannedAmountMinor : 0;
            return (
              <View key={row.plannedItemId} style={styles.row}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {row.name}
                </Text>
                <ProgressBar ratio={ratio} />
                <View style={styles.rowAmounts}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>
                      <FormattedMessage id="screen.dashboard.planned" defaultMessage="Planned" />
                    </Text>
                    <MoneyText amountMinor={row.plannedAmountMinor} currency={row.currency} />
                  </View>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountLabel}>
                      <FormattedMessage id="screen.dashboard.actual" defaultMessage="Actual" />
                    </Text>
                    <MoneyText
                      amountMinor={row.actualAmountMinor}
                      currency={row.currency}
                      style={{
                        color:
                          ratio > 1
                            ? t.colorStatusDanger
                            : ratio > 0.8
                              ? t.colorStatusWarning
                              : t.colorTextPrimary,
                      }}
                    />
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Unplanned section */}
      {actuals && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <FormattedMessage id="screen.dashboard.unplanned" defaultMessage="Unplanned" />
          </Text>
          <View style={styles.unplannedRow}>
            <Text style={styles.unplannedCount}>
              {intl.formatMessage(
                { id: 'screen.dashboard.unplannedTransactions', defaultMessage: '{count} transactions' },
                { count: actuals.unplannedCount },
              )}
            </Text>
            <MoneyText
              amountMinor={actuals.unplannedAmountMinor}
              currency={baseCurrency}
              style={{ color: t.colorStatusWarning }}
            />
          </View>
        </View>
      )}

      {/* Net position */}
      {actuals && (
        <View style={styles.netContainer}>
          <Text style={styles.netLabel}>
            <FormattedMessage id="screen.dashboard.bottomLine" defaultMessage="Net" />
          </Text>
          <MoneyText
            amountMinor={net}
            currency={baseCurrency}
            style={[
              styles.netAmount,
              { color: net >= 0 ? t.colorStatusSuccess : t.colorStatusDanger },
            ]}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colorSurfaceBase },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: t.spaceMd, paddingBottom: 80 },
  planPicker: { marginBottom: t.spaceMd },
  planChip: {
    paddingHorizontal: t.spaceMd,
    paddingVertical: t.spaceXs,
    borderRadius: t.radiusPill,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
    marginRight: t.spaceSm,
    backgroundColor: t.colorSurfaceRaised,
  },
  planChipActive: {
    borderColor: t.colorAccentDefault,
    backgroundColor: t.colorAccentDefault,
  },
  planChipText: { color: t.colorTextSecondary, fontSize: t.fontSizeSm },
  planChipTextActive: { color: t.colorAccentOnAccent, fontWeight: t.fontWeightMedium },
  header: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    marginBottom: t.spaceMd,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  planName: {
    fontSize: t.fontSizeLg,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.spaceXs,
  },
  planPeriod: { fontSize: t.fontSizeSm, color: t.colorTextSecondary, marginBottom: t.spaceXs },
  planCurrency: { fontSize: t.fontSizeXs, color: t.colorAccentDefault },
  section: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    marginBottom: t.spaceMd,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  sectionTitle: {
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.spaceSm,
  },
  row: { marginBottom: t.spaceMd },
  rowName: { fontSize: t.fontSizeSm, color: t.colorTextPrimary, marginBottom: t.spaceXs },
  rowAmounts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spaceXs },
  amountCol: { alignItems: 'flex-start' },
  amountLabel: { fontSize: t.fontSizeXs, color: t.colorTextMuted, marginBottom: 2 },
  emptySection: { color: t.colorTextMuted, fontSize: t.fontSizeSm },
  unplannedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  unplannedCount: { fontSize: t.fontSizeSm, color: t.colorTextSecondary },
  netContainer: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  netLabel: { fontSize: t.fontSizeMd, fontWeight: t.fontWeightBold, color: t.colorTextPrimary },
  netAmount: { fontSize: t.fontSizeLg, fontWeight: t.fontWeightBold },
  emptyText: { color: t.colorTextSecondary, fontSize: t.fontSizeMd, textAlign: 'center' },
});
