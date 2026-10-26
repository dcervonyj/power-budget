import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { makeStyles, useGlass } from '../../theme/index.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../controls/fonts.js';
import { WarningGlyph } from './glyphs.js';

export interface ErrorBannerProps {
  readonly message: string;
  readonly onRetry?: () => void;
}

const useStyles = makeStyles((glass) => ({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: glass.space.sm,
    paddingVertical: glass.space.sm,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.control,
    backgroundColor: glass.colors.overTint,
    boxShadow: `inset 0 0 0 1px ${glass.colors.over}`,
  },
  text: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: glass.space.xs },
  label: { color: glass.colors.over, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  message: { color: glass.colors.fg, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  retry: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.tag,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  retryText: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
}));

/**
 * Error notice that does not rely on colour: red tint, a warning icon and the word "Error". The
 * banner is the one assertive live region, so a screen reader announces it once.
 */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const intl = useIntl();
  const retryLabel = intl.formatMessage({ id: 'glass-overlays.retry', defaultMessage: 'Retry' });

  return (
    <View style={styles.banner}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={styles.text}
      >
        <WarningGlyph color={glass.colors.over} />
        <Text style={styles.label}>
          <FormattedMessage id="glass-overlays.error.label" defaultMessage="Error" />
        </Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onRetry === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{retryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
