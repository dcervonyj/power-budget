import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import { isPlanArchived } from '@power-budget/shared-app';
import type { PlanDto, PlanPeriodKindDto } from '@power-budget/shared-app/contract';
import { Button } from '../../../components/Button.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { formatPlanPeriod } from './planText.js';
import { usePlanStyles } from './planStyles.js';

export interface PlansListViewProps {
  readonly plans: readonly PlanDto[];
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly error: string | null;
  readonly creating: boolean;
  readonly onCreate: () => void;
  readonly onOpen: (planId: string) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
}

const useStyles = makeStyles((glass) => ({
  open: { gap: glass.space.xs, minHeight: 44, justifyContent: 'center' },
  name: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.heading.mobile,
  },
}));

export function PlansListView({
  plans,
  loading,
  refreshing,
  error,
  creating,
  onCreate,
  onOpen,
  onRefresh,
  onRetry,
}: PlansListViewProps): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();
  const shared = usePlanStyles();
  const styles = useStyles();
  const createLabel = intl.formatMessage({
    id: 'plan.list.create',
    defaultMessage: 'Create new plan',
  });

  return (
    <ScrollView
      contentContainerStyle={shared.page}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={glass.colors.fg} />
      }
    >
      <Button variant="primary" loading={creating} onPress={onCreate}>
        {createLabel}
      </Button>

      {loading ? (
        <View style={shared.centered}>
          <ActivityIndicator
            accessibilityLabel={intl.formatMessage({
              id: 'plan.loading',
              defaultMessage: 'Loading',
            })}
            color={glass.colors.fg}
          />
        </View>
      ) : null}

      {!loading && error !== null ? (
        <GlassPanel material="tinted" depth={1} contentStyle={shared.panelContent}>
          <Text accessibilityRole="alert" style={shared.noticeText}>
            {error}
          </Text>
          <Button variant="secondary" onPress={onRetry}>
            {intl.formatMessage({ id: 'plan.retry', defaultMessage: 'Try again' })}
          </Button>
        </GlassPanel>
      ) : null}

      {!loading && error === null && plans.length === 0 ? (
        <GlassPanel material="frosted" depth={1} contentStyle={shared.panelContent}>
          <Text style={styles.name}>
            {intl.formatMessage({ id: 'plan.list.empty', defaultMessage: 'No plans yet' })}
          </Text>
        </GlassPanel>
      ) : null}

      {!loading
        ? plans.map((plan, index) => (
            <PlanCard key={plan.id} plan={plan} index={index} onOpen={onOpen} />
          ))
        : null}
    </ScrollView>
  );
}

function PlanCard({
  plan,
  index,
  onOpen,
}: {
  readonly plan: PlanDto;
  readonly index: number;
  readonly onOpen: (planId: string) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const shared = usePlanStyles();
  const styles = useStyles();
  const archived = isPlanArchived(plan);
  const period = formatPlanPeriod(intl, plan.period.start, plan.period.end);
  const caption = `${periodLabel(intl.formatMessage, plan.periodKind)} · ${period}`;

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={index}
      decor={{ specular: true }}
      contentStyle={shared.panelContent}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          onOpen(plan.id);
        }}
        style={styles.open}
      >
        <Text style={styles.name}>{plan.name}</Text>
        <Text style={shared.caption}>{caption}</Text>
      </Pressable>
      <StatusTag
        kind={archived ? 'neutral' : 'ok'}
        icon={archived ? 'lock' : 'check'}
        label={
          archived
            ? intl.formatMessage({ id: 'plan.status.archived', defaultMessage: 'Archived' })
            : intl.formatMessage({ id: 'plan.status.active', defaultMessage: 'Active' })
        }
      />
    </GlassPanel>
  );
}

type FormatMessage = ReturnType<typeof useIntl>['formatMessage'];

function periodLabel(formatMessage: FormatMessage, kind: PlanPeriodKindDto): string {
  switch (kind) {
    case 'weekly':
      return formatMessage({ id: 'plan.periodKind.weekly', defaultMessage: 'Weekly' });
    case 'monthly':
      return formatMessage({ id: 'plan.periodKind.monthly', defaultMessage: 'Monthly' });
    case 'custom':
      return formatMessage({ id: 'plan.periodKind.custom', defaultMessage: 'Custom' });
  }
}
