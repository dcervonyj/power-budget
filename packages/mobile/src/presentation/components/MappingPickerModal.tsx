import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import { useIntl } from 'react-intl';
import { planService } from '../../infrastructure/index.js';
import type { Plan, PlannedItem } from '../../infrastructure/index.js';

const t = rnDarkTheme;

interface MappingPickerModalProps {
  readonly visible: boolean;
  readonly currentPlannedItemId: string | null;
  readonly onSelectPlannedItem: (plannedItemId: string) => void;
  readonly onClose: () => void;
}

interface PlanWithItems {
  plan: Plan;
  items: PlannedItem[];
}

export function MappingPickerModal({
  visible,
  currentPlannedItemId,
  onSelectPlannedItem,
  onClose,
}: MappingPickerModalProps): React.JSX.Element {
  const intl = useIntl();
  const [plansWithItems, setPlansWithItems] = useState<PlanWithItems[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const plans = await planService.listPlans();
      const active = plans.filter((p) => p.archivedAt === null);
      const results = await Promise.all(
        active.map(async (p) => {
          const items = await planService.listPlannedItems(p.id);
          return { plan: p, items };
        }),
      );
      setPlansWithItems(results);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const allItems: Array<{ plan: Plan; item: PlannedItem }> = [];
  for (const pw of plansWithItems) {
    for (const item of pw.items) {
      allItems.push({ plan: pw.plan, item });
    }
  }
  const sorted = [...allItems].sort((a, b) => {
    if (a.item.id === currentPlannedItemId) return -1;
    if (b.item.id === currentPlannedItemId) return 1;
    return 0;
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {intl.formatMessage({ id: 'screen.transactionDetail.mapTo', defaultMessage: 'Map to planned item' })}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={t.colorAccentDefault} />
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: { plan, item } }) => {
              const isCurrent = item.id === currentPlannedItemId;
              const dirLabel = item.direction === 'income' ? '↑' : '↓';
              const amount = (item.amountMinor / 100).toFixed(2);
              return (
                <TouchableOpacity
                  style={[styles.row, isCurrent && styles.rowCurrent]}
                  onPress={() => {
                    onSelectPlannedItem(item.id);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <Text style={styles.dirLabel}>{dirLabel}</Text>
                    <View>
                      <Text style={styles.planName}>{plan.name}</Text>
                      <Text style={styles.amount}>{amount} {item.currency}</Text>
                    </View>
                  </View>
                  {isCurrent && <Text style={styles.currentTag}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colorSurfaceBase },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: t.spaceLg,
    borderBottomWidth: 1,
    borderBottomColor: t.colorBorderSubtle,
  },
  headerTitle: { fontSize: t.fontSizeLg, fontWeight: t.fontWeightBold as '700', color: t.colorTextPrimary },
  closeBtn: { padding: t.spaceXs },
  closeBtnText: { fontSize: t.fontSizeLg, color: t.colorTextSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: t.spaceMd },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: t.spaceMd,
    borderRadius: t.radiusMd,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
    backgroundColor: t.colorSurfaceRaised,
    marginBottom: t.spaceSm,
  },
  rowCurrent: { borderColor: t.colorAccentDefault },
  rowLeft: { flexDirection: 'row', alignItems: 'center' },
  dirLabel: { fontSize: t.fontSizeLg, color: t.colorAccentDefault, marginRight: t.spaceSm },
  planName: { fontSize: t.fontSizeSm, color: t.colorTextPrimary, fontWeight: t.fontWeightMedium as '500' },
  amount: { fontSize: t.fontSizeXs, color: t.colorTextSecondary, marginTop: 2 },
  currentTag: { color: t.colorAccentDefault, fontSize: t.fontSizeLg },
});
