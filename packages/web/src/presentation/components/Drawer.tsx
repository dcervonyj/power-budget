import React from 'react';
import { OverlayFrame } from '../glass/overlays/OverlayFrame.js';

export interface DrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly width?: number;
}

/** Frosted side drawer on the right edge; same behaviour as Modal (focus trap, Esc, restore). */
export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  width = 400,
}: DrawerProps): React.JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <OverlayFrame title={title} onClose={onClose} placement="side" width={width} zIndex={1000}>
      {children}
    </OverlayFrame>
  );
}
