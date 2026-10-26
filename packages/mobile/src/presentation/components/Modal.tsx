import React from 'react';
import { Button } from './Button.js';
import { Sheet } from '../glass/overlays/Sheet.js';

export interface MobileModalButton {
  readonly label: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly onPress: () => void;
}

export interface ModalProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onClose: () => void;
  readonly footerButtons?: ReadonlyArray<MobileModalButton>;
}

/** A dialog restyled as the D7 bottom sheet; the props are the pre-glass Modal's. */
export function Modal({
  isOpen,
  title,
  children,
  onClose,
  footerButtons,
}: ModalProps): React.JSX.Element {
  return (
    <Sheet isOpen={isOpen} title={title} onClose={onClose} footer={renderFooter(footerButtons)}>
      {children}
    </Sheet>
  );
}

function renderFooter(buttons: ReadonlyArray<MobileModalButton> | undefined): React.ReactNode {
  if (buttons === undefined || buttons.length === 0) {
    return undefined;
  }

  return buttons.map(renderButton);
}

function renderButton(button: MobileModalButton): React.JSX.Element {
  return (
    <Button key={button.label} variant={button.variant ?? 'secondary'} onPress={button.onPress}>
      {button.label}
    </Button>
  );
}
