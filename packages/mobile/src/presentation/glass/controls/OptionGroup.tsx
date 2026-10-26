import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

export interface OptionGroupOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export interface OptionGroupProps<T extends string> {
  readonly options: ReadonlyArray<OptionGroupOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
  readonly groupStyle: StyleProp<ViewStyle>;
  readonly optionStyle: (selected: boolean, pressed: boolean) => StyleProp<ViewStyle>;
  readonly textStyle: (selected: boolean) => StyleProp<TextStyle>;
}

/** Radio semantics shared by FilterChips and SegmentedControl. */
export function OptionGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled = false,
  groupStyle,
  optionStyle,
  textStyle,
}: OptionGroupProps<T>): React.JSX.Element {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      aria-disabled={disabled}
      style={groupStyle}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            aria-checked={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => {
              onChange(option.value);
            }}
            style={({ pressed }) => optionStyle(selected, pressed)}
          >
            <Text style={textStyle(selected)}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
