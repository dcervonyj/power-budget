import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import { makeStyles, useGlass } from '../../theme/index.js';
import { IconButton } from '../controls/IconButton.js';
import { BODY_FONT } from '../controls/fonts.js';
import { GlassPanel } from '../material/GlassPanel.js';
import { CloseGlyph } from './glyphs.js';

export const TOAST_DISMISS_MS = 6000;

export interface ToastProps {
  /** The text to show; nothing renders without one. */
  readonly message: string | null;
  readonly onDismiss: () => void;
}

export interface ToastApi {
  readonly show: (message: string) => void;
}

const useStyles = makeStyles((glass) => ({
  anchor: {
    position: 'absolute',
    left: glass.space.lg,
    right: glass.space.lg,
    bottom: glass.space['3xl'],
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.sm,
    paddingLeft: glass.space.lg,
    paddingRight: glass.space.xs,
    paddingVertical: glass.space.xs,
  },
  message: {
    flexShrink: 1,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
  },
}));

/**
 * A short frosted notice that goes away by itself after 6 s. A polite live region: it is announced
 * without taking focus. Non-destructive notices only; destructive confirmations stay native.
 */
export function Toast({ message, onDismiss }: ToastProps): React.JSX.Element | null {
  const styles = useStyles();
  const glass = useGlass();
  const intl = useIntl();

  useEffect(() => {
    if (message === null) {
      return undefined;
    }
    const timer = setTimeout(onDismiss, TOAST_DISMISS_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  if (message === null) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.anchor}>
      <GlassPanel
        material="frosted"
        depth={2}
        radius={glass.radius.chip}
        rise={0}
        contentStyle={styles.row}
      >
        <View
          accessible
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={styles.message}
        >
          <Text style={styles.message}>{message}</Text>
        </View>
        <IconButton
          label={intl.formatMessage({ id: 'glass-overlays.dismiss', defaultMessage: 'Dismiss' })}
          onPress={onDismiss}
        >
          <CloseGlyph color={glass.colors.fg} />
        </IconButton>
      </GlassPanel>
    </View>
  );
}

const ToastContext = createContext<ToastApi | null>(null);

/** Hosts one toast over `children`; a new message replaces the current one. */
export function ToastProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((next: string) => {
    setMessage(next);
  }, []);
  const dismiss = useCallback(() => {
    setMessage(null);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toast message={message} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) {
    throw new Error('useToast must be used inside a ToastProvider');
  }

  return api;
}
