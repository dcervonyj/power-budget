export type GlassThemeName = 'dark' | 'light';

export interface GlassColors {
  readonly name: GlassThemeName;
  readonly base: string;
  readonly fg: string;
  readonly dim: string;
  readonly faint: string;
  readonly g0: string;
  readonly g1: string;
  readonly g2: string;
  readonly edge: string;
  readonly hl: string;
  readonly sep: string;
  readonly shadow: string;
  readonly shadowF: string;
  readonly track: string;
  readonly fill: string;
  readonly fill2: string;
  readonly far: string;
  readonly farEdge: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly accentTint: string;
  readonly accentEdge: string;
  readonly light: string;
  readonly lightH: string;
  readonly lightSolid: string;
  readonly lightEdge: string;
  readonly lightGlow: string;
  readonly meniscus: string;
  readonly spent: string;
  readonly glint: string;
  readonly glintRing: string;
  readonly lens: string;
  readonly lensRim: string;
  readonly spec: string;
  readonly sheen: string;
  readonly ok: string;
  readonly okTint: string;
  readonly over: string;
  readonly overTint: string;
  readonly overHatch: string;
  readonly b1: string;
  readonly b2: string;
  readonly b3: string;
  readonly glow: string;
  readonly beam: string;
  readonly scrim: string;
  readonly clear: string;
  readonly clearRim: string;
  readonly tint: string;
  readonly tintRim: string;
  readonly specular: string;
  readonly irid: string;
  readonly sweep: string;
  readonly tube: string;
  readonly tubeRim: string;
  readonly beamH: string;
  readonly beamV: string;
  readonly bloom: string;
  readonly bloomFar: string;
  readonly core: string;
  readonly caustic: string;
  readonly spark: string;
  readonly pace: string;
}

export interface GlassMotion {
  readonly rise: {
    readonly durationMs: 620;
    readonly easing: string;
    readonly staggerMs: 80;
    readonly fill: 'backwards';
  };
  readonly fill: { readonly durationMs: 700; readonly easing: string; readonly delayMs: 220 };
  readonly count: { readonly durationMs: 950; readonly easing: 'ease-out-cubic' };
  readonly press: { readonly durationMs: 220; readonly easing: 'ease' };
  readonly expand: { readonly durationMs: 320; readonly easing: string };
  readonly sheet: { readonly durationMs: 420; readonly easing: string };
  readonly sheen: { readonly durationMs: 700; readonly easing: string; readonly delayMs: 380 };
  readonly meniscusShimmer: { readonly durationMs: 6000; readonly easing: 'ease-in-out' };
  readonly ambientDrift: readonly [52000, 61000, 57000];
  readonly live: { readonly durationMs: 2400 };
  readonly sweep: {
    readonly durationMs: 12000;
    readonly passMs: 700;
    readonly easing: string;
    readonly delayMs: 1200;
    readonly staggerDelaysMs: readonly [0, 4000, 8000];
  };
  readonly film: {
    readonly durationMs: 14000;
    readonly easing: 'ease-in-out';
    readonly direction: 'alternate';
  };
  readonly flicker: { readonly durationMs: readonly [4200, 5000] };
  readonly travel: { readonly durationMs: 3400 };
  readonly twinkle: { readonly durationMs: readonly [2800, 3400] };
  readonly caustic: { readonly durationMs: 7000; readonly direction: 'alternate' };
  readonly bloom: { readonly durationMs: 4800; readonly direction: 'alternate' };
  readonly reveal: { readonly durationMs: 700; readonly easing: string };
  readonly glowin: { readonly durationMs: 700; readonly easing: string };
  readonly layeredPaneFloat: { readonly durationMs: 40000; readonly easing: 'ease-in-out' };
}

export interface GlassTheme {
  readonly name: GlassThemeName;
  readonly color: GlassColors;
  readonly motion: GlassMotion;
  readonly type: Record<
    | 'display'
    | 'hero'
    | 'figure'
    | 'amount'
    | 'title'
    | 'heading'
    | 'panelLabel'
    | 'label'
    | 'body'
    | 'small'
    | 'tag',
    { readonly web: number; readonly mobile: number; readonly weight?: number }
  >;
  readonly radius: Record<'panel' | 'mobilePanel' | 'tile' | 'chip' | 'control' | 'tag', number>;
  readonly space: Record<'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl', number>;
  readonly blur: { readonly web: 28; readonly rnIntensity: 28 | 24 };
}

const motion: GlassMotion = {
  rise: { durationMs: 620, easing: 'cubic-bezier(.2,.8,.2,1)', staggerMs: 80, fill: 'backwards' },
  fill: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)', delayMs: 220 },
  count: { durationMs: 950, easing: 'ease-out-cubic' },
  press: { durationMs: 220, easing: 'ease' },
  expand: { durationMs: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
  sheet: { durationMs: 420, easing: 'cubic-bezier(.2,.8,.2,1)' },
  sheen: { durationMs: 700, easing: 'cubic-bezier(.4,0,.2,1)', delayMs: 380 },
  meniscusShimmer: { durationMs: 6000, easing: 'ease-in-out' },
  ambientDrift: [52000, 61000, 57000],
  live: { durationMs: 2400 },
  sweep: {
    durationMs: 12000,
    passMs: 700,
    easing: 'cubic-bezier(.4,0,.2,1)',
    delayMs: 1200,
    staggerDelaysMs: [0, 4000, 8000],
  },
  film: { durationMs: 14000, easing: 'ease-in-out', direction: 'alternate' },
  flicker: { durationMs: [4200, 5000] },
  travel: { durationMs: 3400 },
  twinkle: { durationMs: [2800, 3400] },
  caustic: { durationMs: 7000, direction: 'alternate' },
  bloom: { durationMs: 4800, direction: 'alternate' },
  reveal: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)' },
  glowin: { durationMs: 700, easing: 'cubic-bezier(.22,.9,.3,1)' },
  layeredPaneFloat: { durationMs: 40000, easing: 'ease-in-out' },
};

const type: GlassTheme['type'] = {
  display: { web: 76, mobile: 62, weight: 300 },
  hero: { web: 64, mobile: 48, weight: 300 },
  figure: { web: 56, mobile: 40, weight: 300 },
  amount: { web: 24, mobile: 22 },
  title: { web: 32, mobile: 28 },
  heading: { web: 20, mobile: 18 },
  panelLabel: { web: 17, mobile: 16 },
  label: { web: 15, mobile: 15, weight: 600 },
  body: { web: 15, mobile: 15 },
  small: { web: 14, mobile: 14 },
  tag: { web: 13, mobile: 13, weight: 600 },
};
const radius: GlassTheme['radius'] = {
  panel: 28,
  mobilePanel: 24,
  tile: 20,
  chip: 18,
  control: 16,
  tag: 13,
};
const space: GlassTheme['space'] = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 32,
};

const lightColors: GlassColors = {
  name: 'light',
  base: '#EEF1F4',
  fg: '#0E1726',
  dim: '#3E4A60',
  faint: '#46526A',
  g0: 'rgba(255,255,255,0.74)',
  g1: 'rgba(255,255,255,0.60)',
  g2: 'rgba(255,255,255,0.50)',
  edge: 'rgba(255,255,255,0.80)',
  hl: 'rgba(255,255,255,0.95)',
  sep: 'rgba(14,23,38,0.08)',
  shadow: '0 1px 2px rgba(28,44,72,0.05),0 24px 48px -24px rgba(28,44,72,0.30)',
  shadowF: '0 1px 2px rgba(28,44,72,0.06),0 30px 60px -26px rgba(28,44,72,0.40)',
  track: 'rgba(14,23,38,0.08)',
  fill: 'rgba(14,23,38,0.045)',
  fill2: 'rgba(14,23,38,0.08)',
  far: 'rgba(255,255,255,0.28)',
  farEdge: 'rgba(255,255,255,0.65)',
  accent: '#7A4800',
  accentInk: '#1A1206',
  accentTint: 'rgba(242,177,62,0.16)',
  accentEdge: 'rgba(122,72,0,0.28)',
  light: 'linear-gradient(180deg,#FFEDB8 0%,#F7C860 45%,#EDA531 100%)',
  lightH: 'linear-gradient(180deg,#FFEDB8,#F5BE4E)',
  lightSolid: '#F2B13E',
  lightEdge: 'rgba(122,72,0,0.25)',
  lightGlow: '0 0 22px rgba(255,206,120,0.45)',
  meniscus: 'rgba(255,255,255,0.90)',
  spent: 'linear-gradient(180deg,#E3E9F0,#C6D0DC)',
  glint: '#FFFFFF',
  glintRing: '0 0 0 1.5px #0E1726,0 0 14px 3px rgba(255,255,255,0.9)',
  lens: 'radial-gradient(circle at 34% 26%,rgba(255,255,255,0.98),rgba(255,255,255,0.62) 46%,rgba(226,234,243,0.62) 100%)',
  lensRim:
    'inset 0 0 0 1px rgba(255,255,255,0.95),inset 0 -22px 44px rgba(90,110,140,0.16),inset 0 12px 26px rgba(255,255,255,0.85),0 34px 64px -30px rgba(28,44,72,0.5)',
  spec: '#FFFFFF',
  sheen: 'rgba(255,255,255,0.75)',
  ok: '#1D6A45',
  okTint: 'rgba(29,106,69,0.10)',
  over: '#A3261C',
  overTint: 'rgba(163,38,28,0.10)',
  overHatch:
    'repeating-linear-gradient(135deg,rgba(163,38,28,0.32) 0 3px,rgba(163,38,28,0) 3px 7px)',
  b1: 'rgba(255,222,160,0.80)',
  b2: 'rgba(170,205,240,0.65)',
  b3: 'rgba(228,216,198,0.65)',
  glow: 'rgba(255,206,120,0.38)',
  beam: 'rgba(255,255,255,0.55)',
  scrim: 'rgba(14,23,38,0.28)',
  clear: 'rgba(255,255,255,0.16)',
  clearRim:
    'inset 0 0 0 1px rgba(255,255,255,0.85),inset 0 0 0 3px rgba(255,255,255,0.22),inset 2px 3px 0 -1px #FFFFFF,inset -2px -3px 6px -2px rgba(90,110,140,0.22),0 18px 36px -24px rgba(28,44,72,0.28)',
  tint: 'rgba(226,236,248,0.62)',
  tintRim:
    'inset 0 0 0 1px rgba(255,255,255,0.85),inset 0 1px 0 #FFFFFF,0 1px 2px rgba(28,44,72,0.05),0 24px 48px -24px rgba(28,44,72,0.30)',
  specular: 'radial-gradient(120% 70% at 18% 0%,rgba(255,255,255,0.85),rgba(255,255,255,0) 60%)',
  irid: 'linear-gradient(115deg,rgba(255,255,255,0.95),rgba(150,190,255,0.55) 20%,rgba(255,160,210,0.45) 38%,rgba(255,255,255,0.35) 52%,rgba(140,235,200,0.50) 70%,rgba(255,220,150,0.55) 86%,rgba(255,255,255,0.95))',
  sweep: 'rgba(255,255,255,0.70)',
  tube: 'rgba(255,255,255,0.45)',
  tubeRim:
    'inset 0 0 0 1px rgba(14,23,38,0.14),inset 0 1px 0 #FFFFFF,inset 0 -2px 4px rgba(90,110,140,0.18)',
  beamH:
    'linear-gradient(180deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%,rgba(255,255,255,0) 92%),linear-gradient(90deg,rgba(240,160,40,0.30),rgba(245,178,64,0.80) 55%,rgba(255,206,120,0.95) 90%,rgba(255,206,120,0))',
  beamV:
    'linear-gradient(90deg,rgba(255,255,255,0) 8%,rgba(255,255,255,0.85) 50%,rgba(255,255,255,0) 92%),linear-gradient(0deg,rgba(240,160,40,0.30),rgba(245,178,64,0.80) 55%,rgba(255,206,120,0.95) 90%,rgba(255,206,120,0))',
  bloom: '0 0 8px 1px rgba(255,186,80,0.55),0 0 24px 6px rgba(255,200,110,0.35)',
  bloomFar: 'rgba(255,196,100,0.42)',
  core: 'radial-gradient(closest-side,rgba(255,250,232,1) 0%,rgba(255,196,90,0.95) 24%,rgba(240,160,40,0.60) 52%,rgba(240,160,40,0.20) 76%,rgba(240,160,40,0) 100%)',
  caustic: 'rgba(200,128,20,0.50)',
  spark: 'radial-gradient(circle,#FFFFFF 0 28%,rgba(255,214,140,0.85) 44%,rgba(255,214,140,0) 70%)',
  pace: '#0E1726',
};
const darkColors: GlassColors = {
  name: 'dark',
  base: '#05070D',
  fg: '#F4F6FA',
  dim: '#C9CFDB',
  faint: '#AEB6C6',
  g0: 'rgba(46,48,56,0.60)',
  g1: 'rgba(41,43,50,0.54)',
  g2: 'rgba(36,38,45,0.50)',
  edge: 'rgba(255,255,255,0.09)',
  hl: 'rgba(255,255,255,0.16)',
  sep: 'rgba(255,255,255,0.08)',
  shadow: '0 12px 32px rgba(0,0,0,0.36)',
  shadowF: '0 20px 44px rgba(0,0,0,0.50)',
  track: 'rgba(255,255,255,0.08)',
  fill: 'rgba(255,255,255,0.06)',
  fill2: 'rgba(255,255,255,0.11)',
  far: 'rgba(255,255,255,0.025)',
  farEdge: 'rgba(255,255,255,0.06)',
  accent: '#F5C46A',
  accentInk: '#1A1206',
  accentTint: 'rgba(245,196,106,0.12)',
  accentEdge: 'rgba(245,196,106,0.34)',
  light: 'linear-gradient(180deg,#FFE3A3 0%,#F5C062 45%,#E39A2E 100%)',
  lightH: 'linear-gradient(180deg,#FFE3A3,#EFAE45)',
  lightSolid: '#F2B44E',
  lightEdge: 'rgba(255,214,140,0.55)',
  lightGlow: '0 0 28px rgba(245,180,80,0.35)',
  meniscus: 'rgba(255,248,225,0.85)',
  spent: 'linear-gradient(180deg,#3A3E48,#2A2D35)',
  glint: '#F4F6FA',
  glintRing: '0 0 0 1.5px #05070D,0 0 12px 2px rgba(244,246,250,0.45)',
  lens: 'radial-gradient(circle at 34% 26%,rgba(255,255,255,0.16),rgba(255,255,255,0.05) 46%,rgba(255,255,255,0.03) 100%)',
  lensRim:
    'inset 0 0 0 1px rgba(255,255,255,0.14),inset 0 -22px 44px rgba(0,0,0,0.35),inset 0 12px 26px rgba(255,255,255,0.06),0 30px 60px -28px rgba(0,0,0,0.7)',
  spec: 'rgba(255,255,255,0.55)',
  sheen: 'rgba(255,255,255,0.08)',
  ok: '#8FE3BB',
  okTint: 'rgba(143,227,187,0.12)',
  over: '#FFAFA6',
  overTint: 'rgba(255,175,166,0.12)',
  overHatch:
    'repeating-linear-gradient(135deg,rgba(255,175,166,0.50) 0 3px,rgba(255,175,166,0) 3px 7px)',
  b1: 'rgba(70,86,180,0.30)',
  b2: 'rgba(32,128,140,0.22)',
  b3: 'rgba(116,70,140,0.16)',
  glow: 'rgba(232,160,64,0.20)',
  beam: 'rgba(255,255,255,0.03)',
  scrim: 'rgba(0,0,0,0.45)',
  clear: 'rgba(255,255,255,0.025)',
  clearRim:
    'inset 0 0 0 1px rgba(255,255,255,0.20),inset 0 0 0 3px rgba(255,255,255,0.035),inset 2px 3px 0 -1px rgba(255,255,255,0.38),inset -2px -3px 6px -2px rgba(0,0,0,0.55),0 18px 36px -22px rgba(0,0,0,0.6)',
  tint: 'rgba(28,38,60,0.56)',
  tintRim:
    'inset 0 0 0 1px rgba(160,190,255,0.14),inset 0 1px 0 rgba(255,255,255,0.18),0 12px 32px rgba(0,0,0,0.36)',
  specular: 'radial-gradient(120% 70% at 18% 0%,rgba(255,255,255,0.10),rgba(255,255,255,0) 60%)',
  irid: 'linear-gradient(115deg,rgba(255,255,255,0.30),rgba(150,190,255,0.24) 20%,rgba(255,160,210,0.18) 38%,rgba(255,255,255,0.05) 52%,rgba(140,235,200,0.18) 70%,rgba(255,214,140,0.22) 86%,rgba(255,255,255,0.30))',
  sweep: 'rgba(255,255,255,0.07)',
  tube: 'rgba(255,255,255,0.04)',
  tubeRim:
    'inset 0 0 0 1px rgba(255,255,255,0.16),inset 0 1px 0 rgba(255,255,255,0.28),inset 0 -2px 4px rgba(0,0,0,0.35)',
  beamH:
    'linear-gradient(180deg,rgba(255,255,255,0) 10%,rgba(255,250,235,0.90) 50%,rgba(255,255,255,0) 90%),linear-gradient(90deg,rgba(232,150,50,0.22),rgba(245,180,80,0.70) 55%,rgba(255,226,170,0.95) 90%,rgba(255,226,170,0))',
  beamV:
    'linear-gradient(90deg,rgba(255,255,255,0) 10%,rgba(255,250,235,0.90) 50%,rgba(255,255,255,0) 90%),linear-gradient(0deg,rgba(232,150,50,0.22),rgba(245,180,80,0.70) 55%,rgba(255,226,170,0.95) 90%,rgba(255,226,170,0))',
  bloom: '0 0 10px 1px rgba(255,200,110,0.55),0 0 28px 6px rgba(240,170,70,0.28)',
  bloomFar: 'rgba(240,170,70,0.26)',
  core: 'radial-gradient(closest-side,rgba(255,246,220,1) 0%,rgba(255,210,120,0.95) 22%,rgba(242,170,62,0.55) 50%,rgba(242,170,62,0.18) 75%,rgba(242,170,62,0) 100%)',
  caustic: 'rgba(255,220,150,0.55)',
  spark: 'radial-gradient(circle,#FFFFFF 0 28%,rgba(255,226,170,0.85) 44%,rgba(255,226,170,0) 70%)',
  pace: '#F4F6FA',
};

export const glassDarkTheme: GlassTheme = {
  name: 'dark',
  color: darkColors,
  motion,
  type,
  radius,
  space,
  blur: { web: 28, rnIntensity: 28 },
};
export const glassLightTheme: GlassTheme = {
  name: 'light',
  color: lightColors,
  motion,
  type,
  radius,
  space,
  blur: { web: 28, rnIntensity: 24 },
};
