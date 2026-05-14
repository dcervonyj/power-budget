// rn.ts — flattens Theme into a React Native compatible flat object
import type { Theme } from './tokens.js';

// RnTheme is a flat camelCase object (RN doesn't support CSS variables)
export type RnTheme = {
  // colors
  colorSurfaceBase: string;
  colorSurfaceRaised: string;
  colorSurfaceMid: string;
  colorSurfaceOverlay: string;
  colorBorderSubtle: string;
  colorBorderStrong: string;
  colorTextPrimary: string;
  colorTextSecondary: string;
  colorTextMuted: string;
  colorAccentDefault: string;
  colorAccentOnAccent: string;
  colorIncomeDefault: string;
  colorStatusSuccess: string;
  colorStatusWarning: string;
  colorStatusDanger: string;
  colorHeroBgStart: string;
  colorHeroBgEnd: string;
  colorHeroTopAccent: string;
  colorHeroSparkline: string;
  // space (px numbers, unitless for RN)
  spaceXs: number;
  spaceSm: number;
  spaceMd: number;
  spaceLg: number;
  spaceXl: number;
  space2xl: number;
  space3xl: number;
  space4xl: number;
  // radius
  radiusSm: number;
  radiusMd: number;
  radiusLg: number;
  radiusPill: number;
  // font family
  fontFamilySans: string;
  // font size
  fontSizeXs: number;
  fontSizeSm: number;
  fontSizeMd: number;
  fontSizeLg: number;
  fontSizeXl: number;
  fontSize2xl: number;
  fontSize3xl: number;
  // font weight (RN uses string for fontWeight)
  fontWeightRegular: '400';
  fontWeightMedium: '500';
  fontWeightSemibold: '600';
  fontWeightBold: '700';
  // line height
  lineHeightTight: number;
  lineHeightNormal: number;
  lineHeightLoose: number;
};

export function themeToRn(theme: Theme): RnTheme {
  return {
    colorSurfaceBase: theme.color.surface.base,
    colorSurfaceRaised: theme.color.surface.raised,
    colorSurfaceMid: theme.color.surface.mid,
    colorSurfaceOverlay: theme.color.surface.overlay,
    colorBorderSubtle: theme.color.border.subtle,
    colorBorderStrong: theme.color.border.strong,
    colorTextPrimary: theme.color.text.primary,
    colorTextSecondary: theme.color.text.secondary,
    colorTextMuted: theme.color.text.muted,
    colorAccentDefault: theme.color.accent.default,
    colorAccentOnAccent: theme.color.accent.onAccent,
    colorIncomeDefault: theme.color.income.default,
    colorStatusSuccess: theme.color.status.success,
    colorStatusWarning: theme.color.status.warning,
    colorStatusDanger: theme.color.status.danger,
    colorHeroBgStart: theme.color.hero.bgStart,
    colorHeroBgEnd: theme.color.hero.bgEnd,
    colorHeroTopAccent: theme.color.hero.topAccent,
    colorHeroSparkline: theme.color.hero.sparkline,
    spaceXs: theme.space.xs,
    spaceSm: theme.space.sm,
    spaceMd: theme.space.md,
    spaceLg: theme.space.lg,
    spaceXl: theme.space.xl,
    space2xl: theme.space['2xl'],
    space3xl: theme.space['3xl'],
    space4xl: theme.space['4xl'],
    radiusSm: theme.radius.sm,
    radiusMd: theme.radius.md,
    radiusLg: theme.radius.lg,
    radiusPill: theme.radius.pill,
    fontFamilySans: theme.fontFamily.sans,
    fontSizeXs: theme.fontSize.xs,
    fontSizeSm: theme.fontSize.sm,
    fontSizeMd: theme.fontSize.md,
    fontSizeLg: theme.fontSize.lg,
    fontSizeXl: theme.fontSize.xl,
    fontSize2xl: theme.fontSize['2xl'],
    fontSize3xl: theme.fontSize['3xl'],
    fontWeightRegular: '400',
    fontWeightMedium: '500',
    fontWeightSemibold: '600',
    fontWeightBold: '700',
    lineHeightTight: theme.lineHeight.tight,
    lineHeightNormal: theme.lineHeight.normal,
    lineHeightLoose: theme.lineHeight.loose,
  };
}

import { darkTheme, lightTheme } from './tokens.js';

export const rnDarkTheme: RnTheme = themeToRn(darkTheme);
export const rnLightTheme: RnTheme = themeToRn(lightTheme);
