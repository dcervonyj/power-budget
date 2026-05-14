# @power-budget/shared-app

Platform-agnostic frontend application layer shared by `packages/web` and `packages/mobile`.

## Role

This package holds all frontend application logic that has **zero platform dependency**:

- **MobX ReactiveViews** — observable state containers (`MobXReactiveView<S>`)
- **Feature contexts** — `createFeatureContext<C>()` factory for typed React contexts
- **MobX `observer` connector** — `connect()` HOC wrapping components in `observer()`
- **NavigationPort** — platform-agnostic navigation interface; adapted by web (React Router) and mobile (React Navigation) in their own packages
- **AppRoute** — typed discriminated union of every route in the app
- **ApiClient** — axios-based `HttpClient` implementation with auth interceptor
- **SecureTokenStore** — port interface for token persistence (implemented per-platform)
- **Feature scaffolds** — empty `application/`, `api/`, `config/`, `ui/connect/` barrels for each of the 8 feature modules

## Feature modules

`auth` · `bank` · `transactions` · `plans` · `categories` · `currency` · `notifications` · `dashboard`

Each feature exposes four sub-directories:

| Sub-dir        | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `application/` | Use cases, selectors, MobX stores                |
| `api/`         | HTTP adapter implementations (`Http*Repo`)       |
| `config/`      | Feature-level configuration constants            |
| `ui/connect/`  | Connected (observer-wrapped) component factories |

## What belongs here vs. platform packages

| Belongs in `shared-app`      | Stays in `web` or `mobile`                    |
| ---------------------------- | --------------------------------------------- |
| `NavigationPort` interface   | React Router / React Navigation adapter       |
| `SecureTokenStore` interface | `localStorage` / `SecureStore` implementation |
| `AppRoute` union             | Route component mapping                       |
| MobX stores and use cases    | Platform-specific providers and layouts       |
| `ApiClient`                  | Token storage implementations                 |

## Consumption

```ts
// web / mobile
import { ApiClient, NavigationPort, AppRoute } from '@power-budget/shared-app';
import {
  MobXReactiveView,
  connect,
  createFeatureContext,
} from '@power-budget/shared-app/infrastructure';
import type { AppRoute } from '@power-budget/shared-app/contract';
```

## Build

```bash
pnpm -F @power-budget/shared-app build      # produces dist/ (ESM + CJS + .d.ts)
pnpm -F @power-budget/shared-app typecheck  # strict TypeScript check
```
