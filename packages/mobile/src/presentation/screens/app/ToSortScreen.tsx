import React from 'react';
import { View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types.js';
import { CategorizeSheet } from './categorize/CategorizeSheet.js';
import { ToSortView } from './categorize/ToSortView.js';
import { useToSort } from './categorize/useToSort.js';
import { useReloadOnFocus } from './transactions/useReloadOnFocus.js';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'ToSort'>,
  NativeStackScreenProps<AppStackParamList>
>;

/** Data container of the To sort tab; the look lives in `ToSortView` and `CategorizeSheet`. */
export function ToSortScreen({ navigation }: Props): React.JSX.Element {
  const toSort = useToSort();
  useReloadOnFocus(navigation, toSort.reload);
  const { sheet } = toSort;

  function backToTransactions(): void {
    toSort.close();
    navigation.navigate('Transactions');
  }

  return (
    <View style={{ flex: 1 }}>
      <ToSortView
        status={toSort.status}
        rows={toSort.rows}
        refreshing={toSort.refreshing}
        reloadFailed={toSort.reloadFailed}
        onRetry={toSort.retry}
        onRefresh={toSort.refresh}
        onOpen={toSort.open}
      />
      {sheet === undefined ? null : (
        <CategorizeSheet
          key={sheet.key}
          sheet={sheet}
          choices={toSort.choices}
          choicesStatus={toSort.choicesStatus}
          choicesStale={toSort.choicesStale}
          ledger={toSort.ledger}
          onRetryChoices={toSort.retryChoices}
          busyIds={toSort.busyIds}
          write={toSort.write}
          onConfirmed={toSort.onConfirmed}
          onUndone={toSort.onUndone}
          onClose={toSort.close}
          onBackToTransactions={backToTransactions}
        />
      )}
    </View>
  );
}
