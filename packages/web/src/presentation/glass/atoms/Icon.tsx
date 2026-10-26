import React from 'react';
import { ICON_PATHS, type IconName } from './iconPaths.js';

export interface IconProps {
  readonly name: IconName;
  /** Pixel size of the square icon; defaults to 20. */
  readonly size?: number;
}

/** Decorative stroke icon (aria-hidden); meaning must always come from adjacent words. */
export function Icon({ name, size = 20 }: IconProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none', display: 'block' }}
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
