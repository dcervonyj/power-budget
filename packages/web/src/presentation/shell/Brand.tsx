import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import './shell.css';

const BRAND_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-sm)',
  minHeight: 44,
  flex: 'none',
  color: 'var(--pb-glass-fg)',
  textDecoration: 'none',
  fontSize: 'var(--pb-glass-type-panel-label-web)',
  fontWeight: 600,
  letterSpacing: '-0.01em',
};

export interface BrandProps {
  /** Links to the overview (signed-in shell); plain text on the auth pages. */
  readonly link?: boolean;
}

/** Product mark (a small light core in clear glass) and name. */
export function Brand({ link = true }: BrandProps): React.JSX.Element {
  const content = (
    <>
      <BrandMark />
      <FormattedMessage id="shell.brand" defaultMessage="Power Budget" />
    </>
  );
  if (!link) {
    return <span style={BRAND_STYLE}>{content}</span>;
  }

  return (
    <Link to="/dashboard" className="pbs-focus" style={BRAND_STYLE}>
      {content}
    </Link>
  );
}

export function BrandMark(): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: 26,
        height: 26,
        flex: 'none',
        borderRadius: '50%',
        overflow: 'hidden',
        background: 'var(--pb-glass-lens)',
        boxShadow: 'var(--pb-glass-lens-rim)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 4,
          right: 4,
          top: 9,
          bottom: -1,
          borderRadius: '50%',
          background: 'var(--pb-glass-core)',
        }}
      />
    </span>
  );
}
