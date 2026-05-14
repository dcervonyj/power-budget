# INF-015 — Scaffold `packages/shared-app` + validate Metro resolver

## 1. Task summary

- **Task ID**: INF-015
- **Title**: Scaffold `packages/shared-app` + validate Metro resolver
- **Area**: Infra
- **Effort**: S (~1d)
- **Blocked by**: INF-002, INF-003, BE-002
- **Blocks**: WEB-001, MOB-001, WEB-003, MOB-003, WEB-004

`@power-budget/shared-app` is the new package that holds all platform-agnostic frontend application logic: MobX ReactiveViews, use cases, selectors, API adapters, `Http*Repo` implementations, context factories, the `NavigationPort` interface, and the `AppRoute` typed route union. It is shared by `packages/web` and `packages/mobile`.

The motivation: the clean architecture's strict layer separation means `application/`, `api/`, `config/`, and `ui/connect/` have zero platform dependency — `createContext` and MobX `observer()` both work identically in React and React Native because React Native *is* React. Writing this code once in `shared-app` instead of once per platform saves an estimated 15–20 person-days across the Wave 13–15 feature work.

This task creates the scaffold (empty barrel structure, build config, NavigationPort, AppRoute stub) and validates that the Metro bundler (React Native's bundler) can resolve the workspace symlink to `shared-app` without errors. This validation must happen before any feature code is written in Wave 5+.

## 2. Scope

**In scope**

- `packages/shared-app/` directory with the full folder structure for all 8 feature modules, each containing empty `application/`, `api/`, `config/`, `ui/connect/` sub-directories.
- `package.json` with:
  - `name: "@power-budget/shared-app"`
  - `dependencies: { "mobx": "^6", "axios": "^1", "react": "^18" }` — React needed for `createContext`; `react-dom` and `react-native` are NOT dependencies (resolved via peer by the consumer).
  - `peerDependencies: { "react": "^18" }` — explicit peer so both web and mobile satisfy it with their own React instance.
  - Dual ESM+CJS build via `tsup`.
- `tsconfig.json` with `"jsx": "react-jsx"` (needed for `createContext` and any JSX in connector files), strict mode flags from `tsconfig.base.json`.
- `NavigationPort` interface in `src/infrastructure/navigation/NavigationPort.ts`.
- `AppRoute` discriminated union stub in `src/contract/routes.ts` (at minimum one route per feature: `{ type: 'auth/login' }`, `{ type: 'dashboard' }`, etc.).
- `MobXReactiveView<S>` implementation in `src/infrastructure/mobx/MobXReactiveView.ts` (extracted from what WEB-003 would have done).
- `connect()` HOC in `src/infrastructure/mobx/connect.ts`.
- `createFeatureContext<C>()` helper in `src/infrastructure/mobx/createFeatureContext.ts`.
- `ApiClient` (`HttpClient` implementation) in `src/infrastructure/api-client/ApiClient.ts` — axios instance with interceptors (auth header injection; 401 → refresh → retry; second 401 → dispatch `LogoutUseCase`). `SecureTokenStore` port injected (not imported directly).
- Metro validation: add `"@power-budget/shared-app": "workspace:*"` to `packages/mobile/package.json`, run a Metro bundle dry-run, confirm clean resolution.
- Update root `pnpm-workspace.yaml` if needed (it already covers `packages/*` so likely no change needed).

**Out of scope**

- Any feature-specific application code (use cases, selectors, state types, HTTP adapters) — those land in the feature wave tasks (Wave 5+).
- Web-specific or mobile-specific infrastructure (token store adapters, navigation adapters, React Router / React Navigation) — those stay in `packages/web` and `packages/mobile`.
- Theming / design tokens — those are in `packages/design-tokens` (DES-001 ✅).
- i18n integration — I18N-002 wires `react-intl` provider in the web consumer, not in `shared-app`.

## 3. Files to create

| Path | Purpose |
|---|---|
| `packages/shared-app/package.json` | Manifest with dependencies, exports, scripts |
| `packages/shared-app/tsconfig.json` | Strict TS + `jsx: react-jsx`, extends base |
| `packages/shared-app/tsup.config.ts` | Dual ESM+CJS+`.d.ts` build (same pattern as `packages/core`) |
| `packages/shared-app/src/index.ts` | Root barrel re-exporting all feature + infrastructure exports |
| `packages/shared-app/src/contract/routes.ts` | `AppRoute` discriminated union stub |
| `packages/shared-app/src/contract/events/index.ts` | Cross-feature event types barrel (empty) |
| `packages/shared-app/src/infrastructure/mobx/MobXReactiveView.ts` | `MobXReactiveView<S>` implementing `ReactiveView<S>` via MobX `makeAutoObservable` |
| `packages/shared-app/src/infrastructure/mobx/connect.ts` | `connect()` HOC wrapping a component in MobX `observer()` |
| `packages/shared-app/src/infrastructure/mobx/createFeatureContext.ts` | `createFeatureContext<C>()` helper (thin wrapper around React `createContext`) |
| `packages/shared-app/src/infrastructure/mobx/index.ts` | Barrel for mobx infra |
| `packages/shared-app/src/infrastructure/api-client/ApiClient.ts` | Axios-based `HttpClient` implementation with auth interceptor |
| `packages/shared-app/src/infrastructure/api-client/index.ts` | Barrel |
| `packages/shared-app/src/infrastructure/navigation/NavigationPort.ts` | `NavigationPort` interface + `AppRoute` import |
| `packages/shared-app/src/infrastructure/navigation/index.ts` | Barrel |
| `packages/shared-app/src/infrastructure/index.ts` | Infrastructure barrel |
| `packages/shared-app/src/<feature>/application/index.ts` | Empty barrel (×8 features) |
| `packages/shared-app/src/<feature>/api/index.ts` | Empty barrel (×8 features) |
| `packages/shared-app/src/<feature>/config/index.ts` | Empty barrel (×8 features) |
| `packages/shared-app/src/<feature>/ui/connect/index.ts` | Empty barrel (×8 features) |
| `packages/shared-app/src/<feature>/index.ts` | Feature barrel re-exporting sub-barrels (×8 features) |
| `packages/shared-app/README.md` | Package role, consumption instructions, what belongs here vs. web/mobile |

## 4. Key contracts

### 4.1 `NavigationPort`

```ts
// src/infrastructure/navigation/NavigationPort.ts
export interface NavigationPort {
  navigate(route: AppRoute): void;
  replace(route: AppRoute): void;
  goBack(): void;
}
```

`AppRoute` is a discriminated union of every typed route in the app. Stub for now:

```ts
// src/contract/routes.ts
export type AppRoute =
  | { type: 'auth/login' }
  | { type: 'auth/register' }
  | { type: 'auth/magic-link' }
  | { type: 'auth/totp-enrolment' }
  | { type: 'onboarding' }
  | { type: 'dashboard'; planId?: string }
  | { type: 'transactions'; filters?: Record<string, string> }
  | { type: 'plans' }
  | { type: 'plans/editor'; planId: string }
  | { type: 'bank-connections' }
  | { type: 'bank-connections/add' }
  | { type: 'categories' }
  | { type: 'settings' };
```

### 4.2 `MobXReactiveView`

```ts
// src/infrastructure/mobx/MobXReactiveView.ts
import { makeAutoObservable } from 'mobx';
import type { ReactiveView } from './types.js';

export class MobXReactiveView<S extends object> implements ReactiveView<S> {
  private _state: S;

  constructor(initialState: S) {
    this._state = initialState;
    makeAutoObservable(this);
  }

  get state(): S {
    return this._state;
  }

  update(partial: Partial<S>): void {
    Object.assign(this._state, partial);
  }
}
```

### 4.3 `connect()` HOC

```ts
// src/infrastructure/mobx/connect.ts
import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';

export function connect<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  return observer(Component);
}
```

### 4.4 `ApiClient` (sketch)

```ts
// src/infrastructure/api-client/ApiClient.ts
import axios, { type AxiosInstance } from 'axios';
import type { HttpClient, HttpRequest, HttpResponse } from './types.js';
import type { SecureTokenStore } from '../tokens/SecureTokenStore.js';

export class ApiClient implements HttpClient {
  private readonly axios: AxiosInstance;

  constructor(
    baseURL: string,
    private readonly tokenStore: SecureTokenStore,
  ) {
    this.axios = axios.create({ baseURL });
    this.axios.interceptors.request.use((config) => {
      const token = this.tokenStore.getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      return config;
    });
    // 401 → refresh → retry logic added in interceptors.response
  }

  // ... HttpClient methods
}
```

## 5. Step-by-step

1. Create `packages/shared-app/` folder tree (all 8 features × 4 sub-dirs + infrastructure dirs).
2. Write `package.json` with correct exports map and dependencies.
3. Write `tsconfig.json` (jsx: react-jsx, strict, extends base).
4. Write `tsup.config.ts` (same pattern as packages/core — dual ESM+CJS, entry per feature barrel + root).
5. Implement `MobXReactiveView`, `connect()`, `createFeatureContext()`, `NavigationPort`, `AppRoute`, `ApiClient` skeleton.
6. Write all empty barrels (index.ts files).
7. Run `pnpm install` to pick up new deps.
8. `pnpm -F @power-budget/shared-app typecheck` → exit 0.
9. `pnpm -F @power-budget/shared-app build` → produces `dist/`.
10. Metro validation: add `"@power-budget/shared-app": "workspace:*"` to `packages/mobile/package.json`, run `pnpm install`, then run a Metro bundle check (or `npx expo export --platform ios --dev` and cancel early — just enough to confirm Metro resolves the package). Fix `watchFolders` in `metro.config.js` if needed.
11. Commit.

## 6. Acceptance criteria

- [ ] `packages/shared-app/` exists with the full folder tree (8 features × 4 sub-dirs, plus infrastructure).
- [ ] `pnpm -F @power-budget/shared-app build` produces dual ESM+CJS+`.d.ts`.
- [ ] `pnpm -F @power-budget/shared-app typecheck` passes.
- [ ] `NavigationPort` committed in `src/infrastructure/navigation/NavigationPort.ts`.
- [ ] `AppRoute` stub committed in `src/contract/routes.ts`.
- [ ] `MobXReactiveView`, `connect()`, `createFeatureContext()`, `ApiClient` skeleton in `src/infrastructure/`.
- [ ] `import { createAuthContext } from '@power-budget/shared-app'` resolves from a sibling package (or from `node -e`).
- [ ] Metro resolves the package in a dry-run without `Unable to resolve module` errors.
