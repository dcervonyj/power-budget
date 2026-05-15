import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, FlatList, StyleSheet } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { SelectOption } from '@power-budget/shared-app';

const t = rnDarkTheme;

export interface SelectProps<T extends string = string> {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T | '';
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly label?: string;
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  label,
}: SelectProps<T>): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const intl = useIntl();
  const selected = options.find((o) => o.value === value);
  const placeholderText =
    placeholder ?? intl.formatMessage({ id: 'select.placeholder', defaultMessage: 'Select…' });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => {
          setOpen(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholderText}
        </Text>
        <Text style={styles.chevron}>
          <FormattedMessage id="select.chevron" defaultMessage="▾" />
        </Text>
      </TouchableOpacity>
      <RNModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpen(false);
        }}
      >
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => {
            setOpen(false);
          }}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionSelected]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </RNModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: t.spaceMd },
  label: { color: t.colorTextSecondary, fontSize: t.fontSizeSm, marginBottom: t.spaceXs },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: t.colorSurfaceRaised,
    borderRadius: t.radiusSm,
    borderWidth: 1,
    borderColor: t.colorBorderSubtle,
    paddingHorizontal: t.spaceMd,
    paddingVertical: t.spaceSm,
  },
  triggerText: { color: t.colorTextPrimary, fontSize: t.fontSizeMd, flex: 1 },
  placeholder: { color: t.colorTextMuted },
  chevron: { color: t.colorTextSecondary, fontSize: t.fontSizeMd },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colorSurfaceRaised,
    borderTopLeftRadius: t.radiusLg,
    borderTopRightRadius: t.radiusLg,
    maxHeight: 320,
    paddingVertical: t.spaceSm,
  },
  option: { paddingHorizontal: t.spaceLg, paddingVertical: t.spaceMd },
  optionText: { color: t.colorTextPrimary, fontSize: t.fontSizeMd },
  optionSelected: { color: t.colorAccentDefault, fontWeight: t.fontWeightMedium },
});
