import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { LABEL_FONT } from './fonts.js';

export interface CountBadgeProps {
  readonly count: number;
  /** Counts above this show as `max+`. */
  readonly max?: number;
  /** Accessible name; defaults to the visible text. */
  readonly label?: string;
}

const useStyles = makeStyles((glass) => ({
  badge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.lightSolid,
  },
  text: {
    color: glass.colors.accentInk,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.tag.mobile,
    lineHeight: glass.type.tag.mobile + 2,
  },
}));

export function CountBadge({ count, max = 99, label }: CountBadgeProps): React.JSX.Element {
  const styles = useStyles();
  const text = count > max ? `${max}+` : String(count);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? text}
      style={styles.badge}
    >
      <Text importantForAccessibility="no" style={styles.text}>
        {text}
      </Text>
    </View>
  );
}
