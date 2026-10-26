import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { FormattedMessage, useIntl } from 'react-intl';
import { makeStyles, useGlass } from '../../theme/index.js';
import { Button } from '../../components/Button.js';
import { BODY_FONT, LABEL_FONT } from '../controls/fonts.js';
import { GlassPanel } from '../material/GlassPanel.js';
import { ErrorBanner } from './ErrorBanner.js';

export interface BiometricOptInPanelProps {
  readonly loading: boolean;
  readonly onEnable: () => void;
  readonly onSkip: () => void;
}

export interface BiometricUnlockPanelProps {
  readonly authenticating: boolean;
  readonly failed: boolean;
  readonly onRetry: () => void;
}

const useStyles = makeStyles((glass) => ({
  content: { padding: glass.space['2xl'], gap: glass.space.md },
  title: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.title.mobile,
    textAlign: 'center',
  },
  body: {
    color: glass.colors.dim,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    textAlign: 'center',
  },
  actions: { gap: glass.space.sm, marginTop: glass.space.sm },
}));

/** First-launch card offering biometric unlock. */
export function BiometricOptInPanel({
  loading,
  onEnable,
  onSkip,
}: BiometricOptInPanelProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();

  return (
    <GlassPanel
      material="frosted"
      depth={2}
      decor={{ specular: true }}
      contentStyle={styles.content}
    >
      <Text accessibilityRole="header" style={styles.title}>
        <FormattedMessage id="biometric.optIn.title" defaultMessage="Enable Biometric Unlock" />
      </Text>
      <Text style={styles.body}>
        <FormattedMessage
          id="biometric.optIn.body"
          defaultMessage="Unlock Power Budget quickly and securely with Face ID or Touch ID."
        />
      </Text>
      <View style={styles.actions}>
        <Button variant="primary" onPress={onEnable} loading={loading}>
          {intl.formatMessage({ id: 'biometric.optIn.enable', defaultMessage: 'Enable' })}
        </Button>
        <Button variant="secondary" onPress={onSkip} disabled={loading}>
          {intl.formatMessage({ id: 'biometric.optIn.skip', defaultMessage: 'Not Now' })}
        </Button>
      </View>
    </GlassPanel>
  );
}

/** Lock card: a spinner while the system prompt is up, a retry (with the failure) after. */
export function BiometricUnlockPanel({
  authenticating,
  failed,
  onRetry,
}: BiometricUnlockPanelProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const intl = useIntl();

  return (
    <GlassPanel
      material="frosted"
      depth={2}
      decor={{ specular: true }}
      contentStyle={styles.content}
    >
      <Text accessibilityRole="header" style={styles.title}>
        <FormattedMessage id="biometric.title" defaultMessage="Unlock App" />
      </Text>
      <Text style={styles.body}>
        <FormattedMessage id="biometric.body" defaultMessage="Authenticate to continue." />
      </Text>
      {authenticating ? (
        <ActivityIndicator
          size="large"
          color={glass.colors.fg}
          accessibilityLabel={intl.formatMessage({
            id: 'biometric.title',
            defaultMessage: 'Unlock App',
          })}
        />
      ) : (
        <View style={styles.actions}>
          {failed ? (
            <ErrorBanner
              message={intl.formatMessage({
                id: 'biometric.failed',
                defaultMessage: 'Authentication failed. Try again.',
              })}
            />
          ) : null}
          <Button variant="primary" onPress={onRetry}>
            {intl.formatMessage({
              id: 'biometric.retry',
              defaultMessage: 'Use Biometrics / Passcode',
            })}
          </Button>
        </View>
      )}
    </GlassPanel>
  );
}
