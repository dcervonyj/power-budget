import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types.js';
import type { TransactionDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../../infrastructure/index.js';
import {
  formatAmountText,
  isOutgoing,
} from '../../../infrastructure/transactions/TransactionView.js';

const t = rnDarkTheme;

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Transactions'>,
  NativeStackScreenProps<AppStackParamList>
>;

function TransactionRow({
  transaction,
  onPress,
}: {
  readonly transaction: TransactionDto;
  readonly onPress: () => void;
}): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowTop}>
        <Text style={styles.rowDate}>{transaction.occurredOn}</Text>
        <Text
          style={[
            styles.rowAmount,
            { color: isOutgoing(transaction.amount) ? t.colorStatusDanger : t.colorStatusSuccess },
          ]}
        >
          {formatAmountText(transaction.amount)}
        </Text>
      </View>
      <Text style={styles.rowDesc} numberOfLines={1}>
        {transaction.description}
      </Text>
      <View style={styles.rowBottom}>
        <Text style={styles.rowSource} numberOfLines={1}>
          {transaction.source}
        </Text>
        {/* The list DTO has no mapping or transfer link, so no status chip here. */}
      </View>
    </TouchableOpacity>
  );
}

export function TransactionListScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(
    async (cursor?: string): Promise<void> => {
      try {
        const url = cursor ? `/transactions?limit=50&cursor=${cursor}` : '/transactions?limit=50';
        const response = await apiClient.get<TransactionPageDto>(url);
        const data = response.data;
        if (cursor) {
          setTransactions((prev) => [...prev, ...data.items]);
        } else {
          setTransactions(data.items);
        }
        setNextCursor(data.nextCursor);
      } catch {
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.transactionsLoadFailed',
            defaultMessage: 'Could not load transactions.',
          }),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [intl],
  );

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleRefresh = (): void => {
    setRefreshing(true);
    setNextCursor(null);
    void loadTransactions();
  };

  const handleLoadMore = (): void => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    void loadTransactions(nextCursor);
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
        data={transactions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={t.colorAccentDefault}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              <FormattedMessage
                id="screen.transactionList.empty"
                defaultMessage="No transactions"
              />
            </Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={t.colorAccentDefault} />
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            onPress={() => navigation.navigate('TransactionDetail', { transactionId: item.id })}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colorSurfaceBase },
  centered: { justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: t.spaceMd, paddingBottom: 80 },
  row: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    marginBottom: t.spaceSm,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: t.spaceXs },
  rowDate: { fontSize: t.fontSizeSm, color: t.colorTextSecondary },
  rowAmount: { fontSize: t.fontSizeSm, fontWeight: t.fontWeightMedium },
  rowDesc: { fontSize: t.fontSizeMd, color: t.colorTextPrimary, marginBottom: t.spaceXs },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: t.spaceXs,
  },
  rowSource: { fontSize: t.fontSizeXs, color: t.colorTextMuted, flex: 1, marginRight: t.spaceSm },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80 },
  emptyText: { color: t.colorTextSecondary, fontSize: t.fontSizeMd },
  footerLoader: { padding: t.spaceLg, alignItems: 'center' },
});
