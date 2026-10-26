import React, { useId, useRef } from 'react';
import { useIntl } from 'react-intl';
import { IconButton } from '../controls/IconButton.js';
import { Icon } from '../atoms/Icon.js';
import { GlassPanel } from '../material/GlassPanel.js';
import { useDialogBehavior } from './useDialogBehavior.js';
import './overlays.css';

export interface OverlayFrameProps {
  readonly title?: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
  /** Positions the scrim contents: a centred dialog, a side panel or a bottom sheet. */
  readonly placement: 'center' | 'side' | 'bottom';
  readonly width?: number;
  readonly zIndex: number;
}

const PLACEMENT_STYLES: Readonly<Record<OverlayFrameProps['placement'], React.CSSProperties>> = {
  center: { alignItems: 'center', justifyContent: 'center' },
  side: { alignItems: 'stretch', justifyContent: 'flex-end' },
  bottom: { alignItems: 'flex-end', justifyContent: 'center' },
};

const PANEL_RADIUS: Readonly<Record<OverlayFrameProps['placement'], string>> = {
  center: 'var(--pb-glass-radius-panel)',
  side: 'var(--pb-glass-radius-panel) 0 0 var(--pb-glass-radius-panel)',
  bottom: 'var(--pb-glass-radius-panel) var(--pb-glass-radius-panel) 0 0',
};

/** Scrim plus frosted panel with title row, close button, focus trap, Esc and focus restore. */
export function OverlayFrame({
  title,
  onClose,
  children,
  footer,
  placement,
  width = 560,
  zIndex,
}: OverlayFrameProps): React.JSX.Element {
  const intl = useIntl();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(panelRef, { active: true, onClose });

  const isCenter = placement === 'center';
  const motionClass = {
    center: 'pbg-pop',
    side: 'pbg-sheet-side',
    bottom: 'pbg-sheet-bottom',
  }[placement];

  return (
    <div
      className="pbg-scrim"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        padding: isCenter ? 'var(--pb-glass-space-md)' : 0,
        boxSizing: 'border-box',
        background: 'var(--pb-glass-scrim)',
        ...PLACEMENT_STYLES[placement],
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title === undefined ? undefined : titleId}
        tabIndex={-1}
        className={motionClass}
        onClick={stopPropagation}
        style={{
          outline: 'none',
          display: 'flex',
          width: placement === 'bottom' ? '100%' : `min(${String(width)}px, 100%)`,
          maxHeight: placement === 'side' ? '100%' : '90vh',
          boxSizing: 'border-box',
        }}
      >
        <GlassPanel
          material="frosted"
          depth={1}
          decor={{ specular: true }}
          radius={PANEL_RADIUS[placement]}
          style={{ display: 'flex', flexDirection: 'column', width: '100%', minHeight: 0 }}
          contentStyle={{
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            flex: 1,
            padding: 'var(--pb-glass-space-xl)',
            color: 'var(--pb-glass-fg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--pb-glass-space-sm)',
              marginBottom: 'var(--pb-glass-space-md)',
            }}
          >
            <h2
              id={titleId}
              style={{
                margin: 0,
                fontSize: 'var(--pb-glass-type-heading-web)',
                fontWeight: 600,
                color: 'var(--pb-glass-fg)',
              }}
            >
              {title}
            </h2>
            <IconButton
              label={intl.formatMessage({ id: 'common.close', defaultMessage: 'Close' })}
              onClick={onClose}
            >
              <Icon name="close" size={20} />
            </IconButton>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>{children}</div>
          {footer === undefined ? null : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--pb-glass-space-xs)',
                justifyContent: 'flex-end',
                marginTop: 'var(--pb-glass-space-md)',
              }}
            >
              {footer}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

function stopPropagation(event: React.MouseEvent): void {
  event.stopPropagation();
}
