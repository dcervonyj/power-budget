import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { SyncChip } from '../../../glass/atoms/SyncChip.js';
import type { SyncChipState } from '../../../glass/atoms/syncChipState.js';
import { FilterChips } from '../../../glass/controls/FilterChips.js';
import { EmptyState } from '../../../glass/overlays/EmptyState.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { SkeletonList } from '../../../glass/overlays/Skeleton.js';
import { CategoriesPanel } from './CategoriesPanel.js';
import { OverviewHero } from './OverviewHero.js';
import type { OverviewModel } from './overviewModel.js';
import { PacePanel } from './PacePanel.js';
import { ToSortCard } from './ToSortCard.js';
import type { OverviewError, OverviewPlanChoice } from './useOverviewData.js';
import { useOverviewLabels } from './useOverviewLabels.js';

const SKELETON_ROWS = 5;

const useStyles = makeStyles((glass) => ({
  content: { padding: glass.space.md, paddingBottom: glass.space['3xl'], gap: glass.space.lg },
  header: { gap: glass.space.xxs },
  title: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.title.mobile,
  },
  subtitle: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: glass.space.xs, marginTop: glass.space.xs },
}));

export interface OverviewViewProps {
  readonly model: OverviewModel | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly error: OverviewError | null;
  readonly noActivePlan: boolean;
  /** Plans to pick from; the picker shows when there are two or more. */
  readonly plans: readonly OverviewPlanChoice[];
  readonly selectedPlanId: string | null;
  readonly toSortCount: number | null;
  readonly sync: SyncChipState | null;
  readonly onSelectPlan: (planId: string) => void;
  readonly onRefresh: () => void;
  readonly onRetry: () => void;
  readonly onOpenToSort: () => void;
  /** Shown on the "no active plan" state when there is a way to make one. */
  readonly onOpenPlans?: () => void;
}

/**
 * D7-M-Dashboard as props only: header with the bank sync chip, the safe-to-spend hero, Pace, the
 * to-sort card and Categories. Panels without data (Coming up, shared costs) are not rendered.
 */
export function OverviewView(props: OverviewViewProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const labels = useOverviewLabels();
  const { model, error, plans, selectedPlanId } = props;

  return (
    <ScrollView
      testID="overview"
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={props.refreshing}
          onRefresh={props.onRefresh}
          tintColor={glass.colors.accent}
        />
      }
    >
      {plans.length > 1 && selectedPlanId !== null ? (
        <FilterChips
          label={labels.plans()}
          options={plans.map(toOption)}
          value={selectedPlanId}
          onChange={props.onSelectPlan}
        />
      ) : null}
      {error === null ? null : (
        <ErrorBanner message={labels.error(error)} onRetry={props.onRetry} />
      )}
      {props.noActivePlan ? (
        <EmptyState
          title={labels.noActivePlan()}
          subtitle={labels.noActivePlanHint()}
          action={
            props.onOpenPlans === undefined
              ? undefined
              : { label: labels.createPlan(), onPress: props.onOpenPlans }
          }
        />
      ) : null}
      {model === null && props.loading ? <SkeletonList rows={SKELETON_ROWS} /> : null}
      {model === null ? null : <OverviewContent {...props} model={model} />}
    </ScrollView>
  );
}

function OverviewContent({
  model,
  toSortCount,
  sync,
  onOpenToSort,
}: OverviewViewProps & { readonly model: OverviewModel }): React.JSX.Element {
  const styles = useStyles();
  const labels = useOverviewLabels();
  const { timing } = model;

  return (
    <>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {model.planName}
        </Text>
        <Text style={styles.subtitle}>
          {timing.kind === 'current'
            ? labels.today(timing.today, timing.day, timing.totalDays)
            : labels.period(model.periodStart, model.periodEnd)}
        </Text>
        {sync === null ? null : (
          <View style={styles.chips}>
            <SyncChip state={sync} />
          </View>
        )}
      </View>
      <OverviewHero model={model} />
      {timing.kind === 'current' && model.hasPlan ? (
        <PacePanel model={model} timing={timing} />
      ) : null}
      {toSortCount !== null && toSortCount > 0 ? (
        <ToSortCard count={toSortCount} onPress={onOpenToSort} />
      ) : null}
      <CategoriesPanel model={model} />
    </>
  );
}

function toOption(plan: OverviewPlanChoice): { value: string; label: string } {
  return { value: plan.id, label: plan.name };
}
