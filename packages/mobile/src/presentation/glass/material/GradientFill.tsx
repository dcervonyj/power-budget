import React, { useId } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { GradientStop } from './cssParse.js';

export interface GradientFillProps {
  readonly kind: 'radial' | 'linear';
  readonly stops: readonly GradientStop[];
  /** Linear only: gradient direction as a unit vector from start to end, in box fractions. */
  readonly from?: readonly [number, number];
  readonly to?: readonly [number, number];
}

const CENTER = '50%';

/** Fills its parent with a gradient (react-native-svg). Purely decorative, no hit target. */
export function GradientFill({
  kind,
  stops,
  from = [0, 0],
  to = [1, 0],
}: GradientFillProps): React.JSX.Element {
  const id = `pb${useId().replace(/\W/g, '')}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      <Defs>
        {kind === 'radial' ? (
          <RadialGradient id={id} cx={CENTER} cy={CENTER} r={CENTER}>
            {renderStops(stops)}
          </RadialGradient>
        ) : (
          <LinearGradient id={id} x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}>
            {renderStops(stops)}
          </LinearGradient>
        )}
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

function renderStops(stops: readonly GradientStop[]): React.JSX.Element[] {
  return stops.map(renderStop);
}

function renderStop(stop: GradientStop): React.JSX.Element {
  return <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />;
}
