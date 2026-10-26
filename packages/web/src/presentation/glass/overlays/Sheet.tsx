import React from 'react';
import { useMediaQuery } from '../../theme/mediaQuery.js';
import { OverlayFrame } from './OverlayFrame.js';

export const SHEET_BREAKPOINT_QUERY = '(max-width: 820px)';

export interface SheetProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title?: string;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  /** Width of the side sheet on desktop. */
  readonly width?: number;
}

/** Bottom sheet at 820 px and below, side sheet on desktop. Traps focus and restores it on close. */
export function Sheet({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = 440,
}: SheetProps): React.JSX.Element | null {
  const isCompact = useMediaQuery(SHEET_BREAKPOINT_QUERY);
  if (!isOpen) {
    return null;
  }

  return (
    <OverlayFrame
      title={title}
      onClose={onClose}
      footer={footer}
      placement={isCompact ? 'bottom' : 'side'}
      width={width}
      zIndex={1000}
    >
      {children}
    </OverlayFrame>
  );
}
