import React, { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Icon } from '../../glass/atoms/Icon.js';
import { IconButton } from '../../glass/controls/IconButton.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import '../../glass/overlays/overlays.css';

const DISMISS_AFTER_MS = 6000;

export interface ToastProps {
  /** The text to show; nothing renders without one. */
  readonly message: string | null;
  readonly onDismiss: () => void;
}

/** A short frosted notice at the bottom of the screen that goes away by itself. */
export function Toast({ message, onDismiss }: ToastProps): React.JSX.Element | null {
  const intl = useIntl();

  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  if (message === null) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'var(--pb-glass-space-xl)',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 32px)',
        zIndex: 1100,
      }}
    >
      <div className="pbg-pop">
        <GlassPanel
          material="frosted"
          depth={1}
          radius="var(--pb-glass-radius-chip)"
          contentStyle={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--pb-glass-space-sm)',
            padding:
              'var(--pb-glass-space-xs) var(--pb-glass-space-xs) var(--pb-glass-space-xs) var(--pb-glass-space-md)',
            color: 'var(--pb-glass-fg)',
            fontSize: 'var(--pb-glass-type-body-web)',
          }}
        >
          <span>{message}</span>
          <IconButton
            label={intl.formatMessage({
              id: 'component.shared.toast.dismiss',
              defaultMessage: 'Dismiss',
            })}
            onClick={onDismiss}
          >
            <Icon name="close" size={18} />
          </IconButton>
        </GlassPanel>
      </div>
    </div>
  );
}
