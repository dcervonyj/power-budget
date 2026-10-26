import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface GlyphProps {
  readonly color: string;
  readonly size?: number;
}

const DEFAULT_SIZE = 18;

/** Close cross. Decorative: the button that holds it carries the accessible name. */
export function CloseGlyph({ color, size = DEFAULT_SIZE }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Warning triangle. Decorative: the word next to it carries the meaning. */
export function WarningGlyph({ color, size = DEFAULT_SIZE }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 2 1.5 13.5h13L8 2ZM8 6.5v3M8 11.6v.01"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
