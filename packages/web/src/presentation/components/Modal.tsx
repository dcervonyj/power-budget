import React from 'react';
import { Button } from './Button.js';
import { OverlayFrame } from '../glass/overlays/OverlayFrame.js';

export interface ModalButton {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly loading?: boolean;
  readonly onClick: () => void;
}

export interface ModalProps {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly footerButtons?: ReadonlyArray<ModalButton>;
  readonly isOpen: boolean;
}

/** Frosted centred dialog: scrim token, focus trap, Esc to close, focus restored on close. */
export function Modal({
  title,
  children,
  onClose,
  footerButtons,
  isOpen,
}: ModalProps): React.JSX.Element | null {
  if (!isOpen) {
    return null;
  }
  const footer =
    footerButtons !== undefined && footerButtons.length > 0
      ? footerButtons.map((btn) => (
          <Button
            key={btn.label}
            variant={btn.variant ?? 'secondary'}
            loading={btn.loading}
            onClick={btn.onClick}
          >
            {btn.label}
          </Button>
        ))
      : undefined;

  return (
    <OverlayFrame title={title} onClose={onClose} footer={footer} placement="center" zIndex={1000}>
      {children}
    </OverlayFrame>
  );
}
