import React from 'react';
import { makeStyles } from '../../theme/index.js';
import { LABEL_FONT, TOUCH_TARGET } from './fonts.js';
import { OptionGroup } from './OptionGroup.js';
import type { OptionGroupOption } from './OptionGroup.js';

export interface SegmentedControlProps<T extends string> {
  readonly options: ReadonlyArray<OptionGroupOption<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const useStyles = makeStyles((glass) => ({
  group: {
    flexDirection: 'row',
    gap: glass.space.xxs,
    padding: glass.space.xxs,
    borderRadius: glass.radius.control,
    backgroundColor: glass.colors.track,
  },
  segment: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: glass.radius.control - 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    flex: 1,
    minHeight: TOUCH_TARGET,
    borderRadius: glass.radius.control - 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.g0,
    boxShadow: glass.colors.clearRim,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  text: { color: glass.colors.dim, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  textSelected: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
}));

/** Equal-width segmented picker with radio semantics. */
export function SegmentedControl<T extends string>(
  props: SegmentedControlProps<T>,
): React.JSX.Element {
  const styles = useStyles();

  return (
    <OptionGroup
      {...props}
      groupStyle={styles.group}
      optionStyle={(selected, pressed) => [
        selected ? styles.segmentSelected : styles.segment,
        pressed && styles.pressed,
      ]}
      textStyle={(selected) => (selected ? styles.textSelected : styles.text)}
    />
  );
}
