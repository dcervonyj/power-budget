import React, { useState } from 'react';
import { View, Text, Modal as RNModal, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FormattedMessage, useIntl } from 'react-intl';
import { makeStyles, useTheme } from '../theme/index.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

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
  const styles = useStyles();
  const { resolvedName } = useTheme();
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
            accessibilityRole="button"
            accessibilityLabel={`${intl.formatMessage({ id: 'plan.period.start', defaultMessage: 'Start date' })}: ${startDate}`}
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
            accessibilityRole="button"
            accessibilityLabel={`${intl.formatMessage({ id: 'plan.period.end', defaultMessage: 'End date' })}: ${endDate}`}
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
                    accessibilityRole="button"
                    style={styles.done}
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
                  themeVariant={resolvedName}
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

const useStyles = makeStyles((glass) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: glass.space.md },
  flex1: { flex: 1 },
  separator: { width: glass.space.md },
  label: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
    marginBottom: glass.space.xxs,
  },
  dateButton: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    backgroundColor: glass.colors.clear,
    borderWidth: 1,
    borderColor: glass.colors.sep,
    borderRadius: glass.radius.control,
    paddingHorizontal: glass.space.md,
  },
  dateText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    fontVariant: ['tabular-nums'],
  },
  modalBackdrop: { flex: 1, backgroundColor: glass.colors.scrim, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: glass.colors.base,
    borderTopLeftRadius: glass.radius.mobilePanel,
    borderTopRightRadius: glass.radius.mobilePanel,
    padding: glass.space.lg,
    boxShadow: glass.colors.clearRim,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: glass.space.md,
  },
  modalTitle: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.heading.mobile,
  },
  done: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  doneText: {
    color: glass.colors.accent,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.body.mobile,
  },
}));
