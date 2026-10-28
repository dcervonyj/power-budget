import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type { MinorUnitAmount } from '@power-budget/core';
import type { RodData } from '@power-budget/shared-app';
import { makeStyles } from '../../../theme/index.js';
import { FilterChips } from '../../../glass/controls/FilterChips.js';
import { LABEL_FONT } from '../../../glass/controls/fonts.js';
import { Rod } from '../../../glass/light/Rod.js';
import { useLightLabels } from '../../../glass/light/useLightLabels.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { EmptyState } from '../../../glass/overlays/EmptyState.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { SkeletonList } from '../../../glass/overlays/Skeleton.js';
import { TxRow } from '../../../glass/rows/TxRow.js';
import { LIST_FILTERS } from '../../../../infrastructure/transactions/TransactionListModel.js';
import type {
  DayGroup,
  ListFilter,
  MonthSummary,
} from '../../../../infrastructure/transactions/TransactionListModel.js';
import { TransactionActionButton } from './TransactionActionButton.js';
import { useTransactionLabels } from './useTransactionLabels.js';

export type TransactionListStatus = 'loading' | 'error' | 'ready';

export interface TransactionListViewProps {
  readonly status: TransactionListStatus;
  /** The month's expense plan; absent without an active plan, so no rod and no invented numbers. */
  readonly month?: MonthSummary;
  /** Spending still waiting to be sorted, in the plan's currency. */
  readonly waiting?: MinorUnitAmount;
  readonly filter: ListFilter;
  readonly counts: Readonly<Record<ListFilter, number>>;
  readonly onFilterChange: (filter: ListFilter) => void;
  readonly groups: readonly DayGroup[];
  /** Rows whose suggestion was just accepted: they show Undo instead of Confirm. */
  readonly appliedIds: ReadonlySet<string>;
  readonly refreshing?: boolean;
  readonly hasMore?: boolean;
  readonly loadingMore?: boolean;
  readonly onRefresh?: () => void;
  readonly onRetry?: () => void;
  readonly onLoadMore?: () => void;
  readonly onSortAll?: () => void;
  readonly onOpen: (id: string) => void;
  readonly onConfirm: (id: string) => void;
  readonly onUndo: (id: string) => void;
  readonly onChoose: (id: string) => void;
}

const END_THRESHOLD_PX = 240;
const SCROLL_THROTTLE_MS = 100;

const useStyles = makeStyles((glass) => ({
  page: {
    paddingHorizontal: glass.space.lg,
    paddingTop: glass.space.lg,
    paddingBottom: 120,
    gap: glass.space.md,
  },
  panelContent: { padding: glass.space.lg, gap: glass.space.sm },
  headline: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.heading.mobile,
  },
  dim: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
  },
  sortAll: {
    minHeight: 44,
    marginTop: glass.space.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortAllText: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.label.mobile,
  },
  listContent: { padding: glass.space.md, gap: glass.space.lg, minHeight: 160 },
  day: { gap: glass.space.sm },
  dayLabel: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
  centered: { alignItems: 'center', paddingVertical: glass.space.md },
}));

/**
 * D7-M-Transactions: month rod, filter chips and the day-grouped rows. Props only, so it renders
 * in the gallery and in tests from fixtures; the container loads the data.
 */
export function TransactionListView(props: TransactionListViewProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const options = LIST_FILTERS.map((value) => ({
    value,
    label: labels.filterOption(value, props.counts[value]),
  }));

  return (
    <ScrollView
      testID="tx-list"
      contentContainerStyle={styles.page}
      scrollEventThrottle={SCROLL_THROTTLE_MS}
      onScroll={(event) => {
        if (props.onLoadMore !== undefined && isNearEnd(event)) {
          props.onLoadMore();
        }
      }}
      refreshControl={
        props.onRefresh === undefined ? undefined : (
          <RefreshControl refreshing={props.refreshing === true} onRefresh={props.onRefresh} />
        )
      }
    >
      {props.month === undefined ? null : <MonthPanel {...props} month={props.month} />}
      <FilterChips
        options={options}
        value={props.filter}
        onChange={props.onFilterChange}
        label={labels.filterGroup()}
      />
      <GlassPanel
        material="frosted"
        depth={1}
        decor={{ specular: true, film: true }}
        contentStyle={styles.listContent}
      >
        <ListBody {...props} />
      </GlassPanel>
    </ScrollView>
  );
}

function MonthPanel({
  month,
  waiting,
  counts,
  onSortAll,
}: TransactionListViewProps & { readonly month: MonthSummary }): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const lightLabels = useLightLabels();
  const monthName = labels.monthName(month.periodStart);
  const shown: MinorUnitAmount = {
    amountMinor: month.left.amountMinor < 0n ? -month.left.amountMinor : month.left.amountMinor,
    currency: month.left.currency,
  };
  const rod: RodData = {
    fraction: month.fraction,
    state: month.state,
    ariaLabel: lightLabels.rodAria(monthName, month.state, shown, month.planned),
    size: 'pace',
  };

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      decor={{ specular: true, film: true }}
      contentStyle={styles.panelContent}
    >
      <Text accessibilityRole="header" style={styles.headline}>
        {labels.monthLine(month.left, monthName)}
      </Text>
      <Text accessibilityRole="text" style={styles.dim}>
        {labels.waiting(waiting)}
      </Text>
      <Rod rod={rod} />
      {counts.toSort > 0 && onSortAll !== undefined ? (
        <TransactionActionButton label={labels.sortAll(counts.toSort)} onPress={onSortAll} />
      ) : null}
    </GlassPanel>
  );
}

function ListBody(props: TransactionListViewProps): React.JSX.Element {
  const labels = useTransactionLabels();
  const styles = useStyles();
  if (props.status === 'loading') {
    return <SkeletonList rows={5} />;
  }
  if (props.status === 'error') {
    return <ErrorBanner message={labels.listError()} onRetry={props.onRetry} />;
  }
  const loadMore =
    props.hasMore === true && props.onLoadMore !== undefined ? (
      <View style={styles.centered}>
        <TransactionActionButton
          label={labels.loadMore()}
          onPress={props.onLoadMore}
          disabled={props.loadingMore === true}
        />
      </View>
    ) : null;
  if (props.groups.length === 0) {
    // Later pages may still hold rows for this filter, so paging stays available.
    return (
      <>
        <EmptyState title={labels.empty(props.filter !== 'all')} />
        {loadMore}
      </>
    );
  }
  const hasTransfer = props.groups.some((group) =>
    group.rows.some((row) => row.kind === 'transfer'),
  );

  return (
    <>
      {props.groups.map((group) => (
        <DaySection key={group.day} group={group} {...props} />
      ))}
      {hasTransfer ? <Text style={styles.dim}>{labels.transfersNote()}</Text> : null}
      {loadMore}
    </>
  );
}

function DaySection({
  group,
  appliedIds,
  onOpen,
  onConfirm,
  onUndo,
  onChoose,
}: TransactionListViewProps & { readonly group: DayGroup }): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const label = labels.dayLabel(group.day);

  return (
    <View accessibilityLabel={label} style={styles.day}>
      <Text accessibilityRole="header" style={styles.dayLabel}>
        {label}
      </Text>
      {group.rows.map((row) => (
        <TxRow
          key={row.data.id}
          transaction={row.data}
          live={row.live}
          provenance={row.provenance}
          suggestionApplied={appliedIds.has(row.data.id)}
          onPress={onOpen}
          onConfirmSuggestion={row.suggestedPlannedItemId === null ? undefined : onConfirm}
          onUndoSuggestion={onUndo}
          onChooseCategory={onChoose}
        />
      ))}
    </View>
  );
}

function isNearEnd(event: NativeSyntheticEvent<NativeScrollEvent>): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

  return contentOffset.y + layoutMeasurement.height >= contentSize.height - END_THRESHOLD_PX;
}
