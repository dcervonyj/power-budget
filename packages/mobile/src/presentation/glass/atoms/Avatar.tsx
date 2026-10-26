import React from 'react';
import { Image, Text, View } from 'react-native';
import { makeStyles } from '../../theme/index.js';

export interface AvatarPerson {
  readonly name: string;
  readonly imageUrl?: string;
}

export interface AvatarProps {
  readonly person: AvatarPerson;
  readonly size?: number;
  /** Primary is the viewer (honey tint); secondary is the partner (neutral glass). */
  readonly tone?: 'primary' | 'secondary';
}

export interface AvatarPairProps {
  readonly primary: AvatarPerson;
  readonly secondary?: AvatarPerson;
  readonly size?: number;
}

const DEFAULT_SIZE = 32;
const MAX_INITIALS = 2;
const OVERLAP = 0.28;
const INITIALS_SCALE = 0.4;

const useStyles = makeStyles((glass) => ({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1 },
  primary: { backgroundColor: glass.colors.accentTint, borderColor: glass.colors.accentEdge },
  secondary: { backgroundColor: glass.colors.fill2, borderColor: glass.colors.edge },
  primaryText: { color: glass.colors.accent },
  secondaryText: { color: glass.colors.fg },
  initials: { fontFamily: 'Geist_600SemiBold' },
  pair: { flexDirection: 'row', alignItems: 'center' },
}));

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(isNotEmpty);

  return words.slice(0, MAX_INITIALS).map(firstLetter).join('').toLocaleUpperCase();
}

/** Round avatar: photo when given, initials otherwise. Named for assistive tech. */
export function Avatar({
  person,
  size = DEFAULT_SIZE,
  tone = 'primary',
}: AvatarProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={person.name}
      style={[
        styles.base,
        styles[tone],
        { width: size, height: size, borderRadius: size / 2, flexShrink: 0 },
      ]}
    >
      {person.imageUrl === undefined ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.initials,
            tone === 'primary' ? styles.primaryText : styles.secondaryText,
            { fontSize: Math.round(size * INITIALS_SCALE) },
          ]}
        >
          {initialsOf(person.name)}
        </Text>
      ) : (
        <Image
          accessibilityElementsHidden
          source={{ uri: person.imageUrl }}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  );
}

/** Two overlapping avatars (you and your partner); a single one when there is no partner. */
export function AvatarPair({
  primary,
  secondary,
  size = DEFAULT_SIZE,
}: AvatarPairProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.pair}>
      <Avatar person={primary} size={size} tone="primary" />
      {secondary === undefined ? null : (
        <View style={{ marginLeft: -Math.round(size * OVERLAP) }}>
          <Avatar person={secondary} size={size} tone="secondary" />
        </View>
      )}
    </View>
  );
}

function isNotEmpty(word: string): boolean {
  return word.length > 0;
}

function firstLetter(word: string): string {
  return Array.from(word)[0] ?? '';
}
