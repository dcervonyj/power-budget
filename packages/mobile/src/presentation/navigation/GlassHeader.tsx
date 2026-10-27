import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles, useGlass } from '../theme/index.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { Icon } from '../glass/atoms/Icon.js';
import { IconButton } from '../glass/controls/IconButton.js';
import { LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

export interface GlassHeaderProps {
  readonly title: string;
  readonly backLabel: string;
  /** Shows the back button when set. */
  readonly onBack?: () => void;
  /** Right slot, e.g. the account menu button. */
  readonly right?: React.ReactNode;
  readonly topInset?: number;
}

const useStyles = makeStyles((glass) => ({
  panel: { borderRadius: 0 },
  row: {
    minHeight: TOUCH_TARGET + glass.space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    paddingHorizontal: glass.space.md,
    paddingVertical: glass.space.xxs,
  },
  side: { minWidth: TOUCH_TARGET, alignItems: 'flex-end' },
  title: {
    flex: 1,
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
}));

/** D7 tinted header: title with an optional back button and right slot. Pure view. */
export function GlassHeader({
  title,
  backLabel,
  onBack,
  right,
  topInset = 0,
}: GlassHeaderProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <GlassPanel material="tinted" depth={1} radius={0} style={styles.panel}>
      <View style={[styles.row, { paddingTop: topInset + glass.space.xxs }]}>
        {onBack === undefined ? null : (
          <IconButton label={backLabel} onPress={onBack}>
            <Icon name="arrow-left" size={20} color={glass.colors.fg} />
          </IconButton>
        )}
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {right === undefined ? null : <View style={styles.side}>{right}</View>}
      </View>
    </GlassPanel>
  );
}
