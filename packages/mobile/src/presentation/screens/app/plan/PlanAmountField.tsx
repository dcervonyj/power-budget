import React, { useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { BODY_FONT, TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import { toMinorUnitsString } from './planAmounts.js';

export interface PlanAmountFieldProps {
  readonly label: string;
  /** The stored amount in major units ("3000.00"). */
  readonly value: string;
  readonly currency: string;
  /** The stored amount, exact minor units; a commit equal to it is not reported. */
  readonly amountMinor: string;
  readonly onCommit: (amountMinor: string) => void;
}

const useStyles = makeStyles((glass) => ({
  field: {
    minHeight: TOUCH_TARGET,
    minWidth: 112,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.control,
    borderWidth: 1,
    borderColor: glass.colors.sep,
    backgroundColor: glass.colors.clear,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
}));

/**
 * Keyboard amount entry. The text is parsed exactly by `core` (no floats) when editing ends; text
 * that is not an amount snaps back to the stored value.
 */
export function PlanAmountField({
  label,
  value,
  currency,
  amountMinor,
  onCommit,
}: PlanAmountFieldProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  function commit(): void {
    const parsed = toMinorUnitsString(text, currency);
    if (parsed === null) {
      setText(value);

      return;
    }
    if (parsed !== amountMinor) {
      onCommit(parsed);
    } else {
      setText(value);
    }
  }

  return (
    <TextInput
      accessibilityLabel={label}
      value={text}
      onChangeText={setText}
      onEndEditing={commit}
      keyboardType="decimal-pad"
      placeholderTextColor={glass.colors.dim}
      style={styles.field}
    />
  );
}
