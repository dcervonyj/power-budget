import React, { useEffect } from 'react';
import { useTheme } from '../ThemeContext.js';

const STYLE_ID = 'pb-skeleton-keyframes';

function ensureKeyframes(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pb-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
  `;
  document.head.appendChild(style);
}

export interface SkeletonBlockProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
}

export function SkeletonBlock({
  width = '100%',
  height = 20,
  borderRadius,
}: SkeletonBlockProps): React.JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    ensureKeyframes();
  }, []);

  const bg = theme.color.surface.raised;
  const shimmer = theme.color.surface.mid;

  return (
    <div
      aria-hidden="true"
      style={{
        width,
        height,
        borderRadius: borderRadius ?? theme.radius.sm,
        background: `linear-gradient(90deg, ${bg} 25%, ${shimmer} 50%, ${bg} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'pb-shimmer 1.4s ease infinite',
      }}
    />
  );
}
