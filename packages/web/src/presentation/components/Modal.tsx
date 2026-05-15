import React, { useEffect } from 'react';
import { useIntl, FormattedMessage } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Button } from './Button.js';

export interface ModalButton {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly onClick: () => void;
}

export interface ModalProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly footerButtons?: ReadonlyArray<ModalButton>;
  readonly isOpen: boolean;
}

export function Modal({
  title,
  children,
  onClose,
  footerButtons,
  isOpen,
}: ModalProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: theme.color.surface.raised,
          borderRadius: theme.radius.lg,
          padding: theme.space['2xl'],
          minWidth: 320,
          maxWidth: 560,
          width: '90%',
          boxShadow: `0 8px 32px rgba(0,0,0,0.4)`,
        }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: theme.space.lg,
          }}
        >
          <h2
            id="modal-title"
            style={{
              margin: 0,
              color: theme.color.text.primary,
              fontSize: theme.fontSize.xl,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={intl.formatMessage({ id: 'common.close', defaultMessage: 'Close' })}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.color.text.secondary,
              fontSize: theme.fontSize.xl,
            }}
          >
            <FormattedMessage id="common.closeIcon" defaultMessage="×" />
          </button>
        </div>
        <div style={{ color: theme.color.text.primary }}>{children}</div>
        {footerButtons && footerButtons.length > 0 && (
          <div
            style={{
              display: 'flex',
              gap: theme.space.sm,
              justifyContent: 'flex-end',
              marginTop: theme.space.lg,
            }}
          >
            {footerButtons.map((btn) => (
              <Button key={btn.label} variant={btn.variant ?? 'secondary'} onClick={btn.onClick}>
                {btn.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
