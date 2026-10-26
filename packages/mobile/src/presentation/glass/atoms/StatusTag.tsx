import React from 'react';
import { Text, View } from 'react-native';
import type { StatusKind } from '@power-budget/shared-app';
import { makeStyles, useGlass } from '../../theme/index.js';
import { Icon } from './Icon.js';
import type { IconName } from './iconPaths.js';

export interface StatusTagProps {
  readonly kind: StatusKind;
  readonly label: string;
  /** Defaults to check (ok), triangle (over) and clock (neutral). */
  readonly icon?: IconName;
}

const DEFAULT_ICONS: Readonly<Record<StatusKind, IconName>> = {
  ok: 'check',
  over: 'triangle',
  neutral: 'clock',
};

const ICON_SIZE = 14;

const useStyles = makeStyles((glass) => ({
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.xxs,
    paddingVertical: 3,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: glass.radius.tag,
  },
  ok: { backgroundColor: glass.colors.okTint },
  over: { backgroundColor: glass.colors.overTint },
  neutral: { backgroundColor: glass.colors.fill2 },
  label: { fontFamily: 'Geist_600SemiBold', fontSize: glass.type.tag.mobile, lineHeight: 17 },
}));

/** Pill with icon and words: status is never colour alone. */
export function StatusTag({ kind, label, icon }: StatusTagProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const color =
    kind === 'ok' ? glass.colors.ok : kind === 'over' ? glass.colors.over : glass.colors.dim;

  return (
    <View
      testID="status-tag"
      accessible
      accessibilityLabel={label}
      style={[styles.tag, styles[kind]]}
    >
      <Icon name={icon ?? DEFAULT_ICONS[kind]} size={ICON_SIZE} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}
