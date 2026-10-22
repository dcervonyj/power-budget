import type { GlassTheme } from './tokens.js';

export interface GlassRnTheme {
  readonly name: string;
  readonly colors: GlassTheme['color'];
  readonly motion: GlassTheme['motion'];
  readonly type: GlassTheme['type'];
  readonly radius: GlassTheme['radius'];
  readonly space: GlassTheme['space'];
  readonly blur: GlassTheme['blur'];
}

export function glassThemeToRn(theme: GlassTheme): GlassRnTheme {
  return {
    name: theme.name,
    colors: theme.color,
    motion: theme.motion,
    type: theme.type,
    radius: theme.radius,
    space: theme.space,
    blur: theme.blur,
  };
}
