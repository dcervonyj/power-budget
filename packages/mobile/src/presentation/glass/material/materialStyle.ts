import type { GlassColors } from '@power-budget/design-tokens/glass';
import type { GlassDepth, GlassMaterial } from '@power-budget/shared-app';
import { splitBoxShadow } from './cssParse.js';

export interface MaterialShadows {
  /** Drop shadow and the hero ring: drawn by the panel, outside its box. */
  readonly outer: string;
  /** Rim layers: drawn by an overlay above the backdrop. */
  readonly inset: string;
}

/** Shadow layers of a material at a depth, from the D7 tokens. Depth 0 is the hero. */
export function materialShadows(
  colors: GlassColors,
  material: GlassMaterial,
  depth: GlassDepth,
): MaterialShadows {
  const hero = depth === 0 ? `0 0 0 1px ${colors.accentEdge}` : '';
  if (material === 'clear' || material === 'tinted') {
    const split = splitBoxShadow(material === 'clear' ? colors.clearRim : colors.tintRim);

    return { inset: split.inset, outer: join(split.outer, hero) };
  }

  return {
    inset: `inset 0 0 0 1px ${colors.edge}, inset 0 1px 0 ${colors.hl}`,
    outer: join(depth === 0 ? colors.shadowF : colors.shadow, hero),
  };
}

export function materialFill(
  colors: GlassColors,
  material: GlassMaterial,
  depth: GlassDepth,
): string {
  if (material === 'clear') {
    return colors.clear;
  }
  if (material === 'tinted') {
    return colors.tint;
  }

  return colors[`g${depth}`];
}

function join(...layers: readonly string[]): string {
  return layers.filter(isPresent).join(', ');
}

function isPresent(layer: string): boolean {
  return layer !== '';
}
