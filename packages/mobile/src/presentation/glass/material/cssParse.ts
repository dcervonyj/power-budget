/** Pure parsers for the CSS-syntax strings the glass tokens use (gradients, easings, shadows). */

export interface GradientStop {
  readonly color: string;
  /** 0..1 along the gradient line. */
  readonly offset: number;
}

export interface LinearGradient {
  readonly angleDeg: number;
  readonly stops: readonly GradientStop[];
}

export interface RadialGradient {
  /** Ellipse radii and centre as fractions of the box (1 = 100 %). */
  readonly rx: number;
  readonly ry: number;
  readonly cx: number;
  readonly cy: number;
  readonly stops: readonly GradientStop[];
}

export interface SplitShadow {
  /** Inset layers, drawn as a rim above the material. */
  readonly inset: string;
  /** Outer layers, drawn by the panel itself. */
  readonly outer: string;
}

export type CubicBezier = readonly [number, number, number, number];

const LINEAR = /^linear-gradient\((.*)\)$/s;
const RADIAL = /^radial-gradient\((.*)\)$/s;
const BEZIER = /^cubic-bezier\(([^)]*)\)$/;
const TRAILING_PERCENT = /^(.*\S)\s+(-?\d*\.?\d+)%$/;
const ANGLE = /^(-?\d*\.?\d+)deg$/;
const RADIAL_HEAD = /^(\d*\.?\d+)%\s+(\d*\.?\d+)%\s+at\s+(\d*\.?\d+)%\s+(\d*\.?\d+)%$/;

/** Splits on commas that are not inside parentheses. */
export function splitTopLevel(value: string): string[] {
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

  return parts.filter((part) => part !== '');
}

export function parseLinearGradient(css: string): LinearGradient {
  const body = LINEAR.exec(css.trim())?.[1];
  if (body === undefined) {
    throw new Error(`Not a linear-gradient: ${css}`);
  }
  const [head = '', ...rest] = splitTopLevel(body);
  const angle = ANGLE.exec(head);
  if (angle?.[1] === undefined) {
    return { angleDeg: 180, stops: resolveStops([head, ...rest]) };
  }

  return { angleDeg: Number(angle[1]), stops: resolveStops(rest) };
}

export function parseRadialGradient(css: string): RadialGradient {
  const body = RADIAL.exec(css.trim())?.[1];
  if (body === undefined) {
    throw new Error(`Not a radial-gradient: ${css}`);
  }
  const [head = '', ...rest] = splitTopLevel(body);
  const match = RADIAL_HEAD.exec(head);
  if (match === null) {
    return { rx: 0.5, ry: 0.5, cx: 0.5, cy: 0.5, stops: resolveStops([head, ...rest]) };
  }
  const [rx = 0, ry = 0, cx = 0, cy = 0] = match.slice(1).map((part) => Number(part) / 100);

  return { rx, ry, cx, cy, stops: resolveStops(rest) };
}

export function parseCubicBezier(css: string): CubicBezier {
  const body = BEZIER.exec(css.trim())?.[1];
  const numbers = body?.split(',').map((part) => Number(part.trim())) ?? [];
  const [x1, y1, x2, y2] = numbers;
  if (
    numbers.length !== 4 ||
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined
  ) {
    throw new Error(`Not a cubic-bezier: ${css}`);
  }

  return [x1, y1, x2, y2];
}

/** Separates `inset ...` layers from outer ones in a CSS box-shadow list. */
export function splitBoxShadow(css: string): SplitShadow {
  const layers = splitTopLevel(css);

  return {
    inset: layers.filter(isInset).join(', '),
    outer: layers.filter(isOuter).join(', '),
  };
}

function isInset(layer: string): boolean {
  return layer.startsWith('inset ');
}

function isOuter(layer: string): boolean {
  return !isInset(layer);
}

/** Stops without a position are spread evenly between the neighbours that have one. */
function resolveStops(parts: readonly string[]): GradientStop[] {
  const raw = parts.map(parseStop);
  const last = raw.length - 1;

  return raw.map((stop, index) => ({
    color: stop.color,
    offset: stop.offset ?? (last === 0 ? 0 : index / last),
  }));
}

function parseStop(part: string): { color: string; offset: number | undefined } {
  const match = TRAILING_PERCENT.exec(part);
  if (match?.[1] === undefined || match[2] === undefined) {
    return { color: part, offset: undefined };
  }

  return { color: match[1], offset: Number(match[2]) / 100 };
}

const RGBA = /^rgba\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*[^)]+\)$/;

/** The same colour fully transparent, so a gradient fades out without passing through grey. */
export function transparentOf(color: string): string {
  const match = RGBA.exec(color.trim());
  if (match === null) {
    return 'rgba(0,0,0,0)';
  }

  return `rgba(${match[1]},${match[2]},${match[3]},0)`;
}
