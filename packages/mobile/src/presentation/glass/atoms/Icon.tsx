import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { ICON_PATHS, type IconName } from './iconPaths.js';

export interface IconProps {
  readonly name: IconName;
  /** Pixel size of the square icon; defaults to 20. */
  readonly size?: number;
  /** Stroke colour; the caller passes the text colour of the words beside the icon. */
  readonly color: string;
}

const STROKE_WIDTH = 1.75;

/** Decorative stroke icon (hidden from assistive tech); meaning must always come from adjacent words. */
export function Icon({ name, size = 20, color }: IconProps): React.JSX.Element {
  return (
    <Svg
      testID={`icon-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <Path
        d={ICON_PATHS[name]}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
