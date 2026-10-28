import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { Icon } from '../../../glass/atoms/Icon.js';
import { TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import { useOverviewStyles } from './overviewStyles.js';
import { useOverviewLabels } from './useOverviewLabels.js';

const ICON_BOX = 36;

const useStyles = makeStyles((glass) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    minHeight: TOUCH_TARGET,
    paddingVertical: glass.space.sm,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: ICON_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.accentTint,
  },
  texts: { flex: 1, gap: 2 },
  title: {
    color: glass.colors.accent,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.label.mobile,
  },
}));

export interface ToSortCardProps {
  readonly count: number;
  readonly onPress: () => void;
}

/** Clear card with the number of transactions waiting for a category; opens To sort. */
export function ToSortCard({ count, onPress }: ToSortCardProps): React.JSX.Element {
  const styles = useStyles();
  const text = useOverviewStyles();
  const glass = useGlass();
  const labels = useOverviewLabels();

  return (
    <Pressable
      testID="overview-to-sort"
      accessibilityRole="button"
      accessibilityLabel={labels.toSortAction(count)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View
        style={styles.iconBox}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="tag" size={18} color={glass.colors.accent} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{labels.toSortTitle(count)}</Text>
        <Text style={text.small}>{labels.toSortHint()}</Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Icon name="arrow-right" size={18} color={glass.colors.dim} />
      </View>
    </Pressable>
  );
}
