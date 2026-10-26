import React from 'react';
import { makeStyles } from '../../theme/index.js';
import { LABEL_FONT, TOUCH_TARGET } from './fonts.js';
import { OptionGroup } from './OptionGroup.js';
import type { OptionGroupOption } from './OptionGroup.js';

export interface FilterChipsProps<T extends string> {
  readonly options: ReadonlyArray<OptionGroupOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const useStyles = makeStyles((glass) => ({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: glass.space.xs },
  chip: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  chipSelected: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.lightSolid,
    boxShadow: `inset 0 0 0 1px ${glass.colors.lightEdge}`,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  text: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  textSelected: {
    color: glass.colors.accentInk,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
}));

/** Clear-glass chip group with radio semantics (one value selected). */
export function FilterChips<T extends string>(props: FilterChipsProps<T>): React.JSX.Element {
  const styles = useStyles();

  return (
    <OptionGroup
      {...props}
      groupStyle={styles.group}
      optionStyle={(selected, pressed) => [
        selected ? styles.chipSelected : styles.chip,
        pressed && styles.pressed,
      ]}
      textStyle={(selected) => (selected ? styles.textSelected : styles.text)}
    />
  );
}
