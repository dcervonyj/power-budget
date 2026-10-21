import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { AppStackParamList } from '../../navigation/types.js';
import type {
  PatchTransactionDto,
  SetMappingDto,
  TransactionDetailDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../../infrastructure/index.js';
import {
  TransactionView,
  formatAmountText,
  isOutgoing,
} from '../../../infrastructure/transactions/TransactionView.js';
import { TransactionStatusChip } from '../../components/TransactionStatusChip.js';
import type { TransactionStatus } from '../../components/TransactionStatusChip.js';
import { MappingPickerModal } from '../../components/MappingPickerModal.js';

const t = rnDarkTheme;

type Props = NativeStackScreenProps<AppStackParamList, 'TransactionDetail'>;

function getStatus(tx: TransactionView): TransactionStatus {
  if (tx.isTransfer) return 'transfer';
  if (tx.mapping) return 'mapped';
  return 'unmapped';
}

export function TransactionDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const { transactionId } = route.params;
  const [transaction, setTransaction] = useState<TransactionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadTransaction = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.get<TransactionDetailDto>(`/transactions/${transactionId}`);
      const view = TransactionView.fromDetail(response.data);
      setTransaction(view);
      setNotes(view.notes ?? '');
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.transactionLoadFailed',
          defaultMessage: 'Could not load transaction.',
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [transactionId, intl]);

  useEffect(() => {
    void loadTransaction();
  }, [loadTransaction]);

  const handleSaveNotes = async (): Promise<void> => {
    if (!transaction) return;
    setSaving(true);
    try {
      const body: PatchTransactionDto = { notes: notes || null };
      await apiClient.patch(`/transactions/${transaction.id}`, body);
      setTransaction((prev) => (prev ? { ...prev, notes: notes || null } : prev));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Could not save.' }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetMapping = async (plannedItemId: string): Promise<void> => {
    if (!transaction) return;
    const previous = transaction;
    setTransaction((prev) => (prev ? { ...prev, mapping: { plannedItemId } } : prev));
    try {
      const body: SetMappingDto = { plannedItemId };
      await apiClient.patch(`/transactions/${transaction.id}/mapping`, body);
      const updated = await apiClient.get<TransactionDetailDto>(`/transactions/${transaction.id}`);
      setTransaction(TransactionView.fromDetail(updated.data));
    } catch {
      setTransaction(previous);
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.mappingFailed', defaultMessage: 'Could not set mapping.' }),
      );
    }
  };

  const handleClearMapping = async (): Promise<void> => {
    if (!transaction) return;
    const previous = transaction;
    setTransaction((prev) => (prev ? { ...prev, mapping: null } : prev));
    try {
      const body: SetMappingDto = { plannedItemId: null };
      await apiClient.patch(`/transactions/${transaction.id}/mapping`, body);
    } catch {
      setTransaction(previous);
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.mappingFailed',
          defaultMessage: 'Could not clear mapping.',
        }),
      );
    }
  };

  const handleToggleTransfer = async (): Promise<void> => {
    if (!transaction) return;
    const previous = transaction;
    const nowTransfer = !transaction.isTransfer;
    setTransaction((prev) => (prev ? { ...prev, isTransfer: nowTransfer } : prev));
    try {
      if (nowTransfer) {
        await apiClient.request({
          url: `/transactions/${transaction.id}/transfer`,
          method: 'POST',
          body: {},
        });
      } else {
        await apiClient.request({
          url: `/transactions/${transaction.id}/transfer`,
          method: 'DELETE',
        });
      }
    } catch {
      setTransaction(previous);
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Could not save.' }),
      );
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={t.colorAccentDefault} />
      </View>
    );
  }

  if (!transaction) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.emptyText}>
          {intl.formatMessage({
            id: 'screen.transactionDetail.notFound',
            defaultMessage: 'Transaction not found',
          })}
        </Text>
      </View>
    );
  }

  const status = getStatus(transaction);

  // Suppress unused variable warning — navigation is available for future use
  void navigation;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Transaction info */}
      <View style={styles.card}>
        <View style={styles.cardRow}>
          <Text style={styles.label}>{transaction.occurredOn}</Text>
          <TransactionStatusChip status={status} />
        </View>
        <Text style={styles.description}>{transaction.description}</Text>
        <Text style={styles.source}>{transaction.source}</Text>
        <Text
          style={[
            styles.amount,
            { color: isOutgoing(transaction.amount) ? t.colorStatusDanger : t.colorStatusSuccess },
          ]}
        >
          {formatAmountText(transaction.amount)}
        </Text>
      </View>

      {/* Mapping section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FormattedMessage id="screen.transactionDetail.mapping" defaultMessage="Mapped to" />
        </Text>
        {transaction.mapping ? (
          <View style={styles.mappingRow}>
            <Text style={styles.mappingName} numberOfLines={1}>
              {/* The detail carries only the planned item id. */}
              {transaction.mapping.plannedItemId}
            </Text>
            <TouchableOpacity onPress={() => void handleClearMapping()} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>
                <FormattedMessage
                  id="screen.transactionDetail.unmap"
                  defaultMessage="Clear mapping"
                />
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => setPickerVisible(true)}
            activeOpacity={0.75}
          >
            <Text style={styles.mapBtnText}>
              <FormattedMessage
                id="screen.transactionDetail.mapTo"
                defaultMessage="Map to planned item"
              />
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transfer toggle */}
      <View style={styles.card}>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>
            <FormattedMessage
              id="screen.transactionDetail.markTransfer"
              defaultMessage="Mark as transfer"
            />
          </Text>
          <Switch
            value={transaction.isTransfer}
            onValueChange={() => void handleToggleTransfer()}
            trackColor={{ true: t.colorAccentDefault, false: t.colorBorderSubtle }}
            thumbColor={t.colorTextPrimary}
          />
        </View>
      </View>

      {/* Notes */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          <FormattedMessage id="screen.transactionDetail.notes" defaultMessage="Notes" />
        </Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder={intl.formatMessage({
            id: 'screen.transactionDetail.notes',
            defaultMessage: 'Notes',
          })}
          placeholderTextColor={t.colorTextMuted}
        />
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void handleSaveNotes()}
          disabled={saving}
          activeOpacity={0.75}
        >
          {saving ? (
            <ActivityIndicator size="small" color={t.colorAccentOnAccent} />
          ) : (
            <Text style={styles.saveBtnText}>
              <FormattedMessage id="screen.transactionDetail.save" defaultMessage="Save" />
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <MappingPickerModal
        visible={pickerVisible}
        currentPlannedItemId={transaction.mapping?.plannedItemId ?? null}
        onSelectPlannedItem={(id) => void handleSetMapping(id)}
        onClose={() => setPickerVisible(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colorSurfaceBase },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: t.spaceMd, paddingBottom: 80 },
  card: {
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusMd,
    padding: t.spaceMd,
    marginBottom: t.spaceMd,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spaceXs,
  },
  label: { fontSize: t.fontSizeSm, color: t.colorTextSecondary },
  description: {
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightMedium,
    color: t.colorTextPrimary,
    marginBottom: t.spaceXs,
  },
  source: { fontSize: t.fontSizeXs, color: t.colorTextMuted, marginBottom: t.spaceSm },
  amount: { fontSize: t.fontSizeLg, fontWeight: t.fontWeightBold },
  sectionTitle: {
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightBold,
    color: t.colorTextPrimary,
    marginBottom: t.spaceSm,
  },
  mappingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mappingName: {
    flex: 1,
    fontSize: t.fontSizeSm,
    color: t.colorTextPrimary,
    marginRight: t.spaceSm,
  },
  clearBtn: {
    paddingHorizontal: t.spaceSm,
    paddingVertical: t.spaceXs,
    borderRadius: t.radiusSm,
    borderWidth: 1,
    borderColor: t.colorStatusDanger,
  },
  clearBtnText: { fontSize: t.fontSizeSm, color: t.colorStatusDanger },
  mapBtn: {
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceMd,
    borderRadius: t.radiusMd,
    backgroundColor: t.colorAccentDefault,
    alignItems: 'center',
  },
  mapBtnText: {
    fontSize: t.fontSizeSm,
    fontWeight: t.fontWeightMedium,
    color: t.colorAccentOnAccent,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: { fontSize: t.fontSizeMd, color: t.colorTextPrimary },
  notesInput: {
    backgroundColor: t.colorSurfaceMid,
    borderRadius: t.radiusSm,
    padding: t.spaceSm,
    color: t.colorTextPrimary,
    fontSize: t.fontSizeSm,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: t.spaceSm,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
  },
  saveBtn: {
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceMd,
    borderRadius: t.radiusMd,
    backgroundColor: t.colorAccentDefault,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: t.fontSizeSm,
    fontWeight: t.fontWeightMedium,
    color: t.colorAccentOnAccent,
  },
  emptyText: { color: t.colorTextSecondary, fontSize: t.fontSizeMd },
});
