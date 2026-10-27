import React from 'react';
import { useIntl } from 'react-intl';
import { Icon } from '../../glass/atoms/Icon.js';
import { IconButton } from '../../glass/controls/IconButton.js';
import { Button } from '../Button.js';

export interface BankBannerProps {
  readonly message: React.ReactNode;
  readonly actionLabel: React.ReactNode;
  readonly onAction: () => void;
  readonly onDismiss: () => void;
}

const FRAME_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-sm)',
  padding: 'var(--pb-glass-space-xs) var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-over-tint)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-over)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const MESSAGE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
  overflowWrap: 'anywhere',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
};

/** Shared frame of the bank banners: a warning icon with words, one action and a dismiss. */
export function BankBanner({
  message,
  actionLabel,
  onAction,
  onDismiss,
}: BankBannerProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div role="alert" style={FRAME_STYLE}>
      <span style={MESSAGE_STYLE}>
        <span style={{ display: 'inline-flex', color: 'var(--pb-glass-over)' }}>
          <Icon name="warning" size={18} />
        </span>
        <span>{message}</span>
      </span>
      <span style={ACTIONS_STYLE}>
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
        <IconButton
          label={intl.formatMessage({
            id: 'bank.banner.dismiss',
            defaultMessage: 'Dismiss',
          })}
          onClick={onDismiss}
        >
          <Icon name="close" size={18} />
        </IconButton>
      </span>
    </div>
  );
}
