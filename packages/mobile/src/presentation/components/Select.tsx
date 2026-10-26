import React, { useState } from 'react';
import { View, Text, Pressable, Modal as RNModal, FlatList } from 'react-native';
import { useIntl, FormattedMessage } from 'react-intl';
import type { SelectOption } from '@power-budget/shared-app';
import { makeStyles } from '../theme/index.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

export interface SelectProps<T extends string = string> {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T | '';
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly disabled?: boolean;
}

const useStyles = makeStyles((glass) => ({
  container: { marginBottom: glass.space.md },
  label: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
    marginBottom: glass.space.xxs,
  },
  trigger: {
    minHeight: TOUCH_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: glass.colors.clear,
    borderRadius: glass.radius.control,
    borderWidth: 1,
    borderColor: glass.colors.sep,
    paddingHorizontal: glass.space.md,
  },
  triggerText: {
    flex: 1,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
  },
  placeholder: { color: glass.colors.faint },
  chevron: { color: glass.colors.dim, fontSize: glass.type.body.mobile },
  pressed: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  overlay: { flex: 1, backgroundColor: glass.colors.scrim, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: glass.colors.base,
    borderTopLeftRadius: glass.radius.mobilePanel,
    borderTopRightRadius: glass.radius.mobilePanel,
    borderWidth: 1,
    borderColor: glass.colors.edge,
    maxHeight: 360,
    paddingVertical: glass.space.xs,
  },
  option: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: glass.space.lg,
  },
  optionText: {
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
  },
  optionSelected: { color: glass.colors.accent, fontFamily: LABEL_FONT },
}));

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  label,
  disabled = false,
}: SelectProps<T>): React.JSX.Element {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const intl = useIntl();
  const selected = options.find((o) => o.value === value);
  const placeholderText =
    placeholder ?? intl.formatMessage({ id: 'select.placeholder', defaultMessage: 'Select…' });
  const shownText = selected ? selected.label : placeholderText;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label ? `${label}, ${shownText}` : shownText}
        aria-expanded={open}
        aria-disabled={disabled}
        disabled={disabled}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
        onPress={() => {
          setOpen(true);
        }}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>{shownText}</Text>
        <Text importantForAccessibility="no" style={styles.chevron}>
          <FormattedMessage id="select.chevron" defaultMessage="▾" />
        </Text>
      </Pressable>
      <RNModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setOpen(false);
        }}
      >
        <Pressable
          accessibilityRole="none"
          style={styles.overlay}
          onPress={() => {
            setOpen(false);
          }}
        >
          <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.sheet}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={item.label}
                  aria-checked={item.value === value}
                  style={styles.option}
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </RNModal>
    </View>
  );
}
