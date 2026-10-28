import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { makeStyles, useGlass } from '../../theme/index.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { ShellBackground } from '../../navigation/ShellBackground.js';
import { ErrorBanner } from '../../glass/overlays/ErrorBanner.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../../glass/controls/fonts.js';

export const CODE_LENGTH = 6;

const useStyles = makeStyles((glass) => ({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: glass.space.lg },
  card: { padding: glass.space.xl, gap: glass.space.md },
  heading: { gap: glass.space.xs, marginBottom: glass.space.xs },
  title: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.title.mobile,
    letterSpacing: -0.4,
  },
  subtitle: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
  status: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  link: { minHeight: TOUCH_TARGET, justifyContent: 'center' },
  linkText: {
    color: glass.colors.accent,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
  codeBox: { gap: glass.space.xxs },
  codeLabel: { color: glass.colors.dim, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  codeInput: {
    minHeight: 56,
    borderRadius: glass.radius.control,
    backgroundColor: glass.colors.clear,
    borderWidth: 1,
    borderColor: glass.colors.sep,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.title.mobile,
    letterSpacing: 10,
    textAlign: 'center',
  },
  codeInputInvalid: { borderColor: glass.colors.over },
}));

/** Full-screen glass auth layout: ambient field behind one frosted card, scrolls on small screens. */
export function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <GlassPanel material="frosted" depth={1} decor={{ specular: true }}>
          <View style={styles.card}>{children}</View>
        </GlassPanel>
      </ScrollView>
    </ShellBackground>
  );
}

export interface AuthHeadingProps {
  readonly title: string;
  readonly subtitle?: string;
}

export function AuthHeading({ title, subtitle }: AuthHeadingProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

/** A failed attempt: over colour, icon and the word "Error", announced as an alert. */
export function AuthNotice({ message }: { readonly message: string }): React.JSX.Element {
  return <ErrorBanner message={message} />;
}

/** Plain status line (loading, hint) in the dim text colour. */
export function AuthStatus({ children }: { readonly children: string }): React.JSX.Element {
  const styles = useStyles();

  return (
    <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={styles.status}>
      {children}
    </Text>
  );
}

export function AuthLinks({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  const styles = useStyles();

  return <View style={styles.links}>{children}</View>;
}

export interface AuthLinkProps {
  readonly label: string;
  readonly onPress: () => void;
}

export function AuthLink({ label, onPress }: AuthLinkProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.link}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export interface CodeFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly invalid?: boolean;
}

/** The 6-digit authenticator code: one numeric field, shown as spaced digits. */
export function CodeField({
  label,
  value,
  onChangeText,
  invalid = false,
}: CodeFieldProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <View style={styles.codeBox}>
      <Text style={styles.codeLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={CODE_LENGTH}
        placeholderTextColor={glass.colors.faint}
        style={[styles.codeInput, invalid ? styles.codeInputInvalid : null]}
      />
    </View>
  );
}
