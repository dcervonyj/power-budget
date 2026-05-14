# DES-002 — Component library scaffold — Button, Input, Modal — Implementation Plan

## 1. Task summary

- **Task ID**: DES-002
- **Title**: Component library scaffold — Button, Input, Modal
- **Area**: Design
- **Effort**: M (~3d)

**Context.** DES-002 builds the first three presentational primitives that every UI screen in the Power Budget MVP will use: `Button`, `Input`, and `Modal`. The primitives are delivered twice — once for the web app (`packages/web`, React + Vite per ARCHITECTURE.md §4 "Monorepo Layout") and once for the mobile app (`packages/mobile`, React Native + Expo, also §4) — with prop APIs kept structurally identical wherever the renderer permits. They consume the design tokens produced by DES-001 (single `tokens.json` projected to CSS custom properties for web and a parallel TS object for RN, per BACKLOG.md DES-001). Per ARCHITECTURE.md §4 ("Components that don't depend on DOM/React Native primitives can be hoisted to a `packages/ui-kit` if/when justified — not in MVP"), the architectural decision for the MVP is to **duplicate components between web and mobile** rather than build a true shared component package — React DOM and React Native are too different at the rendering layer for a meaningful unified component surface, and the per-platform diff is small enough that duplication is cheaper than abstraction in MVP. The components also satisfy the i18n rule in ARCHITECTURE.md §5.8 ("Every component uses `<FormattedMessage id="..." />` or the `useIntl()` hook — never inline strings"): primitive components never hardcode user-facing strings, and any rendered label is passed in as a `ReactNode` child or via an `aria-label` resolved by the caller. Unblocks WEB-005, WEB-008, MOB-005, MOB-012 (per BACKLOG.md DES-002 "Blocks" list) and is wave-2 startable once DES-001 lands.

## 2. Scope

**In scope**

- **Button** primitive, both web and mobile, with variants `primary | secondary | ghost | danger`, sizes `sm | md | lg`, and the cross-cutting states `default | hover | focus | active | disabled | loading | fullWidth`. Slots for `iconLeft` and `iconRight` (passed in as `ReactNode`).
- **Input** primitive, both web and mobile, supporting input types `text | password | email` (mapped to `type="..."` on web and `keyboardType` / `secureTextEntry` on RN). Built-in states `default | focused | invalid | disabled`. Optional adornments (leading icon, trailing icon). Controlled component only (`value` + `onChange`); no uncontrolled fallback.
- **Modal** primitive, both web and mobile, with states `open | closed`, a header slot, a body slot, a footer slot, and a `size` prop (`sm | md | lg | fullscreen`). On web: focus trap, ESC-to-close, click-outside-to-close (configurable), restore-focus-on-close, `aria-modal="true"` with `aria-labelledby` wired to the header. On RN: native `Modal` host with `onRequestClose` (Android back-button parity is v2-readiness even though MVP is iOS-only per PRD §1 / ARCHITECTURE §10 "Mobile deployment").
- **Barrel exports** from `packages/web/src/components/index.ts` and `packages/mobile/src/components/index.ts`.
- **Token integration**: every colour / spacing / radius / font value flows from the DES-001 tokens — no hex literals, no `px` numbers outside the token export, no inline RN style numbers outside the token export.
- **Accessibility baseline**:
  - Web: visible focus ring on all interactive elements (using the focus-ring token), keyboard navigation (`Tab` / `Shift+Tab`, `Enter` / `Space` to activate `Button`, `Enter` to submit when `Input` is inside a form), correct `aria-*` for `Modal`, screen-reader labels for icon-only buttons via an `aria-label` prop.
  - RN: `accessibilityRole`, `accessibilityLabel`, `accessibilityState` (disabled / busy / selected), and `accessible={true}` on the touchable wrappers.
- **Minimal preview surface** (web only): a single internal preview route `/__preview/components` that renders every variant × state matrix for visual smoke-testing during development. Not shipped behind any feature flag system — it's just a route hidden in production by being unlinked. (See §8 Open Questions for the Storybook question.)
- **Unit tests** for prop → output mapping, keyboard activation, and focus-trap behaviour on Modal (web).
- **Snapshot tests** for the rendered web output of every variant × state combination.

**Out of scope**

- Every other primitive listed in the BACKLOG.md DES-002 entry — **Select, Toggle, Drawer, ProgressBar** — and all higher-level / domain components (badges, cards, tables, toasts, progress bars beyond ProgressBar, money switcher). The BACKLOG entry's broader list is **intentionally narrowed by this task brief**; the deferred primitives will land in follow-up DES-\* tickets or in the consuming screen tasks (e.g. ProgressBar will land alongside DES-005 Dashboard visuals; the date / period picker for Plans lives with DES-005 / WEB-008). This narrower scope is the one to deliver for DES-002.
- **Storybook** as a full installation. A minimal preview route covers the same visual smoke-test need at a tiny fraction of the install + maintenance cost. See §8 Open Question 3.
- **Design tokens themselves** — DES-001's deliverable. DES-002 consumes them; it does not invent values.
- **Internationalization wiring** beyond the rule "no hardcoded strings inside primitives". The primitives accept already-translated `ReactNode` children; the `react-intl` provider, ICU pipeline, and `no-literal-string` ESLint rule are I18N-001 / I18N-002 deliverables and are not blockers for DES-002 because the primitives expose no built-in copy.
- **Dark mode** specific variant tuning beyond what falls out of DES-001's "dark variant optional in MVP" (BACKLOG.md DES-001 AC). The primitives must use `var(--token-name)` / token objects so a future dark mode flip is automatic; no dark-specific component code.
- **Higher-order form abstractions** (`<Form>`, `<Field>`, validation orchestration). Those land with WEB-005 (Auth screens) using `react-hook-form` or similar — a decision orthogonal to this primitive.
- **Animation library** for Modal enter / exit transitions. MVP uses CSS `transition` on web and `Animated.timing` on RN with token-driven durations; no `framer-motion` / `reanimated` dependency.
- **A shared `packages/ui-kit`** workspace package. Explicitly out per ARCHITECTURE.md §4. Re-evaluate in v2.

## 3. Files to create / modify

All paths relative to repo root.

| Path                                                       | Purpose                                                                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/web/src/components/Button.tsx`                   | Web Button component. Imports tokens from `@power-budget/tokens` (DES-001 output). CSS Modules file colocated.                                                    |
| `packages/web/src/components/Button.module.css`            | Variant + size + state styles. Every value references `var(--pb-*)` from DES-001.                                                                                 |
| `packages/web/src/components/Input.tsx`                    | Web Input. Wraps a native `<input>` with label / hint / error rows.                                                                                               |
| `packages/web/src/components/Input.module.css`             | Input styling driven by tokens.                                                                                                                                   |
| `packages/web/src/components/Modal.tsx`                    | Web Modal. Portals into `document.body`. Implements focus trap, ESC-close, click-outside-close, restore-focus-on-close.                                           |
| `packages/web/src/components/Modal.module.css`             | Backdrop, dialog box, header / body / footer rows; size variants.                                                                                                 |
| `packages/web/src/components/internal/useFocusTrap.ts`     | Hook implementing the focus-trap state machine for `Modal`. Private to the components folder.                                                                     |
| `packages/web/src/components/internal/useEscapeKey.ts`     | Hook that calls `onClose` on `Escape` when the modal is open.                                                                                                     |
| `packages/web/src/components/index.ts`                     | Barrel: `export { Button } from './Button'; export type { ButtonProps } …`                                                                                        |
| `packages/web/src/preview/components.tsx`                  | The `/__preview/components` route. Renders every variant × state combination.                                                                                     |
| `packages/web/src/preview/index.ts`                        | Route registration (referenced by WEB-002 routing — placeholder hook if WEB-002 not yet merged: documented as TODO).                                              |
| `packages/web/src/components/__tests__/Button.test.tsx`    | Vitest + `@testing-library/react` unit tests: prop → className mapping; click triggers `onClick`; disabled blocks click; `Enter` and `Space` activate.            |
| `packages/web/src/components/__tests__/Input.test.tsx`     | Vitest: controlled value flow; `onChange` fires; `type="password"` produces `type="password"` on the DOM node; invalid renders error row + `aria-invalid="true"`. |
| `packages/web/src/components/__tests__/Modal.test.tsx`     | Vitest: open / close lifecycle; focus enters dialog on open; focus restored on close; ESC closes; click on backdrop closes when `closeOnBackdrop=true`.           |
| `packages/web/src/components/__tests__/__snapshots__/`     | Auto-generated snapshots for variant × state matrix.                                                                                                              |
| `packages/mobile/src/components/Button.tsx`                | RN Button. Wraps `Pressable`. StyleSheet driven by tokens TS object.                                                                                              |
| `packages/mobile/src/components/Input.tsx`                 | RN Input. Wraps `TextInput`. Same prop surface as web where the platform allows.                                                                                  |
| `packages/mobile/src/components/Modal.tsx`                 | RN Modal. Wraps the host `Modal` component with header / body / footer slots and a backdrop `Pressable`.                                                          |
| `packages/mobile/src/components/index.ts`                  | RN barrel.                                                                                                                                                        |
| `packages/mobile/src/components/__tests__/Button.test.tsx` | Jest + `@testing-library/react-native`: `accessibilityState.disabled`; `onPress` fires; loading state suppresses `onPress`.                                       |
| `packages/mobile/src/components/__tests__/Input.test.tsx`  | Jest + RNTL: `secureTextEntry` set when `type="password"`; `onChangeText` fires.                                                                                  |
| `packages/mobile/src/components/__tests__/Modal.test.tsx`  | Jest + RNTL: `visible` toggles; `onRequestClose` fires.                                                                                                           |

**Modifications (light):**

| Path                              | Change                                                                                                                                                                                                       |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/web/src/main.tsx`       | If WEB-002 routing already merged, register `/__preview/components` route; otherwise leave a TODO comment + ticket reference. The plan must not break if WEB-002 has not landed yet.                         |
| `packages/web/package.json`       | Add dev deps only if missing: `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. Production deps unchanged (the components rely on React + DES-001 tokens, nothing else). |
| `packages/mobile/package.json`    | Add dev deps only if missing: `@testing-library/react-native`, `react-test-renderer`. No new production deps.                                                                                                |
| `packages/web/eslint.config.*`    | No change. (The `no-literal-string` rule comes with I18N-002, scoped to `presentation/`; components folder is part of presentation, so the rule will activate automatically when I18N-002 lands.)            |
| `packages/mobile/eslint.config.*` | No change.                                                                                                                                                                                                   |

## 4. Key interfaces & contracts

The TypeScript prop surfaces are the contract. Web and mobile share the same names and shapes; per-platform deltas are noted inline.

### 4.1 Button

```ts
// shared shape — both packages export the same prop name set
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  variant?: ButtonVariant; // default 'primary'
  size?: ButtonSize; // default 'md'
  fullWidth?: boolean; // default false
  isLoading?: boolean; // default false — shows spinner, suppresses press
  isDisabled?: boolean; // default false
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode; // the label (already translated by caller)
  ariaLabel?: string; // required when children is icon-only

  // Platform-specific handler — exactly one is present:
  onClick?: MouseEventHandler<HTMLButtonElement>; // web only
  onPress?: () => void; // mobile only

  // HTML / RN passthroughs that are useful but not abused:
  type?: "button" | "submit" | "reset"; // web only, default 'button'
  testID?: string; // RN; web uses data-testid
};
```

Rules:

- `isLoading` and `isDisabled` both block press; the visual difference is the spinner vs. the dimmed-no-spinner state.
- `iconLeft` / `iconRight` must size themselves; the Button does not constrain them beyond honouring the size token line-height.
- A loading button **does not** change its width — the label is preserved underneath with `visibility: hidden` (web) / `opacity: 0` (RN) so the layout doesn't shift.

### 4.2 Input

```ts
type InputType = "text" | "password" | "email";

type InputProps = {
  value: string; // controlled
  onChange: (next: string) => void; // controlled — receives the next value, not the event
  type?: InputType; // default 'text'
  label?: ReactNode; // rendered above the field
  hint?: ReactNode; // helper text below
  errorMessage?: ReactNode; // when set, switches to invalid styling and replaces hint
  placeholder?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  isDisabled?: boolean;
  isRequired?: boolean; // adds aria-required, marker glyph
  autoComplete?: string; // web only — passthrough
  inputMode?: "text" | "email" | "numeric" | "tel"; // web; mapped to keyboardType on RN
  testID?: string;
};
```

Rules:

- `onChange` receives a `string`, not a synthetic event — uniform between web and RN.
- `type="password"` maps to `secureTextEntry` on RN.
- `type="email"` sets `inputMode="email"` and `autoCapitalize="none"` defaults on RN; on web it sets the HTML `type="email"` plus `autocomplete="email"` only if the caller didn't pass an explicit `autoComplete`.
- When `errorMessage` is non-null, the field shows the danger token border and `aria-invalid="true"` / RN `accessibilityState={{ invalid: true }}`.

### 4.3 Modal

```ts
type ModalSize = "sm" | "md" | "lg" | "fullscreen";

type ModalProps = {
  isOpen: boolean; // controlled — caller owns the open state
  onClose: () => void;
  title?: ReactNode; // rendered into the header; also used for aria-labelledby on web
  size?: ModalSize; // default 'md'
  closeOnBackdrop?: boolean; // default true; set false for confirm dialogs
  closeOnEscape?: boolean; // default true; web-only
  initialFocusRef?: RefObject<HTMLElement | View>; // optional element to focus on open
  footer?: ReactNode; // sticky footer slot — usually action Buttons
  children: ReactNode; // the body
  testID?: string;
};
```

**Modal state machine (web).**

```
closed --(isOpen=true)--> opening --(transition end)--> open
open   --(ESC | backdrop click | onClose call)--> closing
                                              \-(transition end)--> closed
```

Behaviours, in order, when transitioning to `open`:

1. Save the currently-focused element (`previouslyFocused`).
2. Insert the dialog node into a portal at `document.body`.
3. Apply `aria-hidden="true"` to all direct children of `<body>` except the portal root.
4. Move focus to `initialFocusRef.current` if provided, otherwise to the first focusable element inside the dialog, otherwise to the dialog container itself (`tabIndex={-1}`).
5. Trap focus: `Tab` from last focusable → first focusable; `Shift+Tab` from first → last.
6. `Escape` calls `onClose` when `closeOnEscape !== false`.
7. Click on backdrop calls `onClose` when `closeOnBackdrop !== false`. Click inside the dialog does not.

On `close`:

1. Remove `aria-hidden` shielding.
2. Restore focus to `previouslyFocused`.
3. After exit transition, unmount the portal.

**Modal behaviour (RN).** Uses the native `Modal` host with `transparent={true}`, `animationType="fade"`, `onRequestClose={onClose}` (Android back-button parity for v2). Focus management is delegated to the platform (no manual trap needed — RN modals already block underlying touches). Backdrop is a `Pressable` that fires `onClose` when `closeOnBackdrop !== false`.

## 5. Step-by-step build order

Each step is ≤30 min unless flagged. Where a step is web-only or mobile-only, it is marked.

1. **(Setup)** Verify DES-001 has landed — `@power-budget/tokens` exports CSS file for web + TS module for RN. If absent, stop and surface a blocker.
2. **(Web)** Create `packages/web/src/components/Button.tsx` with the props from §4.1; render a native `<button>` with computed `className` array. No styling yet.
3. **(Web)** Create `Button.module.css` with rules for every variant × size × state combo using `var(--pb-*)` tokens. Include focus-ring via `:focus-visible`.
4. **(Web)** Wire the loading spinner (a 12px inline SVG with `animation: pb-spin 1s linear infinite`) and the label "visibility: hidden" trick for stable width.
5. **(Web)** Add `Button` unit tests: prop → className mapping (snapshot), `onClick` fires, `isDisabled` blocks `onClick`, `isLoading` blocks `onClick`, `Enter` and `Space` activate when focused, `aria-label` required check (TS-level, but also a runtime warn in dev when `children` is non-text).
6. **(Mobile)** Create `packages/mobile/src/components/Button.tsx`. Wrap `Pressable`. Compute styles via `StyleSheet.create` keyed by variant + size, merged in order base → variant → size → state.
7. **(Mobile)** Add accessibility props: `accessibilityRole="button"`, `accessibilityState={{ disabled, busy: isLoading }}`, `accessibilityLabel` falling back to extracted string children when `ariaLabel` not provided.
8. **(Mobile)** Button tests: `onPress` fires, `isDisabled` blocks press, `isLoading` blocks press, `accessibilityState` is correct.
9. **(Web)** Create `Input.tsx` per §4.2. Wrap a `<label>` with the field group: optional label row, the `<input>` row with optional icons, optional hint / error row. Use the controlled `value` + `onChange(next: string)` shape.
10. **(Web)** Create `Input.module.css` — default / focus (using `:focus-within`) / invalid / disabled.
11. **(Web)** Input tests: typing updates via `onChange`; `type="password"` produces `type="password"` on DOM; `errorMessage` toggles `aria-invalid` and shows danger styling; `isDisabled` produces `disabled` attribute.
12. **(Mobile)** Create `Input.tsx` (RN). Wrap `TextInput`. Map `type` → `keyboardType` / `secureTextEntry`. Same label / hint / error rows using `Text`.
13. **(Mobile)** Input tests: `onChangeText` → `onChange(next)` bridge fires; `type="password"` sets `secureTextEntry`; `errorMessage` sets `accessibilityState={{ invalid: true }}`.
14. **(Web — hardest step, ~45 min)** Create `useFocusTrap.ts` and `useEscapeKey.ts` hooks. The focus-trap walks the DOM for tabbable elements (`button:not([disabled])`, `[href]`, `input:not([disabled])`, `select:not([disabled])`, `textarea:not([disabled])`, `[tabindex]:not([tabindex="-1"])`) and intercepts `Tab` / `Shift+Tab` on the dialog root.
15. **(Web)** Create `Modal.tsx`. Portal to `document.body`. Apply backdrop, dialog box, header / body / footer slots. Wire the hooks from step 14. Implement open / close lifecycle from §4.3.
16. **(Web)** Create `Modal.module.css` with size variants, backdrop opacity (token), enter / exit `transition` on `opacity` + `transform`.
17. **(Web)** Modal tests: focus moves into dialog on open; `Tab` cycles inside the dialog; `Shift+Tab` from first focusable → last; `Escape` closes when `closeOnEscape !== false`; backdrop click closes when `closeOnBackdrop !== false`; click inside body does not close; focus returns to the trigger on close.
18. **(Mobile)** Create `Modal.tsx` (RN). Wrap native `Modal` with `transparent`, `animationType="fade"`, `onRequestClose`. Backdrop is a `Pressable`. No manual focus trap.
19. **(Mobile)** Modal tests: `visible` toggles correctly; `onRequestClose` fires; backdrop press fires `onClose`.
20. **(Web)** Write `packages/web/src/components/index.ts` barrel exporting all three components and their prop types.
21. **(Mobile)** Write `packages/mobile/src/components/index.ts` barrel.
22. **(Web)** Create `packages/web/src/preview/components.tsx`: render the full matrix — 4 variants × 3 sizes × {default, hover, focus, disabled, loading} for Button; default / invalid / disabled for Input × 3 types; a stacked panel demonstrating an open Modal in each size.
23. **(Web)** Register the preview route at `/__preview/components`. If WEB-002 routing not yet merged, leave a TODO comment with the ticket id so it can be wired in five seconds once routing exists.
24. **(Both)** Run `pnpm turbo run lint typecheck test` from repo root. All packages must pass.
25. **(Both)** Manual visual sweep on web in Chrome + Safari + Firefox at 320 / 768 / 1280 widths; on RN in iOS simulator (iPhone 15 + iPhone SE form factor for the small-screen check).
26. **(Cleanup)** Tag every TODO referencing prototype refinement with `// TODO(DES-002-prototype): adopt exact spacing/colour from docs/mvp/design/ once copied in` (see §8 Open Question 5).

## 6. Test plan

**Visual (preview-page driven, manual).**

- Web preview at `/__preview/components` renders every variant × state matrix without console errors.
- RN preview surface: a single `ComponentsPreviewScreen` reachable in dev builds via a debug menu entry (deferred to MOB-001 / MOB-002 wiring — for DES-002, the manual route is "import the components into `App.tsx` during local dev").
- Default, hover, focus, focus-visible (`:focus-visible` only), disabled, loading states all visible at a glance on web.
- All RN states (default, pressed, disabled, loading) visible by tapping each row in the preview surface.

**Unit (automated).**

- Button: prop → class / style mapping is exhaustive across `variant × size`. `onClick` / `onPress` fires; `isDisabled` and `isLoading` both block press. Keyboard activation on web: `Enter` and `Space` invoke `onClick` when focused. Icon-only button without `ariaLabel` triggers a dev warning (and a TS error via discriminated-union typing in §4.1).
- Input: controlled value round-trip via `onChange`. `type="password"` produces correct host attribute. `errorMessage` toggles `aria-invalid` / `accessibilityState.invalid`. `isDisabled` blocks input + sets host `disabled` / `editable={false}`.
- Modal (web): the full state machine from §4.3 covered — open → focus enters dialog; `Tab` cycles; `Shift+Tab` cycles in reverse; `Escape` closes; backdrop click closes; body click does not close; close restores focus to the previously-focused element.
- Modal (RN): `visible` toggles; `onRequestClose` fires from the host's back-button-equivalent; backdrop `Pressable` fires `onClose`.

**Snapshot.**

- Vitest + `@testing-library/react` for the web Button × all variant/size/state combos.
- Snapshots are committed; any unintended visual change shows up in PR review as a snapshot diff.

**Manual a11y.**

- Web: tab through the preview page using only the keyboard; every interactive control is reachable; focus ring is visible against the background (use the `focus-ring` token from DES-001).
- Web: run axe-core (`@axe-core/react` injected only in dev) on the preview route; zero violations.
- Web contrast: every variant's text-on-background combination must pass WCAG AA (4.5:1 for body text, 3:1 for large text). Verified manually against the DES-001 colour tokens using a contrast checker. Record findings in §8 as feedback to DES-001 if any pair fails.
- RN: VoiceOver run on iOS simulator — every Button announces its label + role; every Input announces its label + value + invalid state; Modal traps interaction (handled by the host).

**Integration smoke.**

- The future WEB-005 (Auth screens) "Login form" can be built in a sandbox using only these three primitives: that's the implicit acceptance criterion. The preview page includes one such Login-form-shaped mock to prove the surface is sufficient.

## 7. Acceptance criteria

- [ ] `Button`, `Input`, `Modal` exported from `packages/web/src/components/index.ts` and `packages/mobile/src/components/index.ts` with the prop types from §4.
- [ ] All values (colour, spacing, radius, font, focus-ring, motion duration) flow from DES-001 tokens; no hex literals, no `px` numbers in component files beyond the token consumption.
- [ ] Variants for `Button`: `primary | secondary | ghost | danger`. Sizes: `sm | md | lg`. All combinations render in the web preview page.
- [ ] `Button` supports `isLoading` (spinner, suppressed press, no width shift), `isDisabled` (dimmed, suppressed press), `fullWidth`, `iconLeft`, `iconRight`.
- [ ] `Input` supports `type="text" | "password" | "email"`, label, hint, error, `isRequired`, `isDisabled`, leading / trailing icons, and is fully controlled.
- [ ] `Modal` supports `sm | md | lg | fullscreen`, ESC-to-close (web), click-outside-to-close (web), focus trap (web), restore-focus-on-close (web), `onRequestClose` (mobile), header / body / footer slots.
- [ ] Web Modal passes the focus-trap test, the ESC-close test, the backdrop-close test, and the restore-focus test (see §6).
- [ ] All components carry the correct ARIA / RN accessibility props from §2 "Accessibility baseline".
- [ ] WCAG AA contrast verified on every Button text-on-background pair.
- [ ] `pnpm turbo run lint typecheck test` is green at repo root.
- [ ] Web preview page at `/__preview/components` renders without console errors in Chrome + Safari + Firefox.
- [ ] No `<FormattedMessage>` import or hardcoded user-facing string appears in any primitive — strings come from the caller. (Verifiable manually now; enforced by I18N-002's lint rule once it lands.)
- [ ] Unblocks the four downstream tasks listed in BACKLOG.md DES-002 "Blocks": WEB-005, WEB-008, MOB-005, MOB-012. (Validated by a sandbox login-form mock on the preview page.)

## 8. Open questions / decisions

1. **Web styling approach — CSS Modules vs. CSS-in-JS vs. Tailwind.** _Recommendation:_ **CSS Modules** for the MVP. Reasons: (a) zero runtime overhead, matching the "no implicit DI / no ambient mutation" discipline from ARCHITECTURE.md §3; (b) trivially consumes the CSS custom properties produced by DES-001 (`var(--pb-color-primary-500)`) — no token-bridging code needed; (c) `:focus-visible`, `:focus-within`, `:has()` etc. work out of the box, which simplifies the focus-ring and invalid-input behaviour; (d) generated class names are local-scoped, so the components remain importable from any package without leaking CSS; (e) the alternatives — styled-components / vanilla-extract / Tailwind — each add a build-time or runtime cost and a learning surface that buys nothing the primitives need. Decision needed from the user before implementation begins.
2. **Mobile styling approach — `StyleSheet.create` vs. styled-components/native.** _Recommendation:_ plain `StyleSheet.create` keyed by variant / size. Same rationale as web: zero new deps, direct token consumption from the DES-001 TS export, no learning surface. Decision needed.
3. **Storybook now or defer.** _Recommendation:_ defer. A single preview route gives the same smoke-test value at a fraction of the install / maintenance / CI-build cost; with three primitives in DES-002 the matrix fits on one page. Revisit when the component count crosses ~10 (around DES-005 + DES-006), at which point either Storybook or Ladle becomes worth its weight.
4. **Shared `@power-budget/ui` package vs. duplicate components.** _Recommendation:_ **duplicate**. ARCHITECTURE.md §4 already locks this in for MVP ("Components that don't depend on DOM/React Native primitives can be hoisted to a `packages/ui-kit` if/when justified — not in MVP"). The DOM and RN renderer surfaces differ enough — `<button>` vs. `<Pressable>`, `<input>` vs. `<TextInput>`, `document.body` portal vs. native `Modal` host — that a unified component layer would mostly be a wrapper over divergent implementations. Duplicating ~150 LOC × 3 components on day one is cheaper than building the abstraction layer. The TypeScript **prop types** are shared in spirit (§4) but not via a shared package — each side declares its own to avoid the dependency. Re-evaluate in v2.
5. **Prototype-derived styling refinements.** The design prototype output (`docs/mvp/design/`) has not been copied to disk at the time of this plan. The primitives are built against DES-001 tokens (which DES-001 derives from that prototype). Once the prototype HTML/CSS lands on disk, a small follow-up pass will adopt the exact spacing / radius / shadow values the designer chose for these three components, replacing any plausible-default I picked from the token palette during this build. The follow-up is scoped at ≤ 30 min and is **not** a blocker for downstream consumers (WEB-005 / MOB-005 / WEB-008 / MOB-012) because the prop API and token-references remain stable; only token-value selections may shift.
6. **Form / validation library.** Not part of DES-002. WEB-005 (Auth screens) and downstream form-heavy tasks (WEB-008, WEB-020) will pick a form library (`react-hook-form` is the likely choice). The `Input` primitive is intentionally controlled-only and exposes `errorMessage` as a `ReactNode` so any form library can drive it without coupling.
7. **Icon system.** Not part of DES-002. `iconLeft` / `iconRight` are typed as `ReactNode`, so any icon delivery (inline SVG, `lucide-react`, RN equivalent) plugs in. DES-006 ("Categories + privacy visuals") delivers the first batch of project SVG icons; until then, primitives accept whatever the caller hands them.
8. **Dev-only invariants vs. runtime warnings.** Should icon-only `Button` without `ariaLabel` throw, warn, or be a TS-discriminated-union error? _Recommendation:_ TS-level discriminated union enforces it at compile time (`children: string` OR `ariaLabel: string`); dev-build `console.warn` for the runtime case where TS is bypassed (e.g. external JS callers). No runtime throw — primitives never throw on render in production.

## 9. Risks

1. **Focus trap edge cases.** The web Modal's focus trap is the single most error-prone piece of the task. Hand-rolling tab navigation has a long history of subtle bugs (radio-group focus, contenteditable, iframe contents, dynamically-added focusables). _Mitigation:_ the test suite in §6 covers the four canonical traps (tab cycle forward, tab cycle backward, ESC, backdrop-close); if a bug surfaces in WEB-005's adoption, swap in `focus-trap-react` (single dep, well-maintained) as a hot-fix without changing the public `ModalProps`.
2. **Prop-API drift between web and RN.** With duplicated implementations, it is easy for the web `Button` to grow a `target="_blank"` prop while the RN one doesn't. _Mitigation:_ the prop-type definitions in §4 are the canonical contract; the two `Button.tsx` files reference the same documented prop list at the top of the file. A future v2 may extract a `types-only` shared TS file if drift becomes painful.
3. **Token churn from DES-001 prototype-derived values.** DES-001 itself depends on the design prototype (currently not yet on disk). If DES-001 ships a token set that later changes when the prototype lands, every DES-002 component re-renders with new visuals — by design. The risk is purely visual; the prop API is unchanged. _Mitigation:_ snapshot tests catch unintended drift; intentional drift is a one-line snapshot update in the prototype-refinement follow-up (§8 Open Question 5).
