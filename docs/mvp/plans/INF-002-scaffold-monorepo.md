# INF-002 — Scaffold pnpm + Turborepo monorepo (Implementation Plan)

## 1. Task summary

- **ID**: INF-002
- **Title**: Scaffold pnpm + Turborepo monorepo
- **Area**: Infra
- **Effort**: S (~1d)

This task lays down the physical shape of the repository described in ARCHITECTURE.md §4 (Monorepo Layout) and §10 (Build & Deployment Outline): a pnpm workspace with four packages (`core`, `backend`, `web`, `mobile`), orchestrated by Turborepo. It is the gate that unblocks almost every other code-producing task in BACKLOG.md — directly `INF-003` (ESLint/Prettier), `INF-004` (docker-compose), `BE-001` (NestJS skeleton), `WEB-001` (Vite app), `MOB-001` (Expo app), and transitively the entire backend, web, mobile, shared, and i18n streams. Per BACKLOG.md §3 Wave 2, INF-002 is the single fan-out point: once it lands, the "explosion wave" of parallel work begins. Scope is strictly skeletal — empty packages, valid `tsconfig` / `package.json` files, working `pnpm install`, working `turbo run` — no domain code, no app code, no CI, no Docker.

## 2. Scope

### In scope

- `git init`, initial `.gitignore`, `.editorconfig`, `.nvmrc` pinning Node 20 LTS.
- pnpm workspace root: `package.json` (with `packageManager` field), `pnpm-workspace.yaml`.
- Turborepo: `turbo.json` defining `build`, `dev`, `lint`, `typecheck`, `test` pipelines with correct `dependsOn` topology and `outputs` cache hints.
- Shared TS config base: `tsconfig.base.json` with the strictness profile mandated by INF-002 acceptance criteria (`strict`, `noUncheckedIndexedAccess`, no `experimentalDecorators`).
- Root `tsconfig.json` referencing each package (TS project references) — empty composite root for `pnpm -r typecheck` discovery.
- Shared ESLint config base at the root (`.eslintrc.cjs`) plus minimal per-package overrides — full rule set is INF-003's job; this task installs the plumbing only.
- Prettier config (`.prettierrc`) and `.prettierignore`.
- Placeholder `LICENSE` (MIT placeholder; choice deferred) and skeleton `README.md` with one paragraph describing what the repo is and a one-liner to bootstrap (`pnpm install && pnpm -r typecheck`).
- Four empty packages with valid `package.json` + `tsconfig.json` + a single `src/index.ts` stub each:
  - `packages/core` (`@power-budget/core`)
  - `packages/backend` (`@power-budget/backend`)
  - `packages/web` (`@power-budget/web`)
  - `packages/mobile` (`@power-budget/mobile`)
- Root scripts: `build`, `lint`, `test`, `typecheck`, `dev`, `clean` — all delegated to `turbo run <task>`.
- TS path aliases at the base config level so `@power-budget/core` resolves from `packages/core/src` for IDE-time DX (runtime resolution is via the workspace symlinks pnpm creates).

### Out of scope

- Actual implementations inside any package — entity types in core (BE-002), NestJS bootstrap (BE-001), Vite project (WEB-001), Expo project (MOB-001) are separate backlog tasks.
- Full ESLint rule set including `no-restricted-imports` enforcement on `@power-budget/core` — that is **INF-003** (`Blocks: INF-003`). This task only installs the dev dependencies and writes a minimal stub config so `pnpm lint` exits 0.
- Husky / lint-staged pre-commit hooks — also INF-003.
- GitHub Actions CI workflows — **INF-005**.
- `docker-compose.yml`, Postgres, Redis, Mailpit — **INF-004**.
- Drizzle ORM tooling — **INF-008**.
- Dependabot + secret scanning — **INF-007**.
- Turborepo remote cache configuration on GitHub-hosted cache — INF-005.
- Any production deployment config (Fly.io, Neon, Upstash, Cloudflare Pages) — **INF-009 / INF-010 / INF-011**.
- Internationalization runtime, MJML, MobX, Drizzle, NestJS dependencies — installed by the package-owning tasks.

## 3. Files to create / modify

All paths are relative to `/Users/bartimeus/IdeaProjects/power-budget/`.

### Repository root

- `.gitignore` — node, build, OS, IDE, env files. Include `node_modules/`, `dist/`, `.turbo/`, `coverage/`, `.env`, `.env.local`, `.DS_Store`, `.idea/`, `.vscode/` (except `.vscode/extensions.json` if added later), `*.log`, `pnpm-debug.log*`.
- `.editorconfig` — UTF-8, LF, 2-space indent, trim trailing whitespace, final newline.
- `.nvmrc` — `20` (pin to Node 20 LTS).
- `package.json` — root workspace manifest (private, scripts, devDependencies, `packageManager: "pnpm@9.x.y"`).
- `pnpm-workspace.yaml` — declares `packages/*`.
- `turbo.json` — pipeline definition.
- `tsconfig.base.json` — shared strict compiler options + `paths` aliases.
- `tsconfig.json` — root project references manifest (no `files`, only `references`).
- `.eslintrc.cjs` — minimal root config with `@typescript-eslint/parser`, `eslint:recommended`, ignore patterns. INF-003 will extend this.
- `.eslintignore` — `node_modules`, `dist`, `.turbo`, `coverage`, `*.config.js`.
- `.prettierrc` — JSON: `singleQuote`, `trailingComma: "all"`, `printWidth: 100`, `semi: true`, `arrowParens: "always"`.
- `.prettierignore` — same patterns as `.eslintignore` plus `pnpm-lock.yaml`.
- `LICENSE` — MIT placeholder with copyright holder TBD comment.
- `README.md` — 20-line skeleton: name, one-sentence purpose, prerequisites (Node 20 / pnpm 9 via corepack), bootstrap commands, pointer to `docs/mvp/`.

### `packages/core/`

- `packages/core/package.json` — name `@power-budget/core`, `type: "module"`, `main: "dist/index.js"`, `types: "dist/index.d.ts"`, scripts (`build` → `tsc -b`, `lint`, `test`, `typecheck`), `dependencies: {}` (empty by contract — see ARCHITECTURE.md §4 "Banned in `@power-budget/core`").
- `packages/core/tsconfig.json` — extends base, `composite: true`, `rootDir: src`, `outDir: dist`, references none.
- `packages/core/src/index.ts` — single `export {};` stub so `tsc` produces an artefact.
- `packages/core/.eslintrc.cjs` — empty stub extending root (INF-003 adds `no-restricted-imports`).

### `packages/backend/`

- `packages/backend/package.json` — name `@power-budget/backend`, scripts as above, `dependencies: { "@power-budget/core": "workspace:*" }`.
- `packages/backend/tsconfig.json` — extends base, `composite: true`, references `../core`.
- `packages/backend/src/index.ts` — `export {};` stub.
- `packages/backend/.eslintrc.cjs` — stub.

### `packages/web/`

- `packages/web/package.json` — name `@power-budget/web`, `private: true`, scripts as above, `dependencies: { "@power-budget/core": "workspace:*" }`.
- `packages/web/tsconfig.json` — extends base, `composite: true`, references `../core`. `jsx` / `lib` settings are added by WEB-001; for now keep minimal.
- `packages/web/src/index.ts` — `export {};`.
- `packages/web/.eslintrc.cjs` — stub.

### `packages/mobile/`

- `packages/mobile/package.json` — name `@power-budget/mobile`, `private: true`, scripts, `dependencies: { "@power-budget/core": "workspace:*" }`.
- `packages/mobile/tsconfig.json` — extends base, `composite: true`, references `../core`.
- `packages/mobile/src/index.ts` — `export {};`.
- `packages/mobile/.eslintrc.cjs` — stub.

### Lockfile

- `pnpm-lock.yaml` — committed after the first `pnpm install`.

## 4. Key interfaces & contracts

### `pnpm-workspace.yaml`

```yaml
packages:
  - "packages/*"
```

A single glob is sufficient — every workspace package lives under `packages/`. Do not list packages individually (extra maintenance for zero benefit at MVP scale).

### `turbo.json` pipeline

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json", ".eslintrc.cjs"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Notes:

- `^build` topological ordering means `backend`, `web`, `mobile` builds wait for `core` to build first. This is the only dependency arrow in the graph today (per §4 of the architecture doc: every leaf package depends on `core`; nothing depends on the leaves).
- `dev` is `persistent` (long-running) and uncached — Turbo's required modelling for watch processes.
- `globalDependencies` invalidates the cache when the shared TS or ESLint config changes.

### `tsconfig.base.json`

Compiler options that are non-negotiable (INF-002 acceptance criteria are explicit on the first three):

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `experimentalDecorators` — **omitted / false** (ARCHITECTURE.md §3 TypeScript style: "no decorator metadata"; revisit if NestJS adapter layer requires it, but NestJS supports decorator-free providers via explicit registration).
- `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext` (compatible with `type: "module"` + pnpm + ESM-first).
- `esModuleInterop: true`, `forceConsistentCasingInFileNames: true`, `skipLibCheck: true`.
- `noFallthroughCasesInSwitch: true`, `noImplicitOverride: true`, `noPropertyAccessFromIndexSignature: true`.
- `isolatedModules: true` (Vite/SWC compatibility for WEB-001 later).
- `declaration: true`, `declarationMap: true`, `sourceMap: true`, `incremental: true`.
- `paths`:
  ```json
  {
    "@power-budget/core": ["packages/core/src/index.ts"],
    "@power-budget/core/*": ["packages/core/src/*"]
  }
  ```

Path aliases at the base level are for editor/typecheck DX. Runtime resolution happens through the pnpm-created `node_modules/@power-budget/core` symlink, which points at the package's compiled `dist/`. The aliases must therefore be kept in sync with what each leaf package's own `tsconfig.json` resolves to (each leaf can override `paths` if needed).

### Package naming convention

- All workspace packages use the scope `@power-budget/<name>`.
- `<name>` matches the directory name under `packages/`.
- Inter-package deps use the `workspace:*` protocol; pnpm rewrites this to the workspace symlink at install time and to the published version at publish time (publishing is not a concern for MVP).

### Node + pnpm versions

- **Node**: 20 LTS (currently `20.x`). Pinned in `.nvmrc`. The exact patch is left to the developer's Node manager (`nvm`, `fnm`, Volta — all read `.nvmrc`).
- **pnpm**: 9.x, installed via Corepack (`corepack enable && corepack prepare pnpm@9 --activate`). The exact pinned version is set in `package.json` via:
  ```json
  "packageManager": "pnpm@9.12.0"
  ```
  Use whatever patch is current on the day the task is executed; the file commits the resolved patch so all developers and CI agree.

### Scripts contract — every package exposes

| Script      | Purpose                            | Body (initial)                                                                                                    |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `build`     | Produce `dist/` (or app artefacts) | `tsc -b`                                                                                                          |
| `lint`      | Run ESLint against `src/`          | `eslint src --max-warnings 0`                                                                                     |
| `test`      | Run package test suite             | `vitest run` (placeholder — actual runner installed by package-owning task; for now a no-op `echo` is acceptable) |
| `typecheck` | TS check without emit              | `tsc -b --pretty`                                                                                                 |
| `clean`     | Remove build artefacts             | `rm -rf dist .turbo`                                                                                              |

The acceptance criterion "`pnpm turbo run lint typecheck test` runs (no-op acceptable) with caching enabled" explicitly permits stubs. Prefer real `tsc -b` for `build` and `typecheck` (so Turbo can cache them meaningfully) and `eslint` for `lint`; `test` may stub to `node -e "console.log('no tests yet')"` until the package-owning task adds a runner.

## 5. Step-by-step build order

Each step is ≤30 minutes and ends with a verifiable state.

1. **Init git repo** — `cd /Users/bartimeus/IdeaProjects/power-budget && git init && git checkout -b master`. Confirm no existing `.git/` (we already verified). _Result: empty repo on `master`._
2. **Install pnpm via Corepack** — `corepack enable && corepack prepare pnpm@9 --activate`. Capture the resolved version (e.g. `pnpm --version` → `9.12.0`) to use in `packageManager`. _Result: `pnpm` on PATH._
3. **Write `.gitignore`, `.editorconfig`, `.nvmrc`, `LICENSE`, `README.md`** — minimal content per §3 above. _Result: housekeeping files committed-ready._
4. **Write root `package.json`** — private, name `power-budget`, version `0.0.0`, `packageManager`, scripts delegating to `turbo run <task> -- --`, devDependencies: `typescript@^5.5`, `turbo@^2.0`, `eslint@^9`, `@typescript-eslint/parser@^8`, `@typescript-eslint/eslint-plugin@^8`, `prettier@^3`. _Result: root manifest._
5. **Write `pnpm-workspace.yaml`** — single `packages/*` glob. _Result: pnpm now treats `packages/*` as workspace members._
6. **Write `tsconfig.base.json`** — full strictness profile per §4 above. _Result: shared TS contract._
7. **Write `turbo.json`** — pipeline per §4. _Result: orchestration contract._
8. **Write `.eslintrc.cjs`, `.eslintignore`, `.prettierrc`, `.prettierignore`** — stubs only. _Result: lint/format wired but rule-light._
9. **Create root `tsconfig.json`** — `{ "files": [], "references": [{ "path": "packages/core" }, { "path": "packages/backend" }, { "path": "packages/web" }, { "path": "packages/mobile" }] }`. _Result: `tsc -b` from the root walks all four packages._
10. **Scaffold `packages/core`** — `mkdir -p packages/core/src`, write `package.json`, `tsconfig.json`, `src/index.ts` (`export {};`), `.eslintrc.cjs` stub. _Result: core package valid._
11. **Scaffold `packages/backend`** — same template; declare `@power-budget/core` as a `workspace:*` dependency; `tsconfig.json` references `../core`. _Result: backend package valid._
12. **Scaffold `packages/web`** — same template. _Result: web package valid._
13. **Scaffold `packages/mobile`** — same template. _Result: mobile package valid._
14. **Run `pnpm install`** — first install creates `pnpm-lock.yaml`, sets up symlinks under each package's `node_modules`. _Result: install exits 0; lockfile committed-ready._
15. **Run `pnpm -r typecheck`** — every package's `tsc -b` runs. With one empty `index.ts` per package it must exit 0. _Result: typecheck green._
16. **Run `pnpm -r lint`** — every package's `eslint src` runs. With the minimal stub config it must exit 0 (one trivial file per package). _Result: lint green._
17. **Run `pnpm turbo run build`** — Turbo executes `^build` topology: `core` first, then the three leaves in parallel. With `tsc -b` everywhere, the only emitted artefact is `packages/core/dist/index.{js,d.ts}` plus per-leaf empty `dist/`. _Result: build green; observe the topological order in Turbo's terminal output._
18. **Run `pnpm turbo run build` a second time** — confirm full cache hit (`> FULL TURBO`). _Result: caching demonstrably works (INF-002 acceptance criterion)._
19. **Manual path-alias smoke test** — add a temporary `export const ping = 'pong'` to `packages/core/src/index.ts` and `import { ping } from '@power-budget/core'` from `packages/backend/src/index.ts`. Run `pnpm --filter @power-budget/backend typecheck`. Revert both edits once it passes. _Result: cross-package imports resolve through both TS aliases and the pnpm symlink._
20. **Commit** — single commit `INF-002 scaffold pnpm + Turborepo monorepo`. Include all created files plus `pnpm-lock.yaml`. Push to the repo created by INF-001. _Result: commit on `master` (or feature branch per workflow), ready for INF-003._

## 6. Test plan

All checks must pass on a clean clone (`git clone … && cd power-budget && corepack enable && pnpm install`).

- **Deterministic install** — `pnpm install --frozen-lockfile` succeeds. The lockfile was generated on step 14 and must not drift.
- **Typecheck** — `pnpm -r typecheck` exits 0; each package's `tsc -b` produces a `*.tsbuildinfo` cache.
- **Lint** — `pnpm -r lint` exits 0.
- **Test** — `pnpm -r test` exits 0 (no-op stubs acceptable per acceptance criteria).
- **Build** — `pnpm turbo run build` exits 0 and visibly runs `core` before the leaves (check terminal output for ordering).
- **Cache** — A second `pnpm turbo run build` exits 0 with `>>> FULL TURBO` (or per-task `cache hit, replaying logs`). This validates the INF-002 acceptance criterion "caching enabled".
- **Path alias smoke test** — as in step 19; the temporary edit is the one and only manual verification — do not commit it.
- **Negative check — strictness is actually enforced** — temporarily add `const x: any[] = []; const y = x[0]; console.log(y.foo)` in `packages/core/src/index.ts`; with `noUncheckedIndexedAccess: true`, `tsc -b` must error. Revert.
- **Negative check — decorators are off** — temporarily prepend a class with `@SomeDecorator()` in `packages/core/src/index.ts`; `tsc` must error because `experimentalDecorators` is not enabled. Revert.

## 7. Acceptance criteria

Refined from BACKLOG.md INF-002:

- [ ] `pnpm install` succeeds on a clean clone with `--frozen-lockfile`.
- [ ] `pnpm turbo run lint typecheck test` runs (stubs acceptable) and Turbo cache is enabled (second run shows full cache hits).
- [ ] `tsconfig.base.json` sets `strict: true`, `noUncheckedIndexedAccess: true`, and does **not** set `experimentalDecorators: true`. Each package's `tsconfig.json` extends it.
- [ ] `.editorconfig`, `.prettierrc`, `.gitignore` are committed.
- [ ] `pnpm-workspace.yaml` declares `packages/*`; the four packages each have a valid `package.json` (`@power-budget/{core,backend,web,mobile}`) and `tsconfig.json` with `composite: true`.
- [ ] `turbo.json` defines `build`, `dev`, `lint`, `typecheck`, `test` with `^build` topology and matching `outputs`.
- [ ] Backend, web, and mobile packages declare `@power-budget/core` as a `workspace:*` dependency; the path alias `@power-budget/core` resolves both at typecheck time and via the pnpm symlink.
- [ ] Node version is pinned via `.nvmrc` to `20`; pnpm version is pinned via `packageManager: "pnpm@9.x.y"`.
- [ ] `pnpm turbo run build` runs `core` before any leaf (verified by terminal output).

## 8. Open questions / decisions

- **Database ORM scaffolding** — Drizzle vs. Prisma: **decision already made** in ARCHITECTURE.md §4 (Drizzle) and INF-008 owns the tooling install. _This task does nothing about it._
- **Vite / Expo bootstrap** — `packages/web` and `packages/mobile`: keep as bare scaffolds (`package.json`, `tsconfig.json`, `src/index.ts` stub) in INF-002; full Vite init lives in **WEB-001** and Expo init lives in **MOB-001**. Reasoning: a real `vite create` or `expo init` drags in framework-specific deps, config, and Babel/Metro tooling that are wholly out of scope for "scaffold monorepo" and that the package-owning tasks must each design holistically.
- **Package manager lock** — pnpm only. Reject npm / yarn at the root: `engines.npm` is left unset (no need to block), but the `packageManager` field plus Corepack means anyone running `npm install` gets a Corepack warning. Add a one-line `preinstall` script (`node -e "if (!process.env.npm_config_user_agent?.startsWith('pnpm')) { console.error('Use pnpm: corepack enable && pnpm install'); process.exit(1); }"`) for hard enforcement.
- **License** — MIT placeholder for now; final license is a v3 (SaaS) decision. Recorded explicitly so reviewers don't treat it as accidentally pre-chosen.
- **Module system** — every package set to `type: "module"` + `module: NodeNext`. The backend (NestJS, BE-001) historically defaults to CommonJS; verify in BE-001 that NestJS-on-ESM works with our setup or downgrade `packages/backend` to CJS at that point. Not a blocker for INF-002.
- **`paths` aliases in base vs. per-package** — base config carries them for IDE DX; each leaf is free to override. Rationale: TS project references plus pnpm symlinks already provide runtime resolution; aliases are belt-and-braces and easy to remove later if they cause confusion.

## 9. Risks

Top three:

1. **TS project references / `composite` friction in editor and Turbo.** `tsc -b` requires every referenced package to have `composite: true` and `declaration: true`; getting one wrong gives a misleading "cannot find module" error. _Mitigation:_ verify on step 15 with `pnpm -r typecheck`; if a leaf cannot find `@power-budget/core`, the fix is almost always (a) missing `references` entry in the leaf `tsconfig.json` or (b) missing `composite: true` in the core `tsconfig.json`.
2. **pnpm + Corepack version drift between dev machines and CI.** If `packageManager` is set but a developer has not run `corepack enable`, they may resolve a different pnpm patch and silently produce lockfile diff noise. _Mitigation:_ document the bootstrap in `README.md` step 1; INF-005 will pin the same version in the GitHub Actions setup-node step.
3. **Turbo cache poisoning from out-of-tree state.** If `globalDependencies` misses a file that actually affects build output (e.g. `tsconfig.base.json` edits that change emitted code), CI can serve a stale cache. _Mitigation:_ keep `globalDependencies` exhaustive — `tsconfig.base.json` and `.eslintrc.cjs` are listed; revisit when INF-003 adds files that influence lint output.
