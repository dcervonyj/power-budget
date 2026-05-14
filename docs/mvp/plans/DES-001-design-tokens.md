# DES-001 — Design tokens: CSS variables + RN style tokens (Implementation Plan)

## 1. Task summary

- **ID**: DES-001
- **Title**: Design tokens — CSS variables + RN style tokens
- **Area**: Design
- **Effort**: M (~2d)

**Context.** DES-001 is one of only two true Wave-1 tasks in the BACKLOG (the other is `INF-001` — repo creation). It can begin in parallel to all monorepo scaffolding. It is the **upstream dependency of every styled component and screen**: it blocks `DES-002` (component library), `DES-007` (illustration kit), `WEB-005` (Auth screens), `MOB-005` (Auth screens, mobile) and transitively every other UI task in the BACKLOG.

The tokens themselves are pure data — colours, spacing scale, type ramp, radii — so they fit cleanly inside `@power-budget/core` per ARCHITECTURE.md §4 ("Pure TypeScript … no DOM types, no React Native types … Compiles with `tsc` to ESM; no bundler"). The "single source of truth" requirement aligns with the same §4 reasoning for why `core` exists at all (vs. a `shared/` folder): an enforceable workspace package with empty runtime `dependencies: {}`. The dependency rule from §3 ("Domain ← Application ← Infrastructure / Presentation") is preserved because the tokens module is pure data with no I/O.

The acceptance criteria in BACKLOG.md §4.5 are: (a) one canonical source, web + RN exports derived; (b) light + dark variants exposed (dark only in MVP); (c) token names align between web and RN.

## 2. Scope

**In scope**

- A **shared design-token module** consumable by both `packages/web` and `packages/mobile`.
- **CSS custom properties** for the web (`:root { --pb-color-surface-base: …; }`).
- **Equivalent JS/TS token object** for React Native (RN does not support CSS variables natively, so a literal object is required).
- A **single canonical TypeScript source** (`tokens.ts`) plus an optional generator script that emits the `.css` file deterministically, so the two stay in lock-step.
- **Dark-theme palette only** (PRD §1 NFR, BACKLOG.md DES-001 acceptance #2: "dark optional in MVP" — we ship dark, scaffold for light).
- A **token-preview page / story** showing every swatch, spacing step, type sample, radius and (token-driven) elevation.
- A simple **lint rule** that forbids raw hex colours outside `tokens.ts` (placeholder ESLint config wired up so `INF-003` can lift it).
- A `README.md` inside the package directory describing token names + how to add a new one.

**Out of scope**

- Component implementations (`DES-002` and onwards).
- Screen layouts (every `WEB-*` / `MOB-*` task).
- Brand assets beyond palette / typography / spacing / radii (logos, illustrations live in `DES-007`).
- Light-mode toggling and runtime theme switching — MVP is dark-only; the module exposes a `themes.dark` shape that leaves room for `themes.light` without code change.
- iconography (covered by `DES-006`).
- ESLint per-package wiring is `INF-003`'s job; DES-001 only ships the **rule definition and an integration-test fixture**.

## 3. Files to create / modify

The plan assumes `INF-002` (monorepo scaffold) has NOT yet landed — DES-001 must run on Wave 1 in parallel. To unblock that, the canonical source ships as a **stand-alone source file that will be moved into the monorepo by INF-002**. Concretely:

**Pre-monorepo location (Wave 1 reality):**

```
docs/mvp/plans/DES-001-design-tokens.md     # this file
packages/design-tokens/                      # provisional location, see §8
├── src/
│   ├── tokens.ts                            # CANONICAL TS source (typed)
│   ├── themes.ts                            # themes.dark (+ themes.light stub)
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
    readonly base: ColorToken; // #0E1116 — app background
    readonly raised: ColorToken; // #171B22 — cards
    readonly overlay: ColorToken; // #1F2530 — modals / popovers
  };
  readonly border: {
    readonly subtle: ColorToken; // #252A33
  };
  readonly text: {
    readonly primary: ColorToken; // #E8ECF1
    readonly secondary: ColorToken; // #9CA3B0
    readonly muted: ColorToken; // #6B7280
  };
  readonly accent: {
    readonly default: ColorToken; // #7C84F5 — indigo, primary action
    readonly onAccent: ColorToken; // resolved at theme level
  };
  readonly status: {
    readonly success: ColorToken; // #34D399
    readonly warning: ColorToken; // #FBBF24
    readonly danger: ColorToken; // #F87171
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

The generator emits a single `:root { … }` block in the dark theme by default. A future light theme attaches under `[data-theme="light"]`.

### 4.3 RN equivalent object (`tokens.ts` export to `packages/mobile`)

```ts
export const rnTheme = {
  color: {
    surfaceBase: "#0E1116",
    surfaceRaised: "#171B22",
    surfaceOverlay: "#1F2530",
    borderSubtle: "#252A33",
    textPrimary: "#E8ECF1",
    /* … */
  },
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    "2xl": 32,
    "3xl": 48,
    "4xl": 64,
  },
  radius: { sm: 6, md: 10, lg: 16, pill: 999 },
  fontSize: { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, "2xl": 28, "3xl": 36 },
  /* … */
} as const;
export type RnTheme = typeof rnTheme;
```

Names are **camelCase** for RN (idiomatic JS) but map 1:1 to the kebab-cased CSS variables — the generator owns the conversion so a single rename in `tokens.ts` propagates to both consumers.

## 5. Step-by-step build order

Each micro-step is ≤30 minutes.

1. **(Pre-step)** Create `packages/design-tokens/` directory, `package.json` (`name: @power-budget/design-tokens`, `dependencies: {}`, `peerDependencies: {}`), `tsconfig.json` extending the root once available (placeholder strict TS config until then).
2. **Define `themes.ts`** — encode the dark palette literals from the brief: surfaces `#0E1116 / #171B22 / #1F2530`, border `#252A33`, text `#E8ECF1 / #9CA3B0 / #6B7280`, accent `#7C84F5`, success `#34D399`, warn `#FBBF24`, danger `#F87171`.
3. **Define spacing scale** — `xs:4 sm:8 md:12 lg:16 xl:24 2xl:32 3xl:48 4xl:64` and **freeze** with `as const`.
4. **Define radii** — `sm:6 md:10 lg:16 pill:999`.
5. **Define typography** — `fontFamily.sans = "Inter, -apple-system, system-ui, Segoe UI, Roboto, sans-serif"`; `fontSize` ramp `12 14 16 18 22 28 36`; `fontWeight` `400 500 600 700`; `lineHeight` `1.2 / 1.4 / 1.6`.
6. **Write `tokens.ts` barrel** — exports `darkTheme: Theme`, plus a typed `lightTheme` placeholder (`null` cast is forbidden; we throw `notYetImplemented` from a stub builder so the slot exists structurally).
7. **Write `css.ts` generator** — pure function `themeToCss(theme: Theme): string` that walks the object and emits the `:root` block, alphabetically sorted for stable diffs.
8. **Write `rn.ts` generator** — pure function `themeToRn(theme: Theme): RnTheme` that flattens the nested object into the camelCase shape above.
9. **Write `index.ts`** — barrel exporting `darkTheme`, `themeToCss`, `themeToRn`.
10. **Add Vitest snapshot test** for `darkTheme` — captures the full literal tree so accidental drift is flagged in PR review.
11. **Add Vitest test for `themeToCss`** — assert generated string contains every expected `--pb-…` variable and matches a committed snapshot file `__snapshots__/dark.css.snap`.
12. **Add Vitest test for `themeToRn`** — assert object structure and that every CSS variable has a matching RN key (mapping completeness test prevents drift between the two outputs).
13. **Write custom ESLint rule `no-hex-outside-tokens`** — flags `/#[0-9a-fA-F]{3,8}\b/` anywhere outside `tokens.ts`, `themes.ts` and `__snapshots__/`. Ship with a unit test fixture (good file + bad file).
14. **Add a generator CLI** (`bin/generate.mjs`) — invoked by `pnpm --filter @power-budget/design-tokens build` — that writes `dist/tokens.css` and `dist/rn-tokens.ts`. Stamps a `// AUTOGENERATED — DO NOT EDIT — source: packages/design-tokens/src/tokens.ts` header.
15. **Write the static `preview.html` page** — a self-contained HTML file (no React) that links the generated `tokens.css` and renders: swatch grid for every colour token; bar chart for spacing scale; ramp for type sizes; sample buttons for radii. Doubles as visual QA before Storybook arrives in `DES-002`.
16. **Write `README.md`** — overview of token names, naming convention, how to add a new token, generator command, lint-rule behaviour.
17. **(After `INF-002`)** Wire `@power-budget/design-tokens` as a workspace dependency of `packages/web` and `packages/mobile` (each as a `dependencies` entry).
18. **(After `INF-002`)** In `packages/web/src/styles/index.css` add `@import "@power-budget/design-tokens/dist/tokens.css";` and import that in `main.tsx`.
19. **(After `INF-002`)** In `packages/mobile/src/styles/tokens.ts` re-export `rnTheme` from the package; create `packages/mobile/src/presentation/ThemeProvider.tsx` that exposes `rnTheme` via `React.Context` (mobile equivalent of CSS variables).
20. **(After `INF-003`)** Lift the local ESLint rule into the root config (`.eslintrc.cjs`) so the project-wide pass enforces no inline hex.

## 6. Test plan

### 6.1 Unit tests (Vitest)

| Test                                       | Asserts                                                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `tokens.snapshot.test.ts`                  | `darkTheme` object matches the committed snapshot — drift is a deliberate change, must be reviewed.              |
| `css-output.test.ts`                       | `themeToCss(darkTheme)` matches `__snapshots__/dark.css.snap`; every spec-required token is present.             |
| `rn-output.test.ts`                        | `themeToRn(darkTheme)` keys are a 1:1 superset of CSS variables (mapping-completeness invariant).                |
| `eslint-rule.test.ts`                      | The `no-hex-outside-tokens` rule flags `color: '#123456'` in a fixture and passes on `tokens.ts` exemption.      |
| `theme-shape.test.ts` (compile-time check) | Importing `darkTheme` and asserting `: Theme` at the type level (the test fails to compile if the shape drifts). |

### 6.2 Visual verification

- The `preview.html` page is opened in a browser; reviewer eyeballs every swatch, every spacing step, every type ramp on a dark background and signs off.
- A screenshot of `preview.html` is attached to the PR for the user's visual review.

### 6.3 Integration smoke (gated on `INF-002` landing)

- `packages/web` builds and serves a minimal page using `var(--pb-color-text-primary)` and renders the expected hex in DevTools.
- `packages/mobile` renders a single `<Text>` with `useTheme().color.textPrimary` and the value matches `#E8ECF1`.

## 7. Acceptance criteria

Refining BACKLOG.md §4.5 DES-001:

- [ ] **Single canonical source.** `packages/design-tokens/src/tokens.ts` is the only file containing raw hex colours; both web CSS and RN object are generated from it.
- [ ] **Web export.** `dist/tokens.css` defines every `--pb-…` variable inside a single `:root { … }` block; `packages/web` imports it from `main.tsx` and the variables are resolvable via DevTools on a running dev server.
- [ ] **Mobile export.** `dist/rn-tokens.ts` exports a typed `rnTheme`; `packages/mobile` consumes it through a `ThemeProvider` context wrapper at the root.
- [ ] **Names align.** Every CSS variable has a deterministically named RN counterpart (covered by `rn-output.test.ts`'s mapping completeness assertion).
- [ ] **Dark theme exists.** Light-theme slot is present (typed) but stubbed; switching to light is a v2 task.
- [ ] **Lint rule.** `no-hex-outside-tokens` rule exists, has unit tests, and is wired into the root `.eslintrc.cjs` once `INF-003` lands; running `pnpm lint` after `INF-003` reports zero violations.
- [ ] **Preview page.** `preview.html` renders every token (swatch, spacing, type, radius) and is screenshotted in the PR description.
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
5. **`themes.light` stub shape.** Should the light theme be a real object (just with light colours) or `unknown`/throw? Recommendation: a real object with the same shape but `surface.base = "#FFFFFF"` etc. that is **never imported anywhere** in MVP code; this gives the future light-mode PR zero plumbing work.
6. **Prototype-driven refinement.** The design routine that should have produced `docs/mvp/design/` has not yet been copied to disk. When the final HTML/CSS prototype is pasted in, **these specific token values may shift** — surfaces, accents, the type ramp and the exact spacing steps are the most likely to be tweaked. The token _structure_ (CSS-var names, RN object shape, generator API) will not change; only the literals will. We mitigate by ensuring the canonical source is a single file (`themes.ts`) so the refinement is a one-file edit + regenerate.

## 9. Risks

| Risk                                                                                                                | Likelihood | Impact | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Token values change once the design prototype is copied in, invalidating downstream component work started on these | Medium     | Medium | Keep `themes.ts` the **only** source of literals; downstream components only ever read `var(--pb-…)` or `rnTheme.x`, never inline.  |
| CSS-variable / RN-object drift over time (one updated, the other not)                                               | Medium     | High   | Single canonical TS file + generator script; the `rn-output.test.ts` mapping-completeness test fails CI on any drift.               |
| `no-hex-outside-tokens` lint rule too noisy / lands before INF-003, blocking other work                             | Low        | Low    | DES-001 ships the rule **disabled by default**; INF-003 turns it on once the codebase is hex-free. Allowlist documented in §8 (#3). |
