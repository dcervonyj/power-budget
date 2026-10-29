# @power-budget/shared-app

Platform-agnostic frontend application layer shared by `packages/web` and `packages/mobile`.

## Role

This package is the **client SDK** shared by `packages/web` and `packages/mobile`. It holds only code with zero platform dependency:

- **Generated API contract** (`contract/`) — OpenAPI types and `AppRoute`; the single source of truth for request and response shapes
- **ApiClient / HttpClient** (`infrastructure/api-client`) — fetch-based `HttpClient` with token header and refresh on 401; `readApiError` / `ApiError` / `HttpError`
- **Typed API clients** — `PlansApi` (`plans/api`), `CategoriesApi` (`categories/api`), `HouseholdsApi` (`households/api`)
- **Ports** — `SecureTokenStore` (token persistence) and `Navigator` (navigation); each platform implements them in its own package
- **Design contract** (`design/`) — DSN tokens and money-part formatting used by the restyled screens

MobX stores stay in `packages/web/src/application` for now; moving them here is tracked separately (CLN-070).

## What belongs here vs. platform packages

| Belongs in `shared-app`       | Stays in `web` or `mobile`                    |
| ----------------------------- | --------------------------------------------- |
| `Navigator` interface         | React Router / React Navigation adapter       |
| `SecureTokenStore` interface  | `localStorage` / `SecureStore` implementation |
| Generated contract and routes | Route component mapping                       |
| `ApiClient`, `*Api` clients   | Token storage implementations                 |

## Consumption

```ts
// web / mobile
import { ApiClient, PlansApi } from '@power-budget/shared-app';
import type { HttpClient, Navigator } from '@power-budget/shared-app/infrastructure';
import type { components } from '@power-budget/shared-app/contract';
```

## Build

```bash
pnpm -F @power-budget/shared-app build      # produces dist/ (ESM + CJS + .d.ts)
pnpm -F @power-budget/shared-app typecheck  # strict TypeScript check
```
