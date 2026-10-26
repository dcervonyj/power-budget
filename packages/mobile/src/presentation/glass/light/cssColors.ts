export interface GradientStops {
  readonly colors: string[];
  readonly positions: number[];
}

const COLOR = /rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/;
const NUMBER = /-?\d*\.?\d+(%?)/g;

/**
 * Colour stops of a glass-token CSS gradient (`radial-gradient(closest-side,c 0%,c 50%)`), as the
 * `colors` / `positions` arrays Skia gradients take. A stop without a position is spread evenly.
 */
export function parseGradientStops(css: string): GradientStops {
  const layer = gradientLayers(css)[0] ?? css;

  return stopsOfLayer(layer);
}

/** The gradient layers of a (possibly multi-layer) CSS background, top layer first. */
export function gradientLayers(css: string): string[] {
  return splitTopLevel(css).filter(isGradient);
}

/** Stops of the n-th gradient layer. */
export function parseLayerStops(css: string, layer: number): GradientStops {
  return stopsOfLayer(gradientLayers(css)[layer] ?? css);
}

/** The first colour of a CSS value such as a box-shadow list (`inset 0 0 0 1px rgba(...)`). */
export function firstColor(css: string): string {
  return COLOR.exec(css)?.[0] ?? 'transparent';
}

function isGradient(layer: string): boolean {
  return layer.includes('-gradient(');
}

function stopsOfLayer(layer: string): GradientStops {
  const open = layer.indexOf('(');
  const inner = layer.slice(open + 1, layer.lastIndexOf(')'));
  const stops = splitTopLevel(inner).filter(hasColor);
  const colors = stops.map(firstColor);
  const explicit = stops.map(positionOf);

  return { colors, positions: fillPositions(explicit) };
}

function hasColor(segment: string): boolean {
  return COLOR.test(segment);
}

function positionOf(segment: string): number | undefined {
  const rest = segment.replace(COLOR, '');
  const matches = rest.match(NUMBER) ?? [];
  const last = matches[matches.length - 1];
  if (last === undefined) {
    return undefined;
  }

  return last.endsWith('%') ? Number.parseFloat(last) / 100 : Number.parseFloat(last);
}

function fillPositions(explicit: readonly (number | undefined)[]): number[] {
  const last = explicit.length - 1;

  return explicit.map((position, index) => position ?? (last === 0 ? 0 : index / last));
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());

  return parts;
}
