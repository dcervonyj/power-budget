// tokens.ts — canonical design token source for Power Budget
// DO NOT add runtime dependencies; this file must stay pure TS.

export type ColorToken = string;
export type SpaceToken = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64;
export type RadiusToken = 6 | 10 | 16 | 999;
export type FontSizeToken = 12 | 14 | 16 | 18 | 22 | 28 | 36;

export interface ColorPalette {
  readonly surface: {
    readonly base: ColorToken;
    readonly raised: ColorToken;
    readonly mid: ColorToken;
    readonly overlay: ColorToken;
  };
  readonly border: {
    readonly subtle: ColorToken;
    readonly strong: ColorToken;
  };
  readonly text: {
    readonly primary: ColorToken;
    readonly secondary: ColorToken;
    readonly muted: ColorToken;
  };
  readonly accent: {
    readonly default: ColorToken;
    readonly onAccent: ColorToken;
  };
  readonly income: {
    readonly default: ColorToken;
  };
  readonly status: {
    readonly success: ColorToken;
    readonly warning: ColorToken;
    readonly danger: ColorToken;
  };
  readonly hero: {
    readonly bgStart: ColorToken;
    readonly bgEnd: ColorToken;
    readonly topAccent: ColorToken;
    readonly sparkline: ColorToken;
  };
}

export interface Theme {
  readonly name: 'dark' | 'light';
  readonly color: ColorPalette;
  readonly space: Readonly<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl', SpaceToken>>;
  readonly radius: Readonly<Record<'sm' | 'md' | 'lg' | 'pill', RadiusToken>>;
  readonly fontFamily: {
    readonly sans: string;
  };
  readonly fontSize: Readonly<Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', FontSizeToken>>;
  readonly fontWeight: Readonly<Record<'regular' | 'medium' | 'semibold' | 'bold', 400 | 500 | 600 | 700>>;
  readonly lineHeight: Readonly<Record<'tight' | 'normal' | 'loose', number>>;
}

// Shared invariant tokens (same for both themes)
const space: Theme['space'] = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, '2xl': 32, '3xl': 48, '4xl': 64,
} as const;

const radius: Theme['radius'] = {
  sm: 6, md: 10, lg: 16, pill: 999,
} as const;

const fontFamily: Theme['fontFamily'] = {
  sans: 'Inter, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif',
} as const;

const fontSize: Theme['fontSize'] = {
  xs: 12, sm: 14, md: 16, lg: 18, xl: 22, '2xl': 28, '3xl': 36,
} as const;

const fontWeight: Theme['fontWeight'] = {
  regular: 400, medium: 500, semibold: 600, bold: 700,
} as const;

const lineHeight: Theme['lineHeight'] = {
  tight: 1.2, normal: 1.4, loose: 1.6,
} as const;

export const darkTheme: Theme = {
  name: 'dark',
  color: {
    surface: {
      base: '#07080e',
      raised: '#0c0d16',
      mid: '#12131e',
      overlay: '#181928',
    },
    border: {
      subtle: 'rgba(255,255,255,0.065)',
      strong: 'rgba(255,255,255,0.12)',
    },
    text: {
      primary: '#e6e0d8',
      secondary: 'rgba(230,224,216,0.52)',
      muted: 'rgba(230,224,216,0.28)',
    },
    accent: {
      default: '#4ab8e8',
      onAccent: '#07080e',
    },
    income: {
      default: '#8898c8',
    },
    status: {
      success: '#4aa870',
      warning: '#c98c38',
      danger: '#c04848',
    },
    hero: {
      bgStart: '#101e30',
      bgEnd: '#07080e',
      topAccent: '#4ab8e8',
      sparkline: 'rgba(74,184,232,0.7)',
    },
  },
  space,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} as const;

export const lightTheme: Theme = {
  name: 'light',
  color: {
    surface: {
      base: '#edf1f7',
      raised: '#ffffff',
      mid: '#f4f6fa',
      overlay: '#e8ecf2',
    },
    border: {
      subtle: 'rgba(0,0,0,0.07)',
      strong: 'rgba(0,0,0,0.12)',
    },
    text: {
      primary: '#18202e',
      secondary: 'rgba(24,32,46,0.55)',
      muted: 'rgba(24,32,46,0.38)',
    },
    accent: {
      default: '#2898d8',
      onAccent: '#ffffff',
    },
    income: {
      default: '#4868b8',
    },
    status: {
      success: '#2a8c58',
      warning: '#b07020',
      danger: '#b83030',
    },
    hero: {
      bgStart: '#1870b8',
      bgEnd: '#3ab0e8',
      topAccent: 'transparent',
      sparkline: 'rgba(255,255,255,0.75)',
    },
  },
  space,
  radius,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
} as const;
