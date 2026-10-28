import React from 'react';
import { View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types.js';
import { Toast } from '../../glass/overlays/Toast.js';
import { TransactionListView } from './transactions/TransactionListView.js';
import { useTransactionLabels } from './transactions/useTransactionLabels.js';
import { useTransactionList } from './transactions/useTransactionList.js';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Transactions'>,
  NativeStackScreenProps<AppStackParamList>
>;

/** Data container of the Transactions tab; the look lives in `TransactionListView`. */
export function TransactionListScreen({ navigation }: Props): React.JSX.Element {
  const list = useTransactionList();
  const labels = useTransactionLabels();
  const openDetail = (id: string): void =>
    navigation.navigate('TransactionDetail', { transactionId: id });

  return (
    <View style={{ flex: 1 }}>
      <TransactionListView
        status={list.status}
        month={list.month}
        waiting={list.waiting}
        filter={list.filter}
        counts={list.counts}
        onFilterChange={list.setFilter}
        groups={list.groups}
        appliedIds={list.appliedIds}
        refreshing={list.refreshing}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onRefresh={list.refresh}
        onRetry={list.retry}
        onLoadMore={list.loadMore}
        onSortAll={() => navigation.navigate('ToSort')}
        onOpen={openDetail}
        onConfirm={list.confirm}
        onUndo={list.undo}
        onChoose={openDetail}
      />
      <Toast
        message={list.failure === null ? null : labels.sortError()}
        onDismiss={list.dismissFailure}
      />
    </View>
  );
}
