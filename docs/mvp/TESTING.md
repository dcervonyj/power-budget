# Power Budget — Testing Strategy

> **Authoritative source for test tooling, structure, and CI integration across all packages.**
> Architecture decisions live in `ARCHITECTURE.md`; this document owns _how we test_.

---

## 1. Overview

### Philosophy — the test pyramid

```
                 ┌──────────┐
                 │   E2E    │  few, slow, high confidence
                 ├──────────┤
                 │Integration│  per-endpoint, per-slice
                 ├──────────┤
                 │   Unit   │  many, fast, pure logic
                 └──────────┘
```

| Layer        | What it tests                                       | Tooling                                 | Speed       |
| ------------ | --------------------------------------------------- | --------------------------------------- | ----------- |
| Unit         | Pure functions, use-cases (mocked ports), selectors | Vitest                                  | < 5 s total |
| Integration  | HTTP → Controller → Use-Case → DB (real Postgres)   | Vitest + supertest + service containers | 30–90 s     |
| E2E (web)    | Critical user flows in a real browser               | Playwright                              | 2–10 min    |
| E2E (mobile) | Critical flows on simulator/device                  | Maestro                                 | 5–20 min    |

**Core rule**: the unit layer catches _logic bugs_; the integration layer catches _wiring bugs_; E2E catches _regression in user-visible flows_. Never duplicate assertions across layers — push every check to the lowest capable layer.

### Current state (baseline)

| Package                               | Test count                  | Runner           | Status     |
| ------------------------------------- | --------------------------- | ---------------- | ---------- |
| `@power-budget/core`                  | 10 spec files               | Vitest           | ✅ Green   |
| `@power-budget/backend` (unit)        | 50+ spec files              | Vitest           | ✅ Green   |
| `@power-budget/backend` (integration) | 2 spec files (`auth`, `db`) | Vitest + real PG | ✅ Partial |
| `@power-budget/shared-app`            | ~100 spec files             | Vitest           | ✅ Green   |
| `@power-budget/web`                   | 1 smoke test                | Vitest           | ⚠️ Minimal |
| `@power-budget/mobile`                | 0 tests                     | —                | ❌ None    |

Total: **167+ tests** across unit + integration layers. This document defines the gaps and how to close them.

---

## 2. Backend Integration Tests

### 2.1 What is already in place

- `packages/backend/src/test/integration/auth.integration.spec.ts` — register / login / TOTP happy paths against a real Postgres instance.
- `packages/backend/src/test/integration/db.integration.spec.ts` — Drizzle schema smoke tests (connection, table existence).
- `packages/backend/src/test/integration/setup.ts` — shared test module bootstrap and DB teardown helpers.
- `packages/backend/src/test/integration/vitest.integration.config.ts` — separate Vitest config that runs only integration specs, pulls `DATABASE_URL` from env.
- `packages/backend/src/presentation/auth/__tests__/AuthController.spec.ts` — controller unit test with mocked use-cases.
- ESLint custom rule `no-repo-without-scope` (BE-037): enforces every repo call carries `HouseholdScope`.

### 2.2 Gaps

| Gap                                                                             | Risk                                                       | Backlog ref      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| No API-layer integration tests for transactions, plans, bank-connections, audit | High — wiring bugs survive unit tests                      | QA-002 follow-on |
| No cross-tenant assertion tests                                                 | **Critical** — data isolation must be verified before prod | **QA-005**       |
| No migration smoke-test in CI                                                   | Medium — schema drift goes undetected                      | New: QA-010      |
| No outbox/audit transactionality test                                           | Medium — at-least-once delivery untested                   | New: QA-011      |

### 2.3 Recommended tooling

| Tool                       | Purpose                                  | Notes                                                            |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `@nestjs/testing`          | Bootstrap NestJS app in tests            | Already a dep via backend                                        |
| `supertest`                | HTTP assertions against in-memory server | Add as dev dep                                                   |
| GitHub Actions `services:` | Real Postgres 16 in CI                   | Already present in CI yaml                                       |
| `pg-mem` (optional)        | In-memory Postgres for unit-speed tests  | Only for schema-validation tests; prefer real PG for integration |
| Vitest (existing)          | Test runner                              | No change needed                                                 |
| `vitest-mock-extended`     | Typed port mocks                         | Already in use                                                   |

**Do not add `testcontainers`** to the backend — the GitHub Actions service container (`postgres:16.4-alpine`) already provides an identical environment and avoids Docker-in-Docker complexity on CI.

### 2.4 Folder structure (target state)

```
packages/backend/src/test/integration/
├── setup.ts                        # shared NestJS bootstrap + DB helpers (existing)
├── test-helpers.ts                 # seed helpers: createTestUser, createTestHousehold, etc. (existing)
├── vitest.integration.config.ts    # Vitest config for integration suite (existing)
│
├── auth.integration.spec.ts        # ✅ exists — extend with edge cases
├── db.integration.spec.ts          # ✅ exists
│
├── transactions/
│   ├── transactions.integration.spec.ts   # CRUD + filtering + pagination
│   └── tenancy.spec.ts                    # household-A cannot read household-B data
│
├── plans/
│   ├── plans.integration.spec.ts          # create plan / add items / get dashboard
│   └── tenancy.spec.ts
│
├── bank-connections/
│   └── bank-connections.integration.spec.ts
│
├── audit/
│   └── audit.integration.spec.ts          # GET /audit-log, outbox write-in-same-tx
│
└── migrations/
    └── migration-smoke.spec.ts             # run all migrations on fresh DB, assert tables exist
```

### 2.5 API integration test — example structure

```ts
// packages/backend/src/test/integration/transactions/transactions.integration.spec.ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootstrapTestApp, seedTestUser, resetDb } from '../setup';

let app: INestApplication;
let authToken: string;

beforeAll(async () => {
  app = await bootstrapTestApp();
  const { token } = await seedTestUser(app, 'alice@example.com');
  authToken = token;
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  await resetDb(/* tables: */ ['transactions', 'bank_accounts']);
});

describe('GET /transactions', () => {
  it('returns 200 with empty list for new household', async () => {
    await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(0);
        expect(body.total).toBe(0);
      });
  });

  it('returns 401 without auth token', async () => {
    await request(app.getHttpServer()).get('/transactions').expect(401);
  });
});
```

### 2.6 Tenancy spec — cross-household isolation (QA-005)

**One tenancy spec file per endpoint group.** Each file follows the same pattern:

1. Create two independent households (Alice, Bob) via `seedTestUser`.
2. Seed data under Alice's household.
3. Assert Bob's requests return 200 with empty data OR 404 — never Alice's data.
4. Assert Bob's write requests return 403.

```ts
// packages/backend/src/test/integration/transactions/tenancy.spec.ts
import request from 'supertest';
import { bootstrapTestApp, seedTestUser, seedTransaction } from '../setup';

describe('Tenancy isolation — /transactions', () => {
  let app: INestApplication;
  let aliceToken: string;
  let bobToken: string;
  let aliceTxId: string;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    ({ token: aliceToken } = await seedTestUser(app, 'alice@example.com'));
    ({ token: bobToken } = await seedTestUser(app, 'bob@example.com'));
    aliceTxId = await seedTransaction(app, aliceToken);
  });

  afterAll(() => app.close());

  it('Bob cannot list Alice transactions', async () => {
    const res = await request(app.getHttpServer())
      .get('/transactions')
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('Bob cannot read Alice transaction by ID', async () => {
    await request(app.getHttpServer())
      .get(`/transactions/${aliceTxId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(404);
  });

  it('Bob cannot delete Alice transaction', async () => {
    await request(app.getHttpServer())
      .delete(`/transactions/${aliceTxId}`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(403);
  });
});
```

**This suite must be green before any production launch.**

### 2.7 Migration smoke test

```ts
// packages/backend/src/test/integration/migrations/migration-smoke.spec.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

it('all migrations run on a fresh database', async () => {
  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client);
  await expect(migrate(db, { migrationsFolder: './drizzle' })).resolves.not.toThrow();
  await client.end();
});

it('schema includes required tables', async () => {
  const client = postgres(process.env.DATABASE_URL!);
  const result = await client`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
  `;
  const tables = result.map((r) => r.table_name);
  expect(tables).toEqual(
    expect.arrayContaining([
      'users',
      'households',
      'household_members',
      'plans',
      'planned_items',
      'transactions',
      'mappings',
      'bank_connections',
      'notifications_outbox',
    ]),
  );
  await client.end();
});
```

### 2.8 Outbox transactionality test

```ts
// packages/backend/src/test/integration/audit/audit.integration.spec.ts
it('audit event is written in the same transaction as the triggering operation', async () => {
  // Force an error after the domain write but before commit by injecting a
  // mock that throws inside the outbox-write step.
  // Assert that BOTH the domain row AND the outbox row are absent (rolled back).
  // This verifies the outbox pattern is transactional.
});
```

### 2.9 CI integration

The integration tests are already wired into the Turborepo pipeline via a separate script entry in `packages/backend/package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:integration": "vitest run --config src/test/integration/vitest.integration.config.ts"
  }
}
```

The CI `ci.yml` job runs `pnpm turbo run lint typecheck test`. To also run integration tests, add a second job (keeping them separate preserves fast PR feedback):

```yaml
# .github/workflows/ci.yml — add after the existing `ci` job:
integration:
  name: Backend integration tests
  runs-on: ubuntu-latest
  needs: ci # only run if unit/lint/typecheck pass

  services:
    postgres:
      image: postgres:16.4-alpine
      env:
        POSTGRES_USER: power_budget
        POSTGRES_PASSWORD: power_budget
        POSTGRES_DB: power_budget_test
      ports: ['5432:5432']
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  env:
    DATABASE_URL: postgresql://power_budget:power_budget@localhost:5432/power_budget_test

  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm -F @power-budget/backend test:integration
```

---

## 3. Web E2E with Playwright

### 3.1 Rationale for Playwright over Cypress

| Criterion                                 | Playwright                          | Cypress                       |
| ----------------------------------------- | ----------------------------------- | ----------------------------- |
| TypeScript + ESM                          | First-class                         | Partial (ESM tricky)          |
| Multi-browser (Chromium, Firefox, WebKit) | One run                             | Chromium-only on free tier    |
| Auto-waiting                              | Built-in, reliable                  | Built-in, but less granular   |
| Component testing                         | `@playwright/experimental-ct-react` | Cypress CT (separate product) |
| Parallelism                               | Sharded across workers/machines     | Paid Dashboard feature        |
| Bundle size in CI                         | Small                               | Large Electron dependency     |
| Network interception                      | `page.route()`                      | `cy.intercept()`              |
| Performance on CI                         | Faster (no Electron)                | Slower                        |

**Decision: Playwright.** Consistent with the no-I-prefix naming convention's spirit — prefer the simpler, closer-to-the-platform tool.

### 3.2 Installation

```bash
pnpm -F @power-budget/web add -D @playwright/test
# install browser binaries (CI: only chromium to save time)
pnpm -F @power-budget/web exec playwright install chromium
```

Add to `packages/web/package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:debug": "playwright test --debug"
  }
}
```

### 3.3 Folder structure

```
packages/web/
├── e2e/
│   ├── playwright.config.ts
│   ├── fixtures/
│   │   └── auth.fixture.ts           # logged-in page fixture (reused by all suites)
│   ├── auth/
│   │   ├── register.spec.ts
│   │   ├── login.spec.ts
│   │   └── totp.spec.ts
│   ├── transactions/
│   │   ├── list.spec.ts
│   │   └── mapping.spec.ts
│   ├── plans/
│   │   └── dashboard.spec.ts
│   └── smoke.spec.ts                 # fast CI gate: app boots + login works
```

### 3.4 `playwright.config.ts`

```ts
// packages/web/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['github']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Add firefox/webkit for nightly only — keep PR checks fast:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 3.5 Auth fixture (reused across all suites)

```ts
// packages/web/e2e/fixtures/auth.fixture.ts
import { test as base, expect, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e@powerbudget.test';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'TestPass123!';

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL);
    await page.getByLabel('Password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/dashboard');
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### 3.6 Smoke test (runs on every PR, < 30 s)

```ts
// packages/web/e2e/smoke.spec.ts
import { test, expect } from '@playwright/test';

test('app root returns 200', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);
});

test('login page renders key elements', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});

test('health endpoint returns 200', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.status()).toBe(200);
});
```

### 3.7 Auth flow spec (full E2E)

```ts
// packages/web/e2e/auth/login.spec.ts
import { test, expect } from '../fixtures/auth.fixture';

test('successful login redirects to dashboard', async ({ authedPage }) => {
  await expect(authedPage).toHaveURL('/dashboard');
  await expect(authedPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('wrong password shows error', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('e2e@powerbudget.test');
  await page.getByLabel('Password').fill('WrongPassword!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid credentials');
});

test('logout clears session', async ({ authedPage }) => {
  await authedPage.getByRole('button', { name: 'Sign out' }).click();
  await expect(authedPage).toHaveURL('/login');
  // navigating to protected route should redirect back to login
  await authedPage.goto('/dashboard');
  await expect(authedPage).toHaveURL('/login');
});
```

### 3.8 Transaction mapping spec

```ts
// packages/web/e2e/transactions/mapping.spec.ts
import { test, expect } from '../fixtures/auth.fixture';

test('user can map a transaction to a planned item', async ({ authedPage: page }) => {
  await page.goto('/transactions');
  // Assumes at least one unmapped transaction is seeded for the test account
  await page.getByTestId('unmapped-transaction').first().click();
  await page.getByRole('combobox', { name: 'Planned item' }).selectOption('Groceries');
  await page.getByRole('button', { name: 'Save mapping' }).click();
  await expect(page.getByTestId('unmapped-transaction')).toHaveCount(0);
});
```

### 3.9 CI integration

**Two separate workflows:**

**PR gate** — runs smoke tests only (fast, blocks merge):

```yaml
# .github/workflows/e2e-smoke.yml
name: E2E smoke
on:
  pull_request:
    branches: [master]
jobs:
  smoke:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16.4-alpine
        env:
          {
            POSTGRES_USER: power_budget,
            POSTGRES_PASSWORD: power_budget,
            POSTGRES_DB: power_budget,
          }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
      redis:
        image: redis:7.4-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://power_budget:power_budget@localhost:5432/power_budget
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F @power-budget/backend build
      - run: pnpm -F @power-budget/web build
      - run: pnpm -F @power-budget/web exec playwright install --with-deps chromium
      - run: pnpm -F @power-budget/web e2e -- --grep smoke
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: packages/web/playwright-report/
```

**Nightly full E2E** — all specs, multi-browser:

```yaml
# .github/workflows/e2e.yml
name: E2E (full)
on:
  push:
    branches: [master]
  schedule:
    - cron: '0 3 * * *'
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16.4-alpine
        env:
          {
            POSTGRES_USER: power_budget,
            POSTGRES_PASSWORD: power_budget,
            POSTGRES_DB: power_budget,
          }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s --health-retries 5
      redis:
        image: redis:7.4-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://power_budget:power_budget@localhost:5432/power_budget
      REDIS_URL: redis://localhost:6379
      CI: 'true'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -F @power-budget/backend build
      - run: pnpm -F @power-budget/web build
      - run: pnpm -F @power-budget/web exec playwright install --with-deps chromium
      - run: pnpm -F @power-budget/web e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: packages/web/playwright-report/
          retention-days: 7
```

### 3.10 Component testing (add later — P3)

`@playwright/experimental-ct-react` allows testing individual React components in isolation (no full app needed):

```bash
pnpm -F @power-budget/web add -D @playwright/experimental-ct-react
```

Useful for:

- `PlanDashboard` — complex data rendering logic
- `TransactionList` — virtualized list with filtering
- `MappingCombobox` — accessibility and keyboard navigation

---

## 4. Mobile Testing

### 4.1 Context and constraints

Mobile is `packages/mobile` — React Native + Expo (managed workflow). Testing is harder than web because:

- E2E requires a running simulator or physical device.
- Build times are 5–15 minutes per cold run.
- macOS GitHub Actions runners cost ~10× Linux runners.

The three-tier strategy below minimises cost while maintaining meaningful coverage.

### 4.2 Tier 1 — Unit / logic tests (Vitest, zero extra setup)

All shared logic lives in `packages/shared-app` and `packages/core`. These are already tested with Vitest and cover:

- Selectors and derived state
- Use-case state machines
- Pure `@power-budget/core` functions: `computePlanActuals`, `convertMoney`, `Money.*`

**Nothing to add at the mobile package level** — this tier is fully covered by the existing test suite. Add new logic to `shared-app`, not to the mobile package.

### 4.3 Tier 2 — Component tests (Jest + React Native Testing Library)

Tests render components, simulate interactions, and assert accessibility. No simulator required. Runs in 10–30 seconds.

**Setup:**

```bash
pnpm -F @power-budget/mobile add -D jest jest-expo @testing-library/react-native @testing-library/jest-native
```

`packages/mobile/package.json` additions:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "setupFilesAfterFramework": ["@testing-library/jest-native/extend-expect"],
    "transformIgnorePatterns": [
      "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
    ]
  }
}
```

**Folder structure:**

```
packages/mobile/
└── __tests__/
    ├── components/
    │   ├── LoginForm.test.tsx
    │   ├── TransactionRow.test.tsx
    │   └── PlanDashboardCard.test.tsx
    └── screens/
        ├── LoginScreen.test.tsx
        └── DashboardScreen.test.tsx
```

**Example component test:**

```tsx
// packages/mobile/__tests__/components/LoginForm.test.tsx
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginForm } from '../../src/presentation/auth/LoginForm';

describe('LoginForm', () => {
  it('renders email and password fields', () => {
    const { getByLabelText } = render(<LoginForm onSubmit={jest.fn()} />);
    expect(getByLabelText('Email')).toBeTruthy();
    expect(getByLabelText('Password')).toBeTruthy();
  });

  it('calls onSubmit with credentials when form is valid', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByRole } = render(<LoginForm onSubmit={onSubmit} />);

    fireEvent.changeText(getByLabelText('Email'), 'test@example.com');
    fireEvent.changeText(getByLabelText('Password'), 'TestPass123!');
    fireEvent.press(getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'TestPass123!',
      });
    });
  });

  it('shows validation error for empty email', async () => {
    const { getByRole, getByText } = render(<LoginForm onSubmit={jest.fn()} />);
    fireEvent.press(getByRole('button', { name: 'Sign in' }));
    await waitFor(() => {
      expect(getByText('Email is required')).toBeTruthy();
    });
  });
});
```

### 4.4 Tier 3 — E2E with Maestro (recommended)

#### Maestro vs Detox comparison

|                 | **Maestro** ✅                                           | Detox                                    |
| --------------- | -------------------------------------------------------- | ---------------------------------------- |
| Configuration   | YAML flow files, minimal setup                           | Complex native build config per platform |
| Cross-platform  | Same `.yaml` file for iOS + Android                      | Separate config and build steps          |
| CI setup        | `maestro cloud` (SaaS) or `maestro test` on macOS runner | Requires macOS runner + native simulator |
| Iteration speed | Fast: edit YAML, re-run                                  | Slow: recompile on config changes        |
| Stability       | Good, improving rapidly                                  | Mature but historically flaky on CI      |
| Free CI tier    | Maestro Cloud: 100 runs/month free                       | No equivalent                            |
| Learning curve  | Low (YAML)                                               | High (JS config + native knowledge)      |
| App ID binding  | Simple `appId` in YAML                                   | Complex build scheme wiring              |

**Decision: Maestro** for MVP. Revisit Detox only if Maestro Cloud limits are hit or test complexity demands JS-level assertions.

> See also: `docs/mvp/adr/` — ADR QA-004 defers Detox.

#### Installation

```bash
# macOS dev machine
brew tap mobile-dev-inc/tap && brew install maestro

# Or via curl (Linux CI)
curl -Ls "https://get.maestro.mobile.dev" | bash
```

#### Folder structure

```
packages/mobile/
└── e2e/
    └── flows/
        ├── auth.yaml
        ├── transactions.yaml
        └── plan-dashboard.yaml
```

#### Auth flow

```yaml
# packages/mobile/e2e/flows/auth.yaml
appId: com.powerbudget.app
---
- launchApp:
    clearState: true
- assertVisible: 'Email'
- tapOn: 'Email'
- inputText: 'e2e@powerbudget.test'
- tapOn: 'Password'
- inputText: 'TestPass123!'
- tapOn:
    text: 'Sign In'
- assertVisible: 'Dashboard'
- assertNotVisible: 'Sign In'
```

#### Transaction flow

```yaml
# packages/mobile/e2e/flows/transactions.yaml
appId: com.powerbudget.app
---
- launchApp
- runFlow: ./auth.yaml
- tapOn: 'Transactions'
- assertVisible: 'Transactions'
- tapOn:
    id: 'unmapped-transaction-0'
- assertVisible: 'Map to planned item'
- tapOn: 'Planned item'
- assertVisible: 'Groceries'
- tapOn: 'Groceries'
- tapOn: 'Save'
- assertNotVisible: 'Map to planned item'
```

#### CI for mobile (cost-controlled)

```yaml
# .github/workflows/mobile-e2e.yml
name: Mobile E2E (Maestro)
on:
  push:
    branches: [master]
  schedule:
    - cron: '0 4 * * *' # nightly only — macOS runners are expensive

jobs:
  maestro:
    runs-on: macos-latest # required for iOS simulator
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile.dev" | bash
      - name: Build Expo app for simulator
        working-directory: packages/mobile
        run: npx expo run:ios --configuration Release --simulator "iPhone 16"
      - name: Run Maestro flows
        run: ~/.maestro/bin/maestro test packages/mobile/e2e/flows/
```

**Alternative (cheaper):** Use **Maestro Cloud** (`maestro cloud --app-file build.app packages/mobile/e2e/flows/`) to avoid macOS runner costs. Free tier: 100 runs/month.

---

## 5. Implementation priority

| Priority | Item                                          | Package | Effort | Blocker for                    |
| -------- | --------------------------------------------- | ------- | ------ | ------------------------------ |
| **P0**   | Backend tenancy spec — all endpoint groups    | backend | M      | **Production launch** (QA-005) |
| **P0**   | Web Playwright smoke test (3 tests)           | web     | S      | PR safety net                  |
| **P1**   | Backend API integration: transactions + plans | backend | M      | Confidence in wiring           |
| **P1**   | Web Playwright auth + transaction E2E         | web     | M      | WEB-005                        |
| **P1**   | Mobile Tier 2 component tests (RNTL)          | mobile  | S      | MOB-005                        |
| **P2**   | Backend migration smoke test in CI            | backend | S      | Schema drift prevention        |
| **P2**   | Web Playwright plan dashboard E2E             | web     | M      | WEB-008                        |
| **P2**   | Mobile Maestro auth flow                      | mobile  | S      | MOB-005                        |
| **P3**   | Nightly full E2E workflow                     | web     | S      | All above                      |
| **P3**   | Mobile Maestro Cloud CI                       | mobile  | S      | MOB-005                        |
| **P3**   | Web component tests (Playwright CT)           | web     | M      | —                              |

**Effort key:** S = < 1 day, M = 1–3 days, L = 3–5 days.

---

## 6. Proposed new BACKLOG entries

These entries extend `docs/mvp/BACKLOG.md`. Add them to the relevant wave.

| ID         | Title                                                 | Area | Depends on                      |
| ---------- | ----------------------------------------------------- | ---- | ------------------------------- |
| **QA-003** | Web Playwright setup + smoke tests                    | QA   | WEB scaffold                    |
| **QA-004** | Web Playwright auth + transaction E2E                 | QA   | QA-003                          |
| **QA-005** | Backend API tenancy spec — every endpoint group       | QA   | **Already in backlog** (Wave 8) |
| **QA-006** | Mobile component tests (React Native Testing Library) | QA   | MOB scaffold                    |
| **QA-007** | Mobile Maestro E2E auth + transaction flows           | QA   | QA-006, MOB-005                 |
| **QA-008** | Nightly E2E CI workflow (web + backend)               | QA   | QA-003, QA-004                  |
| **QA-010** | Backend DB migration smoke test in CI                 | QA   | INF-002                         |
| **QA-011** | Backend outbox transactionality test                  | QA   | BE-028 (outbox pattern)         |

> Note: `QA-003` and `QA-006` through `QA-008` are **new** entries not yet in the backlog. `QA-005` already exists in Wave 8 and is referenced here for completeness. `QA-010` and `QA-011` are also new.

---

## 7. Quick reference — running tests locally

```bash
# All unit tests (every package)
pnpm test

# Backend unit tests only
pnpm -F @power-budget/backend test

# Backend integration tests (requires local Postgres via docker compose)
pnpm dev:db:up
DATABASE_URL=postgresql://power_budget:power_budget@localhost:5432/power_budget \
  pnpm -F @power-budget/backend test:integration

# Core / shared-app
pnpm -F @power-budget/core test
pnpm -F @power-budget/shared-app test

# Web Playwright smoke (requires dev server)
pnpm -F @power-budget/web e2e -- --grep smoke

# Web Playwright full suite (interactive UI)
pnpm -F @power-budget/web e2e:ui

# Mobile component tests
pnpm -F @power-budget/mobile test

# Mobile Maestro E2E (requires booted iOS simulator + built app)
~/.maestro/bin/maestro test packages/mobile/e2e/flows/
```
