import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { makeStyles } from '../../../theme/index.js';
import { CountBadge } from '../../../glass/controls/CountBadge.js';
import { LABEL_FONT } from '../../../glass/controls/fonts.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { EmptyState } from '../../../glass/overlays/EmptyState.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { SkeletonList } from '../../../glass/overlays/Skeleton.js';
import { TxRow } from '../../../glass/rows/TxRow.js';
import type { TransactionListRow } from '../../../../infrastructure/transactions/TransactionListModel.js';
import { TransactionActionButton } from '../transactions/TransactionActionButton.js';
import { useCategorizeLabels } from './useCategorizeLabels.js';
import type { LoadStatus } from './useToSort.js';

export interface ToSortViewProps {
  readonly status: LoadStatus;
  readonly rows: readonly TransactionListRow[];
  readonly refreshing?: boolean;
  /** A reload failed: the rows may be stale, so offer a retry above them. */
  readonly reloadFailed?: boolean;
  readonly onRetry?: () => void;
  readonly onRefresh?: () => void;
  /** Opens the Categorize sheet on this payment, or on the first one without an id. */
  readonly onOpen: (transactionId?: string) => void;
}

const SKELETON_ROWS = 5;

const useStyles = makeStyles((glass) => ({
  page: {
    paddingHorizontal: glass.space.lg,
    paddingTop: glass.space.lg,
    paddingBottom: 120,
    gap: glass.space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.title.mobile,
  },
  listContent: { padding: glass.space.md, gap: glass.space.sm, minHeight: 160 },
}));

/** The To sort tab: every unsorted payment, each opening the Categorize sheet. Props only. */
export function ToSortView(props: ToSortViewProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useCategorizeLabels();

  return (
    <ScrollView
      testID="to-sort-list"
      contentContainerStyle={styles.page}
      refreshControl={
        props.onRefresh === undefined ? undefined : (
          <RefreshControl refreshing={props.refreshing === true} onRefresh={props.onRefresh} />
        )
      }
    >
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {labels.listTitle()}
        </Text>
        {props.status === 'ready' && props.rows.length > 0 ? (
          <CountBadge count={props.rows.length} />
        ) : null}
      </View>
      {props.reloadFailed === true ? (
        <ErrorBanner message={labels.reloadError()} onRetry={props.onRetry} />
      ) : null}
      <Body {...props} />
    </ScrollView>
  );
}

function Body(props: ToSortViewProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useCategorizeLabels();
  if (props.status === 'loading') {
    return <SkeletonList rows={SKELETON_ROWS} />;
  }
  if (props.status === 'error') {
    return <ErrorBanner message={labels.listError()} onRetry={props.onRetry} />;
  }
  if (props.rows.length === 0) {
    return <EmptyState title={labels.listEmpty()} />;
  }

  return (
    <>
      <TransactionActionButton
        primary
        label={labels.sortAll(props.rows.length)}
        onPress={() => props.onOpen()}
      />
      <GlassPanel
        material="frosted"
        depth={1}
        decor={{ specular: true, film: true }}
        contentStyle={styles.listContent}
      >
        {props.rows.map((row) => (
          <TxRow
            key={row.data.id}
            transaction={row.data}
            live={row.live}
            provenance={row.provenance}
            onPress={props.onOpen}
            onConfirmSuggestion={row.suggestedPlannedItemId === null ? undefined : props.onOpen}
            onChooseCategory={props.onOpen}
          />
        ))}
      </GlassPanel>
    </>
  );
}
