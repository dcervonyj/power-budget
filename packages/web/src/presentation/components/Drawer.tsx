import React, { useEffect } from 'react';
import { useTheme } from './ThemeContext.js';

export interface DrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
  readonly title?: string;
  readonly width?: number;
}

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  width = 400,
}: DrawerProps): React.JSX.Element {
  const theme = useTheme();

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

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            zIndex: 999,
          }}
          onClick={onClose}
        />
      )}
      <div
        role="complementary"
        aria-label={title}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          backgroundColor: theme.color.surface.raised,
          borderLeft: `1px solid ${theme.color.border.subtle}`,
          transform: isOpen ? 'translateX(0)' : `translateX(${width}px)`,
          transition: 'transform 0.25s ease-in-out',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: theme.space['2xl'],
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: theme.space.lg,
            }}
          >
            <h2
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
              aria-label="Close drawer"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: theme.color.text.secondary,
                fontSize: theme.fontSize.xl,
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', color: theme.color.text.primary }}>
          {children}
        </div>
      </div>
    </>
  );
}
