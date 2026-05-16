import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types.js';
import { planService } from '../../../infrastructure/index.js';
import type { Plan } from '../../../infrastructure/index.js';

const t = rnDarkTheme;

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Plans'>,
  NativeStackScreenProps<AppStackParamList>
>;

function PlanCard({
  plan,
  onPress,
}: {
  readonly plan: Plan;
  readonly onPress: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {plan.name}
        </Text>
        <Text style={styles.cardCurrency}>{plan.baseCurrency}</Text>
      </View>
      <Text style={styles.cardMeta}>
        {intl.formatMessage(
          { id: 'plan.period', defaultMessage: '{start} – {end}' },
          { start: plan.period.start, end: plan.period.end },
        )}
      </Text>
      <Text style={styles.cardType}>
        {plan.type === 'household'
          ? intl.formatMessage({ id: 'plan.type.household', defaultMessage: 'Household' })
          : intl.formatMessage({ id: 'plan.type.personal', defaultMessage: 'Personal' })}
      </Text>
    </TouchableOpacity>
  );
}

export function PlansListScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPlans = useCallback(async () => {
    try {
      const data = await planService.listPlans();
      setPlans(data.filter((p) => p.archivedAt === null));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.plansLoadFailed',
          defaultMessage: 'Could not load plans. Please try again.',
        }),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [intl]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    void loadPlans();
  };

  const handleCreate = (): void => {
    navigation.navigate('PlanEditor', {});
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={t.colorAccentDefault} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={plans}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              <FormattedMessage
                id="screen.plansList.empty"
                defaultMessage="No plans yet. Create your first budget plan."
              />
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PlanCard
            plan={item}
            onPress={() => {
              navigation.navigate('PlanEditor', { planId: item.id });
            }}
          />
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreate} activeOpacity={0.8}>
        <Text style={styles.fabIcon}>
          {intl.formatMessage({ id: 'action.plus', defaultMessage: '+' })}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colorSurfaceBase,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: t.spaceMd,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    marginBottom: t.spaceSm,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spaceXs,
  },
  cardName: {
    flex: 1,
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginRight: t.spaceSm,
  },
  cardCurrency: {
    fontSize: t.fontSizeSm,
    color: t.colorAccentDefault,
    fontWeight: t.fontWeightMedium,
  },
  cardMeta: {
    fontSize: t.fontSizeSm,
    color: t.colorTextSecondary,
    marginBottom: t.spaceXs,
  },
  cardType: {
    fontSize: t.fontSizeXs,
    color: t.colorTextMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: t.space4xl,
  },
  emptyText: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeMd,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: t.spaceLg,
    bottom: t.spaceLg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.colorAccentDefault,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  fabIcon: {
    fontSize: t.fontSizeXl,
    color: t.colorAccentOnAccent,
    fontWeight: t.fontWeightBold,
    lineHeight: 24,
  },
});
