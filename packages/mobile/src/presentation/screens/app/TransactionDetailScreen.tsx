import React from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types.js';
import { Toast } from '../../glass/overlays/Toast.js';
import { TransactionDetailView } from './transactions/TransactionDetailView.js';
import { useTransactionDetail } from './transactions/useTransactionDetail.js';
import { useTransactionLabels } from './transactions/useTransactionLabels.js';

type Props = NativeStackScreenProps<AppStackParamList, 'TransactionDetail'>;

/** Data container of the transaction detail; the look lives in `TransactionDetailView`. */
export function TransactionDetailScreen({ route }: Props): React.JSX.Element {
  const detail = useTransactionDetail(route.params.transactionId);
  const labels = useTransactionLabels();
  const failureText = detail.failure === 'mapping' ? labels.mappingError() : labels.saveError();

  return (
    <View style={{ flex: 1 }}>
      <TransactionDetailView
        status={detail.status}
        transaction={detail.transaction}
        categoryName={detail.categoryName}
        options={detail.options}
        optionsStatus={detail.optionsStatus}
        onRetryOptions={detail.retryOptions}
        categoryFailed={detail.categoryFailed}
        onRetryCategory={detail.retryCategory}
        pickerOpen={detail.pickerOpen}
        notes={detail.notes}
        saving={detail.saving}
        onRetry={detail.retry}
        onOpenPicker={detail.openPicker}
        onClosePicker={detail.closePicker}
        onPickItem={detail.pickItem}
        onClearMapping={detail.clearMapping}
        onToggleTransfer={detail.toggleTransfer}
        onNotesChange={detail.setNotes}
        onSaveNotes={detail.saveNotes}
      />
      <Toast
        message={detail.failure === null ? null : failureText}
        onDismiss={detail.dismissFailure}
      />
    </View>
  );
}
