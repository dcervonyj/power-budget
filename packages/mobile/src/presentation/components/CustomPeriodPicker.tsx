import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal as RNModal, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FormattedMessage, useIntl } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const t = rnDarkTheme;

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fromIsoDate(s: string): Date {
  const d = new Date(`${s}T00:00:00Z`);
  return isNaN(d.getTime()) ? new Date() : d;
}

interface Props {
  readonly startDate: string;
  readonly endDate: string;
  readonly onChange: (start: string, end: string) => void;
}

type Picking = 'start' | 'end' | null;

export function CustomPeriodPicker({ startDate, endDate, onChange }: Props): React.JSX.Element {
  const intl = useIntl();
  const [picking, setPicking] = useState<Picking>(null);

  const handleChange = (_event: DateTimePickerEvent, date: Date | undefined): void => {
    if (!date) {
      setPicking(null);
      return;
    }
    const iso = toIsoDate(date);
    if (picking === 'start') {
      onChange(iso, endDate < iso ? iso : endDate);
    } else if (picking === 'end') {
      onChange(startDate > iso ? iso : startDate, iso);
    }
    if (Platform.OS === 'android') {
      setPicking(null);
    }
  };

  const currentDate = picking === 'start' ? fromIsoDate(startDate) : fromIsoDate(endDate);

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>
            <FormattedMessage id="plan.period.start" defaultMessage="Start date" />
          </Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setPicking('start');
            }}
          >
            <Text style={styles.dateText}>{startDate}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.separator} />

        <View style={styles.flex1}>
          <Text style={styles.label}>
            <FormattedMessage id="plan.period.end" defaultMessage="End date" />
          </Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => {
              setPicking('end');
            }}
          >
            <Text style={styles.dateText}>{endDate}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {picking !== null &&
        (Platform.OS === 'ios' ? (
          <RNModal transparent animationType="slide" visible statusBarTranslucent>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {picking === 'start'
                      ? intl.formatMessage({
                          id: 'plan.period.start',
                          defaultMessage: 'Start date',
                        })
                      : intl.formatMessage({ id: 'plan.period.end', defaultMessage: 'End date' })}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setPicking(null);
                    }}
                  >
                    <Text style={styles.doneText}>
                      <FormattedMessage id="action.done" defaultMessage="Done" />
                    </Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={currentDate}
                  mode="date"
                  display="spinner"
                  onChange={handleChange}
                  themeVariant="dark"
                />
              </View>
            </View>
          </RNModal>
        ) : (
          <DateTimePicker
            value={currentDate}
            mode="date"
            display="default"
            onChange={handleChange}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  flex1: {
    flex: 1,
  },
  separator: {
    width: t.spaceMd,
  },
  label: {
    color: t.colorTextSecondary,
    fontSize: t.fontSizeSm,
    marginBottom: t.spaceXs,
  },
  dateButton: {
    backgroundColor: t.colorSurfaceRaised,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
    borderRadius: t.radiusSm,
    paddingVertical: t.spaceSm,
    paddingHorizontal: t.spaceMd,
  },
  dateText: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeMd,
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: t.colorSurfaceRaised,
    borderTopLeftRadius: t.radiusLg,
    borderTopRightRadius: t.radiusLg,
    padding: t.spaceLg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: t.spaceMd,
  },
  modalTitle: {
    color: t.colorTextPrimary,
    fontSize: t.fontSizeLg,
    fontWeight: t.fontWeightBold,
  },
  doneText: {
    color: t.colorAccentDefault,
    fontSize: t.fontSizeMd,
    fontWeight: t.fontWeightMedium,
  },
});
