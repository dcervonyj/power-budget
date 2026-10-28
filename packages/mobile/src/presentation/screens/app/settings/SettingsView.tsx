import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import { Avatar } from '../../../glass/atoms/Avatar.js';
import { FilterChips } from '../../../glass/controls/FilterChips.js';
import { SegmentedControl } from '../../../glass/controls/SegmentedControl.js';
import { Switch } from '../../../glass/controls/Switch.js';
import { BODY_FONT, LABEL_FONT } from '../../../glass/controls/fonts.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { Skeleton } from '../../../glass/overlays/Skeleton.js';
import { Button } from '../../../components/Button.js';
import { Input } from '../../../components/Input.js';
import { makeStyles } from '../../../theme/index.js';
import type { ThemePreference } from '../../../theme/index.js';
import { LOCALE_NAMES, SETTINGS_CURRENCIES, SETTINGS_LOCALES } from './settingsTypes.js';
import type { SettingsViewProps } from './settingsTypes.js';

const PREFERENCES: readonly ThemePreference[] = ['system', 'dark', 'light'];

const useStyles = makeStyles((glass) => ({
  page: { padding: glass.space.lg, gap: glass.space.lg },
  section: { padding: glass.space.lg, gap: glass.space.md },
  heading: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
  note: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  identity: { flexDirection: 'row', alignItems: 'center', gap: glass.space.md },
  email: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { flex: 1, gap: glass.space.xxs },
  status: { color: glass.colors.dim, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  statusError: {
    color: glass.colors.over,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
}));

/** Settings: profile, appearance, language, base currency, biometric unlock and sign out. */
export function SettingsView(props: SettingsViewProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();

  // Sign out stays available in every state, so a stalled profile request cannot trap the user.
  const signOut = (
    <Button variant="secondary" loading={props.signingOut} onPress={props.onSignOut}>
      {intl.formatMessage({ id: 'settings.signOut', defaultMessage: 'Sign out' })}
    </Button>
  );
  if (props.loadState === 'loading') {
    return (
      <ScrollView contentContainerStyle={styles.page} testID="settings-loading">
        <Skeleton height={180} />
        <Skeleton height={120} />
        {signOut}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} testID="settings-screen">
      {props.loadState === 'error' ? <SettingsLoadError onRetry={props.onRetry} /> : null}
      {props.loadState === 'ready' ? <ProfileSection {...props} /> : null}
      <AppearanceSection {...props} />
      {props.loadState === 'ready' ? <PreferencesSection {...props} /> : null}
      {props.biometricAvailable ? <BiometricSection {...props} /> : null}
      {signOut}
    </ScrollView>
  );
}

function SettingsLoadError({ onRetry }: { readonly onRetry: () => void }): React.JSX.Element {
  const intl = useIntl();

  return (
    <ErrorBanner
      message={intl.formatMessage({
        id: 'settings.loadError',
        defaultMessage: 'Could not load your profile.',
      })}
      onRetry={onRetry}
    />
  );
}

function ProfileSection(props: SettingsViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const name = intl.formatMessage({ id: 'settings.profile.name', defaultMessage: 'Display name' });

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {intl.formatMessage({ id: 'settings.profile.title', defaultMessage: 'Profile' })}
      </Text>
      <View style={styles.identity}>
        <Avatar person={{ name: props.nameDraft }} size={56} />
        <Text style={styles.email}>{props.email}</Text>
      </View>
      <Input label={name} value={props.nameDraft} onChangeText={props.onNameChange} />
      <Button
        variant="primary"
        loading={props.nameSave === 'saving'}
        disabled={props.nameDraft.trim() === ''}
        onPress={props.onNameSave}
      >
        {intl.formatMessage({ id: 'settings.profile.save', defaultMessage: 'Save changes' })}
      </Button>
      <SaveStatus state={props.nameSave} />
    </GlassPanel>
  );
}

function SaveStatus({
  state,
}: {
  readonly state: SettingsViewProps['nameSave'];
}): React.JSX.Element | null {
  const intl = useIntl();
  const styles = useStyles();

  if (state === 'saved') {
    return (
      <Text accessibilityRole="alert" style={styles.status}>
        {intl.formatMessage({ id: 'settings.saved', defaultMessage: 'Saved' })}
      </Text>
    );
  }
  if (state === 'error') {
    return (
      <Text accessibilityRole="alert" style={styles.statusError}>
        {intl.formatMessage({
          id: 'settings.saveError',
          defaultMessage: 'Could not save. Please try again.',
        })}
      </Text>
    );
  }

  return null;
}

function AppearanceSection({
  preference,
  onPreferenceChange,
}: SettingsViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const labels: Record<ThemePreference, string> = {
    system: intl.formatMessage({ id: 'settings.appearance.system', defaultMessage: 'System' }),
    dark: intl.formatMessage({ id: 'settings.appearance.night', defaultMessage: 'Night' }),
    light: intl.formatMessage({ id: 'settings.appearance.day', defaultMessage: 'Day' }),
  };
  const title = intl.formatMessage({
    id: 'settings.appearance.title',
    defaultMessage: 'Appearance',
  });

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <Text style={styles.note}>
        {intl.formatMessage({
          id: 'settings.appearance.description',
          defaultMessage:
            'Choose Night, Day, or follow your device. The choice is kept on this device.',
        })}
      </Text>
      <SegmentedControl
        label={title}
        value={preference}
        onChange={onPreferenceChange}
        options={PREFERENCES.map((value) => ({ value, label: labels[value] }))}
      />
    </GlassPanel>
  );
}

function PreferencesSection(props: SettingsViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const language = intl.formatMessage({ id: 'settings.locale.title', defaultMessage: 'Language' });
  const currency = intl.formatMessage({
    id: 'settings.currency.title',
    defaultMessage: 'Base currency',
  });

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {language}
      </Text>
      <FilterChips
        label={language}
        value={props.locale}
        onChange={props.onLocaleChange}
        options={SETTINGS_LOCALES.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        {currency}
      </Text>
      <FilterChips
        label={currency}
        value={props.baseCurrency ?? ''}
        onChange={(value) => {
          const chosen = SETTINGS_CURRENCIES.find((code) => code === value);
          if (chosen !== undefined) {
            props.onCurrencyChange(chosen);
          }
        }}
        options={SETTINGS_CURRENCIES.map((value) => ({ value, label: value }))}
      />
      {props.preferencesError ? <SaveStatus state="error" /> : null}
    </GlassPanel>
  );
}

function BiometricSection({
  biometricEnabled,
  biometricError,
  onBiometricChange,
}: SettingsViewProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const title = intl.formatMessage({
    id: 'settings.biometric.title',
    defaultMessage: 'Biometric unlock',
  });

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.section}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.note}>
            {intl.formatMessage({
              id: 'settings.biometric.description',
              defaultMessage: 'Ask for Face ID, fingerprint or your passcode when the app opens.',
            })}
          </Text>
        </View>
        <Switch label={title} checked={biometricEnabled} onChange={onBiometricChange} />
      </View>
      {biometricError ? (
        <Text accessibilityRole="alert" style={styles.statusError}>
          {intl.formatMessage({
            id: 'settings.biometric.error',
            defaultMessage: 'Could not change biometric unlock. Please try again.',
          })}
        </Text>
      ) : null}
    </GlassPanel>
  );
}
