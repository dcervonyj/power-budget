import React from 'react';
import { Link } from 'react-router-dom';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import '../../glass/controls/controls.css';

export const AUTH_FORM_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-md)',
};

const HEADING_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
  marginBottom: 'var(--pb-glass-space-lg)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-title-web)',
  fontWeight: 600,
  letterSpacing: '-0.02em',
  color: 'var(--pb-glass-fg)',
};

const SUBTITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-body-web)',
  color: 'var(--pb-glass-dim)',
};

const LINKS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'space-between',
  gap: 'var(--pb-glass-space-sm)',
  marginTop: 'var(--pb-glass-space-lg)',
};

const LINK_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: 'var(--pb-glass-accent)',
  fontSize: 'var(--pb-glass-type-small-web)',
  fontWeight: 600,
};

const LABEL_STYLE: React.CSSProperties = {
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const CODE_INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 56,
  boxSizing: 'border-box',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 'var(--pb-glass-type-title-web)',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.6em',
  paddingLeft: '0.6em',
  textAlign: 'center',
};

export interface AuthHeadingProps {
  readonly title: React.ReactNode;
  readonly subtitle?: React.ReactNode;
}

export function AuthHeading({ title, subtitle }: AuthHeadingProps): React.JSX.Element {
  return (
    <header style={HEADING_STYLE}>
      <h1 style={TITLE_STYLE}>{title}</h1>
      {subtitle !== undefined && <p style={SUBTITLE_STYLE}>{subtitle}</p>}
    </header>
  );
}

/** A failed attempt: over colour, icon and the word "Error", announced as an alert. */
export function AuthNotice({ message }: { readonly message: React.ReactNode }): React.JSX.Element {
  return <ErrorBanner message={message} />;
}

/** Plain status line (loading, hint) in the dim text colour. */
export function AuthStatus({
  children,
  id,
}: {
  readonly children: React.ReactNode;
  readonly id?: string;
}): React.JSX.Element {
  return (
    <p id={id} role="status" style={{ ...SUBTITLE_STYLE, margin: 0 }}>
      {children}
    </p>
  );
}

export function AuthLinks({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  return <nav style={LINKS_STYLE}>{children}</nav>;
}

export interface AuthLinkProps {
  readonly to: string;
  readonly state?: unknown;
  readonly children: React.ReactNode;
}

export function AuthLink({ to, state, children }: AuthLinkProps): React.JSX.Element {
  return (
    <Link to={to} state={state} style={LINK_STYLE}>
      {children}
    </Link>
  );
}

export interface CodeFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly invalid?: boolean;
  /** Id of the text that names the whole 6-digit group, for the group role. */
  readonly groupLabelId?: string;
}

const CODE_LENGTH = 6;

/** The 6-digit authenticator code: one numeric field, shown as spaced digits. */
export function CodeField({
  id,
  label,
  value,
  onChange,
  invalid = false,
  groupLabelId,
}: CodeFieldProps): React.JSX.Element {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.value);
  };
  const field = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xxs)' }}>
      <label htmlFor={id} style={LABEL_STYLE}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        value={value}
        onChange={handleChange}
        aria-invalid={invalid}
        className="pbg-ctl pbg-ctl-field"
        style={{
          ...CODE_INPUT_STYLE,
          boxShadow: invalid
            ? 'inset 0 0 0 1.5px var(--pb-glass-over)'
            : 'inset 0 0 0 1px var(--pb-glass-edge)',
        }}
      />
    </div>
  );

  if (groupLabelId === undefined) {
    return field;
  }

  return (
    <div role="group" aria-labelledby={groupLabelId}>
      {field}
    </div>
  );
}
