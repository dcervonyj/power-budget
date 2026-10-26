import React from 'react';
import { Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';
import { Button } from '../../components/Button.js';
import { BODY_FONT, LABEL_FONT } from '../controls/fonts.js';

export interface EmptyStateProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly action?: { readonly label: string; readonly onPress: () => void };
}

const useStyles = makeStyles((glass) => ({
  box: {
    alignItems: 'center',
    gap: glass.space.sm,
    paddingVertical: glass.space['3xl'],
    paddingHorizontal: glass.space.lg,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  title: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
    textAlign: 'center',
  },
  subtitle: {
    color: glass.colors.dim,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    textAlign: 'center',
  },
  action: { marginTop: glass.space.xs, alignSelf: 'stretch' },
}));

/** Centred empty state on clear glass: title, optional subtitle and at most one action. */
export function EmptyState({ title, subtitle, action }: EmptyStateProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
      {action === undefined ? null : (
        <View style={styles.action}>
          <Button variant="primary" onPress={action.onPress}>
            {action.label}
          </Button>
        </View>
      )}
    </View>
  );
}
