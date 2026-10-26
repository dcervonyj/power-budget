import React from 'react';
import { Pressable, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { TOUCH_TARGET } from './fonts.js';

export interface SwitchProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly label: string;
  readonly disabled?: boolean;
}

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 24;
const INSET = 4;

const useStyles = makeStyles((glass) => ({
  hit: {
    width: TRACK_WIDTH,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackOff: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
    justifyContent: 'center',
  },
  trackOn: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: glass.colors.lightSolid,
    boxShadow: `inset 0 0 0 1px ${glass.colors.lightEdge}`,
    justifyContent: 'center',
  },
  thumbOff: {
    position: 'absolute',
    left: INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: glass.colors.fg,
  },
  thumbOn: {
    position: 'absolute',
    left: TRACK_WIDTH - THUMB - INSET,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: glass.colors.accentInk,
  },
  disabled: { opacity: 0.45 },
}));

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: SwitchProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => {
        onChange(!checked);
      }}
      style={[styles.hit, disabled && styles.disabled]}
    >
      <View style={checked ? styles.trackOn : styles.trackOff}>
        <View style={checked ? styles.thumbOn : styles.thumbOff} />
      </View>
    </Pressable>
  );
}
