import React from 'react';

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
  const primary = tone === 'primary';

  return (
    <span
      role="img"
      aria-label={person.name}
      style={{
        display: 'inline-flex',
        flex: 'none',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: primary ? 'var(--pb-glass-accent-tint)' : 'var(--pb-glass-fill2)',
        boxShadow: primary
          ? 'inset 0 0 0 1px var(--pb-glass-accent-edge)'
          : 'inset 0 0 0 1px var(--pb-glass-edge)',
        color: primary ? 'var(--pb-glass-accent)' : 'var(--pb-glass-fg)',
        fontSize: Math.round(size * 0.4),
        fontWeight: 600,
        lineHeight: 1,
      }}
    >
      {person.imageUrl === undefined ? (
        <span aria-hidden="true">{initialsOf(person.name)}</span>
      ) : (
        <img
          src={person.imageUrl}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: 'cover', display: 'block' }}
        />
      )}
    </span>
  );
}

/** Two overlapping avatars (you and your partner); a single one when there is no partner. */
export function AvatarPair({
  primary,
  secondary,
  size = DEFAULT_SIZE,
}: AvatarPairProps): React.JSX.Element {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      <Avatar person={primary} size={size} tone="primary" />
      {secondary === undefined ? null : (
        <span style={{ marginLeft: -Math.round(size * 0.28), display: 'inline-flex' }}>
          <Avatar person={secondary} size={size} tone="secondary" />
        </span>
      )}
    </span>
  );
}

function isNotEmpty(word: string): boolean {
  return word.length > 0;
}

function firstLetter(word: string): string {
  return Array.from(word)[0] ?? '';
}
