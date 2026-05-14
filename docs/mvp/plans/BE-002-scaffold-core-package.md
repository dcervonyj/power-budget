# BE-002 — Scaffold `@power-budget/core` package

## 1. Task summary

- **ID**: BE-002
- **Title**: Scaffold `@power-budget/core` package
- **Area**: Backend
- **Effort**: S (~1d)
- **Blocked by**: INF-002 (monorepo skeleton), INF-003 (root ESLint)
- **Blocks**: BE-003 and every package that imports core (BE-004, BE-006, BE-007, BE-008, BE-009, BE-010, BE-011, BE-016, BE-020, BE-025, BE-027, BE-028, the full web/mobile re-export chain, etc.)

`@power-budget/core` is the **shared pure-TypeScript package** consumed by backend (`packages/backend`), web (`packages/web`), and mobile (`packages/mobile`) per ARCHITECTURE.md §4 ("What lives in each package"). It is the single source of truth for the domain language: entity types, branded IDs, value objects (`Money`, `DateRange`, `LocaleCode`), and a small library of **pure functions** that compute planned-vs-actual, leftover, FX conversion, category aggregation with privacy, and mapping suggestions. Because the same module compiles for Node (NestJS), browser (Vite), and React Native (Hermes), it must contain **no I/O, no framework imports, no Node-specific globals, no DOM types, no React types, no singletons, no ambient state**. ARCHITECTURE.md §4 explicitly bans `react`, `@nestjs/*`, `drizzle-orm`, `axios`, `fs`, `crypto`, DOM, and React Native types; this ban must be machine-enforceable. The package has an empty `dependencies: {}` block — this is non-negotiable per §4 ("Why a separate `core` package, not just a `shared/` folder").

This task scaffolds the package — its folder tree, build, lint, type-check, and the **negative test that proves the import ban works**. Actual entity / ID / value-object content lands in BE-003 and BE-004; actual pure functions land in BE-006 through BE-009. After this task ships, every downstream domain task can start adding types into a working, banned-imports-protected, dual-format-emitting package without touching build config.

## 2. Scope

**In scope**

- Create `packages/core/` directory tree with all per-domain barrels listed in ARCHITECTURE.md §5.1 – §5.10.
- `package.json` with empty `dependencies`, dual ESM+CJS subpath exports, `sideEffects: false`, `workspace:*`-consumable name `@power-budget/core`.
- `tsconfig.json` (editor + tests) and `tsconfig.build.json` (production emit) — both with strictest settings.
- `tsup.config.ts` producing ESM (`.mjs`) + CJS (`.cjs`) + `.d.ts` to `dist/`.
- `.eslintrc.cjs` extending the root config and **adding** an `no-restricted-imports` rule banning every framework / I/O import enumerated in ARCHITECTURE.md §4.
- Barrel files (`index.ts`) for the package root, `domain/`, `logic/`, and each of the ten domain folders.
- Type-check-clean placeholder content (an `export {}` line in each barrel) so `tsc --noEmit` is green on day one.
- One **negative fixture** (`__fixtures__/banned-imports.fixture.ts.txt`) plus a CI guard that confirms a deliberate `import 'react'` is rejected.
- A short `README.md` inside `packages/core/` listing the package's role and the banned-imports list (mirrors §4 wording).
- Wire `pnpm -F @power-budget/core build|lint|typecheck` into the existing Turborepo pipeline.

**Out of scope**

- Branded ID types, `Money`, `DateRange`, `LocaleCode` — these are BE-003.
- Entity types (`User`, `Household`, `Transaction`, `Plan`, `PlannedItem`, `Category`, etc.) — these are BE-004.
- Pure logic functions (`computePlanActuals`, `computeLeftover`, `convertMoney`, `aggregateByCategoryWithPrivacy`, `applyMappingSuggestion`) — these are BE-006, BE-007, BE-008, BE-009.
- Locale-aware formatters (`formatMoney`, `formatDate`) — BE-010.
- Schema-level type derivation (`drizzle-zod` / `InferModel`) — that lives in `packages/backend`, not in core (core has zero runtime deps).
- Any unit tests of those logic functions (they ship with their owning task).
- Any consumption from `packages/backend` / `web` / `mobile` beyond the smoke import in step 9 (real consumption arrives with BE-001 / WEB-001 / MOB-001).

## 3. Files to create / modify

All paths are relative to repo root (`/Users/bartimeus/IdeaProjects/power-budget/`).

### Create

| Path                                                       | Purpose                                                                                                           |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/core/package.json`                               | Manifest. Name, version, exports map, scripts, empty `dependencies`.                                              |
| `packages/core/tsconfig.json`                              | Editor + test type-checking. Extends `tsconfig.base.json`.                                                        |
| `packages/core/tsconfig.build.json`                        | Production emit config consumed by tsup for `.d.ts`.                                                              |
| `packages/core/tsup.config.ts`                             | Build definition: ESM + CJS + types, no externals (zero deps).                                                    |
| `packages/core/.eslintrc.cjs`                              | Extends root; adds `no-restricted-imports` ban list.                                                              |
| `packages/core/.eslintignore`                              | Excludes `dist/` and `__fixtures__/banned-imports.fixture.ts.txt`.                                                |
| `packages/core/README.md`                                  | One-page role + banned-imports list (mirrors §4).                                                                 |
| `packages/core/src/index.ts`                               | Root barrel: re-exports `./domain` and `./logic`.                                                                 |
| `packages/core/src/domain/index.ts`                        | Domain barrel: re-exports the ten domain folders.                                                                 |
| `packages/core/src/domain/auth/index.ts`                   | Empty barrel for §5.1 (User, Household, Session, etc. — filled in BE-4).                                          |
| `packages/core/src/domain/bank/index.ts`                   | Empty barrel for §5.2 (BankConnection, BankAccount, Consent).                                                     |
| `packages/core/src/domain/transactions/index.ts`           | Empty barrel for §5.3 (Transaction, Mapping, Transfer).                                                           |
| `packages/core/src/domain/plans/index.ts`                  | Empty barrel for §5.4 (Plan, PlannedItem, PlannedItemVersion).                                                    |
| `packages/core/src/domain/categories/index.ts`             | Empty barrel for §5.5 (Category, CategoryPrivacy, CategoryAggregate).                                             |
| `packages/core/src/domain/currency/index.ts`               | Empty barrel for §5.6 (Currency, Money, FxRate, FxRateTable).                                                     |
| `packages/core/src/domain/notifications/index.ts`          | Empty barrel for §5.7 (NotificationKind, NotificationPreferences).                                                |
| `packages/core/src/domain/i18n/index.ts`                   | Empty barrel for §5.8 (LocaleCode, FormatProfile, MessageKey).                                                    |
| `packages/core/src/domain/dashboard/index.ts`              | Empty barrel for §5.9 (PlanActualsView, LeftoverEntry, UnplannedTotals).                                          |
| `packages/core/src/domain/shared/index.ts`                 | Empty barrel for §5.10 (HouseholdScope, AuditEvent, EncryptedString).                                             |
| `packages/core/src/logic/index.ts`                         | Empty barrel; pure functions land here in BE-006–BE-009.                                                          |
| `packages/core/__fixtures__/banned-imports.fixture.ts.txt` | Deliberately-bad file (deliberate `.txt` so it's not type-checked); used by the negative ESLint test.             |
| `packages/core/scripts/verify-banned-imports.mjs`          | Renames the fixture to `.ts`, runs ESLint on it, asserts non-zero exit, restores it. Wired as `lint:bans` script. |

### Modify

| Path                  | Change                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm-workspace.yaml` | Confirm `packages/*` glob already covers `packages/core` (added by INF-002 — verify, not re-add).                                                  |
| `turbo.json`          | Confirm `build`, `lint`, `typecheck` pipelines cover the new package (no per-package wiring needed if pipelines target all workspaces by default). |
| `tsconfig.base.json`  | Verify the strictness flags listed in §4 are present; if any are missing add them in this task.                                                    |

## 4. Key interfaces & contracts

### 4.1 Build output

- `dist/index.mjs` — ESM bundle (consumed by web + mobile + Node ESM).
- `dist/index.cjs` — CJS bundle (consumed by Node CJS, React Native's Metro fallback path, and any tool that still defaults to `require`).
- `dist/index.d.ts` — type declarations shared by both formats.
- Source maps emitted for both formats.
- `sideEffects: false` so bundlers tree-shake unused exports across the consumer apps.

### 4.2 Package exports map

Subpath exports give consumers `import { ... } from '@power-budget/core'` for the headline barrel and `import { ... } from '@power-budget/core/domain'` / `'@power-budget/core/logic'` for narrower entry points:

```jsonc
{
  "name": "@power-budget/core",
  "version": "0.0.0",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
    },
    "./domain": {
      "types": "./dist/domain/index.d.ts",
      "import": "./dist/domain/index.mjs",
      "require": "./dist/domain/index.cjs",
    },
    "./logic": {
      "types": "./dist/logic/index.d.ts",
      "import": "./dist/logic/index.mjs",
      "require": "./dist/logic/index.cjs",
    },
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"src/**/*.ts\"",
    "lint:bans": "node scripts/verify-banned-imports.mjs",
    "test": "echo \"no tests in this package yet\" && exit 0",
  },
  "dependencies": {},
  "devDependencies": {
    "tsup": "<pinned>",
    "typescript": "<pinned-via-root>",
    "@types/node": "<pinned-via-root>",
  },
}
```

`@types/node` is a **devDependency only** (needed for type-checking the build script and tsup config); it is **never** imported from `src/`. The ESLint ban (§4.3) blocks this.

### 4.3 ESLint banned imports

`packages/core/.eslintrc.cjs` extends the root config and adds:

```js
rules: {
  'no-restricted-imports': ['error', {
    paths: [
      { name: 'react',          message: 'core is framework-agnostic — no React (ARCHITECTURE.md §4).' },
      { name: 'react-dom',      message: 'core is framework-agnostic — no React.'                       },
      { name: 'react-native',   message: 'core is framework-agnostic — no React Native.'               },
      { name: 'express',        message: 'core has no I/O — no Express.'                                },
      { name: 'fastify',        message: 'core has no I/O — no Fastify.'                                },
      { name: 'axios',          message: 'core has no I/O — no HTTP clients.'                           },
      { name: 'drizzle-orm',    message: 'core has no DB access — no Drizzle.'                          },
      { name: 'fs',             message: 'core has no I/O — no Node fs.'                                },
      { name: 'path',           message: 'core has no I/O — no Node path.'                              },
      { name: 'os',             message: 'core has no I/O — no Node os.'                                },
      { name: 'crypto',         message: 'core has no I/O — no Node crypto.'                            },
      { name: 'http',           message: 'core has no I/O — no Node http.'                              },
      { name: 'https',          message: 'core has no I/O — no Node https.'                             },
      { name: 'stream',         message: 'core has no I/O — no Node stream.'                            },
      { name: 'buffer',         message: 'core has no I/O — no Node Buffer; use Uint8Array.'            }
    ],
    patterns: [
      { group: ['@nestjs/*'],           message: 'core is framework-agnostic — no NestJS (ARCHITECTURE.md §4).' },
      { group: ['node:*'],              message: 'core has no Node-specific imports.'                            },
      { group: ['@power-budget/backend', '@power-budget/web', '@power-budget/mobile'],
                                        message: 'core must not depend on any app package; dependency flows inward.' }
    ]
  }]
}
```

The `overrides` block excludes `scripts/**` and `tsup.config.ts` from this rule (they legitimately import Node tooling).

### 4.4 TypeScript strictness

Both `tsconfig.json` (editor) and `tsconfig.build.json` (emit) extend `tsconfig.base.json` and assert / add:

- `"strict": true`
- `"noUncheckedIndexedAccess": true`
- `"exactOptionalPropertyTypes": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`
- `"isolatedModules": true`
- `"verbatimModuleSyntax": true`
- `"moduleResolution": "bundler"`
- `"target": "ES2022"`, `"lib": ["ES2022"]` (no `DOM`, no `WebWorker`)
- `"types": []` — no ambient `@types/*` packages leak in (in particular **no `@types/node` ambient global** in `src/`).
- `"declaration": true`, `"declarationMap": true` in the build config.

### 4.5 tsup config (sketch)

```ts
// tsup.config.ts
import { defineConfig } from "tsup";
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "domain/index": "src/domain/index.ts",
    "logic/index": "src/logic/index.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    resolve: true,
    entry: {
      index: "src/index.ts",
      "domain/index": "src/domain/index.ts",
      "logic/index": "src/logic/index.ts",
    },
  },
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  target: "es2022",
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
});
```

## 5. Step-by-step build order

Each step is ≤ 30 min of focused work.

1. **Create folder skeleton.** `mkdir -p packages/core/src/{domain/{auth,bank,transactions,plans,categories,currency,notifications,i18n,dashboard,shared},logic}` plus `packages/core/__fixtures__`, `packages/core/scripts`.
2. **Write barrels.** Add an `export {}` line to every `index.ts` (root, `domain/`, ten domain subfolders, `logic/`). `domain/index.ts` re-exports the ten sub-barrels with `export * from './auth';` etc.; `src/index.ts` re-exports `./domain` and `./logic`.
3. **Write `package.json`.** Use the manifest in §4.2. Name `@power-budget/core`, version `0.0.0`, empty `dependencies`, devDeps for `tsup` + `typescript`. `private: true` so it never publishes.
4. **Write `tsconfig.json`.** Extend `tsconfig.base.json`. Add the §4.4 flags. `include: ["src", "tsup.config.ts", "scripts"]`.
5. **Write `tsconfig.build.json`.** Extend `tsconfig.json`. Override `include: ["src"]`, set `declaration`, `declarationMap`, `outDir: "dist"`, `emitDeclarationOnly: false`. (tsup uses this for `.d.ts` resolution.)
6. **Write `tsup.config.ts`** per §4.5. Test locally: `pnpm -F @power-budget/core build` must emit `dist/index.{mjs,cjs,d.ts}`, `dist/domain/index.*`, `dist/logic/index.*` (the latter two are empty modules but the files must exist so subpath exports resolve).
7. **Write `.eslintrc.cjs`** per §4.3. `root: false` so it composes with the root config; `parserOptions.project: "./tsconfig.json"` so TS-aware rules work.
8. **Run `pnpm -F @power-budget/core lint typecheck build`.** All three must pass green. If a path doesn't resolve, fix barrels before moving on.
9. **Smoke-import from a sibling.** From the repo root run `node -e "import('./packages/core/dist/index.mjs').then(m => console.log('exports:', Object.keys(m)))"` and `node -e "console.log(Object.keys(require('./packages/core/dist/index.cjs')))"`. Both must print `[]` (no exports yet — that's correct).
10. **Write the negative fixture.** `__fixtures__/banned-imports.fixture.ts.txt` content: `import React from 'react'; export const _ = React;`. The `.txt` suffix keeps it out of normal lint runs and out of typecheck.
11. **Write `scripts/verify-banned-imports.mjs`.** Pseudocode: copy the fixture to `src/__bans-probe__.ts`, run `eslint src/__bans-probe__.ts` capturing exit code, delete the probe, exit `0` if ESLint exited non-zero, otherwise exit `1` with a clear error message. (Using a copy keeps the source-tree clean; the `try/finally` deletes the probe even on Ctrl-C.)
12. **Wire `lint:bans`** as a Turborepo task input alongside `lint`. Add it to the `build` pipeline's `dependsOn` so a broken ban list blocks builds. (Or run it as part of `pnpm -F @power-budget/core lint` via a `posttest` / composite — choose one and document.)
13. **Write `README.md`.** One screen of prose: what core is, the dependency rule (ARCHITECTURE.md §4), the banned list, where new domain code goes (`src/domain/<area>/`), where pure logic goes (`src/logic/`), how to consume (`pnpm add @power-budget/core@workspace:* -F backend`).
14. **Final verification.** From a clean state: `pnpm install && pnpm -F @power-budget/core lint typecheck build lint:bans` — every step green.
15. **Verify CI picks it up.** Push a feature branch; confirm the Turborepo CI added in INF-005 (Wave 4) runs all four scripts and the package appears in the cache report.

## 6. Test plan

Manual / automated verifications for the acceptance review:

- `pnpm -F @power-budget/core typecheck` → exit 0.
- `pnpm -F @power-budget/core lint` → exit 0.
- `pnpm -F @power-budget/core build` → produces:
  - `dist/index.mjs`
  - `dist/index.cjs`
  - `dist/index.d.ts`
  - `dist/domain/index.{mjs,cjs,d.ts}`
  - `dist/logic/index.{mjs,cjs,d.ts}`
  - source maps for each `.mjs` / `.cjs`.
- `pnpm -F @power-budget/core lint:bans` → exit 0 (the script asserts ESLint rejected the deliberate `react` import; success here means the ban works).
- **Negative-test integrity.** Temporarily delete the `no-restricted-imports` rule from `.eslintrc.cjs` → `pnpm -F @power-budget/core lint:bans` must exit non-zero (proves the test isn't a tautology). Restore the rule.
- **Cross-package import smoke.** In a throwaway file under `packages/backend/src/` (created and deleted only for the test, since BE-001 has not landed yet — alternatively do this in `node -e`): `import * as core from '@power-budget/core';` must resolve without `Cannot find module` and produce `core = {}` at runtime.
- `pnpm install` from a clean clone with no node_modules → exits clean; `packages/core/node_modules` contains only `tsup`, `typescript`, and their transitives — no React, no Nest, no Drizzle.
- `cat packages/core/dist/index.mjs` (or use Read) → no `require(` call to a banned module; no `import 'react'`-style string.
- CI green on push.

## 7. Acceptance criteria

Refined from BACKLOG.md BE-002 plus the structural requirements above:

- [ ] `packages/core/` exists with the full folder tree in §3 ("Create" table).
- [ ] `pnpm -F @power-budget/core build` emits dual ESM + CJS bundles and `.d.ts` files for the root, `/domain`, and `/logic` subpath exports.
- [ ] `pnpm -F @power-budget/core typecheck` passes with the strictest TS settings listed in §4.4.
- [ ] `pnpm -F @power-budget/core lint` passes.
- [ ] `pnpm -F @power-budget/core lint:bans` exits 0 (the deliberate `react` import is rejected); deleting the ban rule flips it to non-zero.
- [ ] `package.json` `dependencies` is `{}` and `sideEffects` is `false`.
- [ ] Package is referenced as `workspace:*` and resolves from a sibling package without configuration.
- [ ] CI workflow (added in INF-005) executes all four scripts on every PR.
- [ ] `README.md` documents the package role and the full banned-imports list (mirroring ARCHITECTURE.md §4).

## 8. Open questions / decisions

1. **Builder choice — tsup vs. plain `tsc` vs. unbuild.**
   _Recommendation:_ **tsup**. ARCHITECTURE.md §4 says "compiles with `tsc` to ESM; no bundler", but the same paragraph also requires a `dist/` shippable as a workspace package. tsup is a thin wrapper around esbuild that emits ESM+CJS+`.d.ts` from one config, has no runtime, and is the standard pick for pure-TS workspace packages. Plain `tsc` can emit ESM **or** CJS but not both without two configs and post-processing; unbuild is heavier and less common. Recommend tsup; revisit if the build becomes complex. (This deviates slightly from the literal §4 wording — flag in the PR for sign-off.)

2. **CJS support — keep or drop?**
   _Recommendation:_ **keep for MVP**. Drop in v2 once Metro / React Native fully prefer ESM. Cost is one extra bundle; benefit is no surprise `require` failures on the mobile side and full Node 18+ CJS interop.

3. **Strictness of the banned-imports list.**
   _Recommendation:_ **strict from day 1** (the full list in §4.3). The whole point of a separate package is that this rule is enforceable. Loosening it later is one line; tightening it after dozens of files have leaked through is a refactor.

4. **Where do `react-intl` ICU types live?**
   _Recommendation:_ they don't live in core. `LocaleCode`, `MessageKey`, `FormatProfile`, `MessageBundle` are pure TS types and **do** live in core (§5.8). The `react-intl` runtime lives in `packages/web` / `packages/mobile`. Core stays runtime-free.

5. **Should `LocaleCode` be `'en' | 'uk' | 'ru' | 'pl'` or `string`?**
   _Defer to BE-003 / BE-004._ ARCHITECTURE.md §5.8 says "widened to `string` in the schema to allow content-only additions"; the type can stay as a four-member union in core. Not this task's call.

6. **Whose responsibility is it to add `@power-budget/core` to consumer `dependencies`?**
   _Decision:_ this task does **not** edit `packages/backend/package.json` etc. — those packages don't exist yet (BE-001 / WEB-001 / MOB-001 land in Wave 4). Each consumer task adds the dep when it scaffolds itself.

## 9. Risks

1. **Bundler choice diverges from the literal text of ARCHITECTURE.md §4** ("compiles with `tsc` to ESM; no bundler"). _Mitigation:_ raise tsup recommendation explicitly in the PR; if rejected, fall back to two `tsc` invocations (one ESM, one CJS) plus a small post-build copy step — ~2 hours of extra work.

2. **The negative-import test is brittle** (copying a `.txt` fixture into `src/` for the duration of ESLint). _Mitigation:_ the script runs the copy/delete in a `try/finally` and verifies the probe file is absent at end. A second-level mitigation is the `.eslintignore` excluding the original `.txt` fixture so it never lints "by accident".

3. **CJS interop bugs at consumer side** (mixed `import` + `require` paths confuse bundlers, especially Metro on React Native). _Mitigation:_ explicit `exports` map with separate `import` / `require` entries per subpath (§4.2); smoke-test both formats in step 9 of the build order. Re-test from the consumer side as soon as BE-001 / MOB-001 scaffold their packages.
