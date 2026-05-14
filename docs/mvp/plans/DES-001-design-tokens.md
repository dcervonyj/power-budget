# DES-001 — Design tokens: CSS variables + RN style tokens (Implementation Plan)

## 1. Task summary

- **ID**: DES-001
- **Title**: Design tokens — CSS variables + RN style tokens
- **Area**: Design
- **Effort**: M (~2d)

**Context.** DES-001 is one of only two true Wave-1 tasks in the BACKLOG (the other is `INF-001` — repo creation). It can begin in parallel to all monorepo scaffolding. It is the **upstream dependency of every styled component and screen**: it blocks `DES-002` (component library), `DES-007` (illustration kit), `WEB-005` (Auth screens), `MOB-005` (Auth screens, mobile) and transitively every other UI task in the BACKLOG.

The tokens themselves are pure data — colours, spacing scale, type ramp, radii — so they fit cleanly inside `@power-budget/core` per ARCHITECTURE.md §4 ("Pure TypeScript … no DOM types, no React Native types … Compiles with `tsc` to ESM; no bundler"). The "single source of truth" requirement aligns with the same §4 reasoning for why `core` exists at all (vs. a `shared/` folder): an enforceable workspace package with empty runtime `dependencies: {}`. The dependency rule from §3 ("Domain ← Application ← Infrastructure / Presentation") is preserved because the tokens module is pure data with no I/O.

The acceptance criteria in BACKLOG.md §4.5 are: (a) one canonical source, web + RN exports derived; (b) both dark and light themes fully implemented in MVP; (c) token names align between web and RN.

> **Design update (post-prototype):** The chosen palette is **Arctic Blue** (selected from `docs/mvp/design-arctic/`), replacing the earlier indigo draft. The exact color literals are defined in §4.2 below. Both dark and light themes are first-class MVP deliverables — the light theme is not a stub.

## 2. Scope

**In scope**

- A **shared design-token module** consumable by both `packages/web` and `packages/mobile`.
- **CSS custom properties** for the web (`:root { --pb-color-surface-base: …; }`).
- **Equivalent JS/TS token object** for React Native (RN does not support CSS variables natively, so a literal object is required).
- A **single canonical TypeScript source** (`tokens.ts`) plus an optional generator script that emits the `.css` file deterministically, so the two stay in lock-step.
- **Both dark and light themes** fully implemented — dark is the default; light is a complete, equal-status MVP feature.
- A **token-preview page / story** showing every swatch, spacing step, type sample, radius and (token-driven) elevation — rendered in both themes.
- A simple **lint rule** that forbids raw hex colours outside `tokens.ts` (placeholder ESLint config wired up so `INF-003` can lift it).
- A `README.md` inside the package directory describing token names + how to add a new one.

**Out of scope**

- Component implementations (`DES-002` and onwards).
- Screen layouts (every `WEB-*` / `MOB-*` task).
- Brand assets beyond palette / typography / spacing / radii (logos, illustrations live in `DES-007`).
- Runtime theme-toggle UX (toggle button, `localStorage` persistence, no-FOUC script) — that is `DES-008`.
- Iconography (covered by `DES-006`).
- ESLint per-package wiring is `INF-003`'s job; DES-001 only ships the **rule definition and an integration-test fixture**.

## 3. Files to create / modify

The plan assumes `INF-002` (monorepo scaffold) has NOT yet landed — DES-001 must run on Wave 1 in parallel. To unblock that, the canonical source ships as a **stand-alone source file that will be moved into the monorepo by INF-002**. Concretely:

**Pre-monorepo location (Wave 1 reality):**

```
docs/mvp/plans/DES-001-design-tokens.md     # this file
packages/design-tokens/                      # provisional location, see §8
├── src/
│   ├── tokens.ts                            # CANONICAL TS source (typed)
│   ├── themes.ts                            # darkTheme + lightTheme (both full)
│   ├── css.ts                               # generator: tokens → ":root { --pb-… }"
│   ├── rn.ts                                # generator: tokens → RN-shaped object
│   ├── preview.html                         # static swatch/scale preview page
│   └── index.ts                             # barrel
├── tests/
│   ├── tokens.snapshot.test.ts              # snapshot of full token tree
│   ├── css-output.test.ts                   # asserts generated CSS matches
│   └── rn-output.test.ts                    # asserts RN object structure
├── eslint-rules/
│   └── no-hex-outside-tokens.js             # custom rule + fixture
├── package.json                             # name: @power-budget/design-tokens
├── tsconfig.json
└── README.md
```

**Once INF-002 + INF-003 land, these wire-in files are created/edited:**

```
packages/web/src/styles/tokens.css           # generated; imported by main.tsx
packages/web/src/styles/index.css            # @import "./tokens.css" first
packages/web/src/main.tsx                    # import "./styles/index.css"
packages/mobile/src/styles/tokens.ts         # generated; imported by App.tsx
packages/mobile/src/App.tsx                  # wraps root view in ThemeProvider
packages/mobile/src/presentation/ThemeProvider.tsx   # context-based RN theme
.eslintrc.cjs (root)                         # enables no-hex-outside-tokens
```

The **generator step** (`pnpm --filter @power-budget/design-tokens build`) writes the two derived files into `packages/web/src/styles/` and `packages/mobile/src/styles/` so neither consumer ever hand-writes tokens.

## 4. Key interfaces & contracts

### 4.1 Canonical TS shape (`tokens.ts`)

```ts
// All numeric values are unitless; CSS generator appends "px"; RN consumes raw numbers.
export type ColorToken = string; // hex, e.g. "#0E1116"
export type SpaceToken = 4 | 8 | 12 | 16 | 24 | 32 | 48 | 64;
export type RadiusToken = 6 | 10 | 16 | 999;
export type FontSizeToken = 12 | 14 | 16 | 18 | 22 | 28 | 36;

export interface ColorPalette {
  readonly surface: {
    readonly base: ColorToken;    // dark: #07080e  | light: #edf1f7 — app background
    readonly raised: ColorToken;  // dark: #0c0d16  | light: #ffffff — cards
    readonly mid: ColorToken;     // dark: #12131e  | light: #f4f6fa — inputs / hover
    readonly overlay: ColorToken; // dark: #181928  | light: #e8ecf2 — modals / popovers
  };
  readonly border: {
    readonly subtle: ColorToken;  // dark: rgba(255,255,255,0.065) | light: rgba(0,0,0,0.07)
    readonly strong: ColorToken;  // dark: rgba(255,255,255,0.12)  | light: rgba(0,0,0,0.12)
  };
  readonly text: {
    readonly primary: ColorToken; // dark: #e6e0d8   | light: #18202e
    readonly secondary: ColorToken; // dark: rgba(230,224,216,0.52) | light: rgba(24,32,46,0.55)
    readonly muted: ColorToken;   // dark: rgba(230,224,216,0.28) | light: rgba(24,32,46,0.38)
  };
  readonly accent: {
    readonly default: ColorToken; // dark: #4ab8e8 (arctic blue)  | light: #2898d8 (deep arctic)
    readonly onAccent: ColorToken; // resolved at theme level
  };
  readonly income: {
    readonly default: ColorToken; // dark: #8898c8 (periwinkle)   | light: #4868b8 (deep periwinkle)
  };
  readonly status: {
    readonly success: ColorToken; // dark: #4aa870 | light: #2a8c58
    readonly warning: ColorToken; // dark: #c98c38 | light: #b07020
    readonly danger: ColorToken;  // dark: #c04848 | light: #b83030
  };
  readonly hero: {
    readonly bgStart: ColorToken; // dark: #101e30  | light: #1870b8
    readonly bgEnd: ColorToken;   // dark: #07080e  | light: #3ab0e8
    readonly topAccent: ColorToken; // dark: #4ab8e8 | light: transparent
    readonly sparkline: ColorToken; // dark: rgba(74,184,232,0.7) | light: rgba(255,255,255,0.75)
  };
}

export interface Theme {
  readonly name: "dark" | "light";
  readonly color: ColorPalette;
  readonly space: Readonly<
    Record<"xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl", SpaceToken>
  >;
  readonly radius: Readonly<Record<"sm" | "md" | "lg" | "pill", RadiusToken>>;
  readonly fontFamily: {
    readonly sans: string; // "Inter, system-ui, …"
  };
  readonly fontSize: Readonly<
    Record<"xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl", FontSizeToken>
  >;
  readonly fontWeight: Readonly<
    Record<"regular" | "medium" | "semibold" | "bold", 400 | 500 | 600 | 700>
  >;
  readonly lineHeight: Readonly<Record<"tight" | "normal" | "loose", number>>;
}
```

### 4.2 CSS variable naming convention

- **Prefix**: `--pb-` (Power Budget; protects against collision with libraries that use `--color-*`, `--space-*`).
- **Pattern**: `--pb-<group>-<sub>-<variant>` — kebab-cased.
- Examples:
  - `--pb-color-surface-base`, `--pb-color-text-primary`, `--pb-color-accent-default`
  - `--pb-space-md`, `--pb-space-2xl`
  - `--pb-radius-pill`
  - `--pb-font-size-lg`, `--pb-font-weight-semibold`
  - `--pb-font-family-sans`

The generator emits a `:root { … }` block for the dark theme (default) and a `[data-theme="light"] { … }` override block for the light theme. The `[data-theme="dark"]` alias is also emitted so explicit dark-mode assignment works.

### 4.3 RN equivalent object (`tokens.ts` export to `packages/mobile`)

```ts
export const rnDarkTheme = {
  color: {
    surfaceBase: "#07080e",
    surfaceRaised: "#0c0d16",
    surfaceMid: "#12131e",
    surfaceOverlay: "#181928",
    borderSubtle: "rgba(255,255,255,0.065)",
    borderStrong: "rgba(255,255,255,0.12)",
    textPrimary: "#e6e0d8",
    textSecondary: "rgba(230,224,216,0.52)",
    textMuted: "rgba(230,224,216,0.28)",
    accentDefault: "#4ab8e8",      // arctic blue
    incomeDefault: "#8898c8",      // periwinkle
    statusSuccess: "#4aa870",
    statusWarning: "#c98c38",
    statusDanger: "#c04848",
  },
  /* … space, radius, fontSize same as darkTheme */
} as const;

export const rnLightTheme = {
  color: {
    surfaceBase: "#edf1f7",
    surfaceRaised: "#ffffff",
    surfaceMid: "#f4f6fa",
    surfaceOverlay: "#e8ecf2",
    borderSubtle: "rgba(0,0,0,0.07)",
    borderStrong: "rgba(0,0,0,0.12)",
    textPrimary: "#18202e",
    textSecondary: "rgba(24,32,46,0.55)",
    textMuted: "rgba(24,32,46,0.38)",
    accentDefault: "#2898d8",      // deep arctic
    incomeDefault: "#4868b8",      // deep periwinkle
    statusSuccess: "#2a8c58",
    statusWarning: "#b07020",
    statusDanger: "#b83030",
  },
  /* … space, radius, fontSize identical to darkTheme */
} as const;

export type RnTheme = typeof rnDarkTheme; // both themes satisfy this type
```

Space, radius, and fontSize are **theme-invariant** — same values in both objects; the generator asserts this. Only color tokens differ between themes.

## 5. Step-by-step build order

Each micro-step is ≤30 minutes.

1. **(Pre-step)** Create `packages/design-tokens/` directory, `package.json` (`name: @power-budget/design-tokens`, `dependencies: {}`, `peerDependencies: {}`), `tsconfig.json` extending the root once available (placeholder strict TS config until then).
2. **Define `themes.ts`** — encode **both** the dark and light Arctic Blue palettes. Dark: surfaces `#07080e / #0c0d16 / #12131e / #181928`, accent `#4ab8e8`, income `#8898c8`, text `#e6e0d8`, success `#4aa870`, warn `#c98c38`, danger `#c04848`. Light: surfaces `#edf1f7 / #ffffff / #f4f6fa / #e8ecf2`, accent `#2898d8`, income `#4868b8`, text `#18202e`, success `#2a8c58`, warn `#b07020`, danger `#b83030`. Hero card tokens for both themes (see §4.1 above).
3. **Define spacing scale** — `xs:4 sm:8 md:12 lg:16 xl:24 2xl:32 3xl:48 4xl:64` and **freeze** with `as const`.
4. **Define radii** — `sm:6 md:10 lg:16 pill:999`.
5. **Define typography** — `fontFamily.sans = "Inter, -apple-system, system-ui, Segoe UI, Roboto, sans-serif"`; `fontSize` ramp `12 14 16 18 22 28 36`; `fontWeight` `400 500 600 700`; `lineHeight` `1.2 / 1.4 / 1.6`.
6. **Write `tokens.ts` barrel** — exports both `darkTheme: Theme` and `lightTheme: Theme` (both are complete, real objects — no stubs or placeholders).
7. **Write `css.ts` generator** — pure function `themesToCss(dark: Theme, light: Theme): string` that emits `:root, [data-theme="dark"] { … }` followed by `[data-theme="light"] { … }`, alphabetically sorted for stable diffs.
8. **Write `rn.ts` generator** — pure function `themeToRn(theme: Theme): RnTheme` that flattens the nested object into the camelCase shape. Exported as `rnDarkTheme` and `rnLightTheme`.
9. **Write `index.ts`** — barrel exporting `darkTheme`, `lightTheme`, `themesToCss`, `themeToRn`, `rnDarkTheme`, `rnLightTheme`.
10. **Add Vitest snapshot tests** for both `darkTheme` and `lightTheme` — captures the full literal tree so accidental drift is flagged in PR review.
11. **Add Vitest test for `themesToCss`** — assert generated string contains every expected `--pb-…` variable in both `:root` and `[data-theme="light"]` blocks; matches committed snapshots `__snapshots__/dark.css.snap` and `__snapshots__/light.css.snap`.
12. **Add Vitest test for `themeToRn`** — assert object structure for both `rnDarkTheme` and `rnLightTheme`, and that every CSS variable has a matching RN key (mapping completeness invariant).
13. **Write custom ESLint rule `no-hex-outside-tokens`** — flags `/#[0-9a-fA-F]{3,8}\b/` anywhere outside `tokens.ts`, `themes.ts` and `__snapshots__/`. Ship with a unit test fixture (good file + bad file).
14. **Add a generator CLI** (`bin/generate.mjs`) — invoked by `pnpm --filter @power-budget/design-tokens build` — that writes `dist/tokens.css` and `dist/rn-tokens.ts`. Stamps a `// AUTOGENERATED — DO NOT EDIT — source: packages/design-tokens/src/tokens.ts` header.
15. **Write the static `preview.html` page** — a self-contained HTML file (no React) that links the generated `tokens.css` and renders: swatch grid for every colour token in **both themes** (togglable); bar chart for spacing scale; ramp for type sizes; sample buttons for radii. Doubles as visual QA before Storybook arrives in `DES-002`.
16. **Write `README.md`** — overview of token names, naming convention, how to add a new token, generator command, lint-rule behaviour.
17. **(After `INF-002`)** Wire `@power-budget/design-tokens` as a workspace dependency of `packages/web` and `packages/mobile` (each as a `dependencies` entry).
18. **(After `INF-002`)** In `packages/web/src/styles/index.css` add `@import "@power-budget/design-tokens/dist/tokens.css";` and import that in `main.tsx`.
19. **(After `INF-002`)** In `packages/mobile/src/styles/tokens.ts` re-export `rnDarkTheme` and `rnLightTheme` from the package; create `packages/mobile/src/presentation/ThemeProvider.tsx` that exposes the active `RnTheme` via `React.Context` (mobile equivalent of CSS variables). The active theme is selected by the provider from `rnDarkTheme` / `rnLightTheme`; switching is handled by `DES-008`.
20. **(After `INF-003`)** Lift the local ESLint rule into the root config (`.eslintrc.cjs`) so the project-wide pass enforces no inline hex.

## 6. Test plan

### 6.1 Unit tests (Vitest)

| Test                                       | Asserts                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `tokens.snapshot.test.ts`                  | Both `darkTheme` and `lightTheme` objects match their committed snapshots — drift is a deliberate change.         |
| `css-output.test.ts`                       | `themesToCss(dark, light)` matches snapshots; `:root` block present for dark; `[data-theme="light"]` for light.   |
| `rn-output.test.ts`                        | `rnDarkTheme` and `rnLightTheme` keys are 1:1 superset of CSS variables (mapping-completeness invariant).         |
| `eslint-rule.test.ts`                      | The `no-hex-outside-tokens` rule flags `color: '#123456'` in a fixture and passes on `tokens.ts` exemption.      |
| `theme-shape.test.ts` (compile-time check) | Importing both themes and asserting `: Theme` at the type level — fails to compile if the shape drifts.          |

### 6.2 Visual verification

- The `preview.html` page is opened in a browser; reviewer eyeballs every swatch, every spacing step, every type ramp in **both dark and light themes** and signs off.
- A screenshot of `preview.html` in both themes is attached to the PR for the user's visual review.

### 6.3 Integration smoke (gated on `INF-002` landing)

- `packages/web` builds and serves a minimal page using `var(--pb-color-text-primary)` and renders the expected hex in DevTools for both dark and light themes.
- `packages/mobile` renders a single `<Text>` with `useTheme().color.textPrimary`; switching the `ThemeProvider` from dark to light updates the value from `#e6e0d8` to `#18202e`.

## 7. Acceptance criteria

Refining BACKLOG.md §4.5 DES-001:

- [ ] **Single canonical source.** `packages/design-tokens/src/tokens.ts` is the only file containing raw hex colours; both web CSS and RN objects are generated from it.
- [ ] **Web export.** `dist/tokens.css` defines every `--pb-…` variable in `:root, [data-theme="dark"]` and overrides it in `[data-theme="light"]`; `packages/web` imports it from `main.tsx` and both sets of variables are resolvable via DevTools.
- [ ] **Mobile export.** `dist/rn-tokens.ts` exports typed `rnDarkTheme` and `rnLightTheme`; `packages/mobile` consumes the active theme through a `ThemeProvider` context wrapper at the root.
- [ ] **Names align.** Every CSS variable has a deterministically named RN counterpart (covered by `rn-output.test.ts`'s mapping completeness assertion).
- [ ] **Both themes implemented.** `darkTheme` and `lightTheme` are both complete, real objects — no stubs or placeholders. The Arctic Blue palette (§4.1) is the exact source.
- [ ] **Lint rule.** `no-hex-outside-tokens` rule exists, has unit tests, and is wired into the root `.eslintrc.cjs` once `INF-003` lands; running `pnpm lint` after `INF-003` reports zero violations.
- [ ] **Preview page.** `preview.html` renders every token in both themes (toggleable) and is screenshotted in the PR description.
- [ ] **Generator is deterministic.** Re-running `pnpm --filter @power-budget/design-tokens build` produces byte-identical outputs (CI safe).
- [ ] **No I/O in `tokens.ts` / `themes.ts`.** They contain only literals + types — satisfies the ARCHITECTURE.md §3 "domain layer" discipline if/when these are merged into `@power-budget/core`.

## 8. Open questions / decisions

1. **Where do tokens live: in `@power-budget/core` or a separate `@power-budget/design-tokens` package?**
   _Recommendation:_ separate package (`@power-budget/design-tokens`).
   - **Pro `core`**: zero new packages, fewer `package.json`s, SSOT in the canonical shared place.
   - **Pro separate package**: (a) `core` is consumed by `packages/backend`, which never needs tokens — keeping them out keeps the backend bundle smaller; (b) the generator script and a `bin/` entry feel out of place next to pure domain logic; (c) a dedicated package lets us add a `peerDependency: "react"` for a future `useTheme()` hook without leaking that into `core`; (d) the BACKLOG description ("Extract design tokens … from `docs/mvp/design/`") implies a self-contained module. ARCHITECTURE.md §4 mentions a potential `packages/ui-kit` for shared UI primitives — design-tokens is the natural sibling.
2. **Naming prefix `--pb-`.** Confirmed in §4.2. Open: is `pb` legible enough, or should we use `--power-budget-…` for grep-ability? Recommendation: keep `--pb-` (shorter ⇒ less line-noise; `power-budget` is verbose); enforce via lint that no other prefix is introduced.
3. **Strictness of `no-hex-outside-tokens`.** Should the rule flag hex in **tests**? Recommendation: allowlist `**/*.snap`, `**/__snapshots__/**`, `tokens.ts`, `themes.ts`. Everything else (including test fixtures) must use token variables, since fixtures often turn into real components.
4. **Font loading.** Inter is referenced in `fontFamily.sans`. Do we self-host (web manifest + RN font asset) or rely on system fallback in MVP? Recommendation: ship the font file in `DES-002` (component scaffold), not here — DES-001 only declares the family.
5. ~~**`themes.light` stub shape.**~~ **Resolved.** Both themes are full MVP. The Arctic Blue light palette (`#edf1f7` bg, `#2898d8` accent, `#18202e` text) is specified in §4.1 and §4.3 above. No stub needed.
6. ~~**Prototype-driven refinement.**~~ **Resolved.** The approved prototype is `docs/mvp/design-arctic/` (Arctic Blue design, option 22). Token literals in this plan are taken directly from `design-arctic/styles.css` and are final for MVP. Minor tweaks still go through the single `themes.ts` file.

## 9. Risks

| Risk                                                                                                                | Likelihood | Impact | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Token values drift from `design-arctic/` source                                                                     | Low        | Medium | Palette is now final (option 22 approved). Snapshot tests fail on any drift. `themes.ts` is the only allowed edit point. |
| CSS-variable / RN-object drift over time (one updated, the other not)                                               | Medium     | High   | Single canonical TS file + generator script; the `rn-output.test.ts` mapping-completeness test fails CI on any drift.    |
| `no-hex-outside-tokens` lint rule too noisy / lands before INF-003, blocking other work                             | Low        | Low    | DES-001 ships the rule **disabled by default**; INF-003 turns it on once the codebase is hex-free. Allowlist in §8 (#3). |
