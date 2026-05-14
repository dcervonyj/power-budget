# BE-003 — Core domain types: branded IDs + value objects

## 1. Task summary

- **ID**: BE-003
- **Title**: Core domain types — branded IDs + value objects
- **Area**: Backend
- **Effort**: M (~2d)
- **Blocked by**: BE-002 (`@power-budget/core` scaffolded with ESM build + import-restriction lint)
- **Blocks**: BE-004 (entity types), BE-005 (Drizzle schema infers from these), BE-006/007/008/009/010 (every core pure-logic task), and every domain task in `packages/backend`, `packages/web`, `packages/mobile`.

This task lays down the **shared vocabulary** that every other package consumes. Per ARCHITECTURE.md §4 ("What lives in each package"), `@power-budget/core` is the single source of truth for domain language and must remain pure TypeScript — no React, NestJS, Drizzle, axios, Node `fs`/`crypto`, no `Date.now()`, no singletons. Per ARCHITECTURE.md §5 ("Domain Sections"), each domain (auth, bank, transactions, plans, categories, currency, notifications, i18n, dashboard) explicitly states "Domain types from `@power-budget/core`", which means all branded IDs, value objects, enums, and entity shapes that these domains exchange must live here. The discipline ("the arrow always points inward") is enforced by the empty `dependencies: {}` of the package set up in BE-002.

BE-003 covers **branded IDs + value objects + enums + ICU-flavoured locale + Money/Currency**. BE-004 (immediately downstream) defines the **entity interfaces** that compose those primitives. The split makes BE-003 a tight foundational PR (~2 d) that unblocks the broader entity work and the Drizzle schema in BE-005.

---

## 2. Scope

### In scope

- **Branded ID types** for every entity referenced in ARCHITECTURE.md §4 / §5 / §8:
  - `UserId`, `HouseholdId`, `HouseholdMemberId`, `SessionId`, `AuthMethodId`, `TotpSecretId`, `HouseholdInviteId`
  - `BankConnectionId`, `BankAccountId`, `SyncRunId`, `BankId` (provider-bank composite key), `BankProvider`
  - `TransactionId`, `TransactionMappingId`, `TransferId`, `IngestBatchId`
  - `PlanId`, `PlannedItemId`, `PlannedItemVersionId`, `LeftoverSnapshotId`
  - `CategoryId`, `CategoryPrivacyId`
  - `FxRateId`
  - `NotificationEventId`, `ExportId`, `AuditEventId`
- **Value objects**:
  - `Money` (amount minor-units `bigint` + `CurrencyCode`) with `add`, `sub`, `negate`, `multiply`, `compare`, `equals`, `isZero`, plus guards rejecting cross-currency operations.
  - `Currency` static record (ISO 4217 code + minor-unit exponent + display symbol).
  - `DateRange` (`start: IsoDate; end: IsoDate`) with `contains`, `overlaps`, `lengthInDays`.
  - `EncryptedString` (branded ciphertext per §5.10) — type only, no encrypt/decrypt logic.
  - `IsoDate` (`YYYY-MM-DD`) and `IsoDateTime` (`YYYY-MM-DDTHH:mm:ssZ`) branded strings — see §8 decision.
- **Enums / discriminated-union tags** (literal-union form):
  - `BankProvider` = `'gocardless' | 'wise_personal'`
  - `ConsentLifecycle` = `'pending' | 'active' | 'expiring' | 'expired' | 'disconnected'`
  - `TransactionSource` = `'bank' | 'manual'`
  - `PlanType` = `'personal' | 'household'`
  - `PlanPeriodKind` = `'weekly' | 'monthly' | 'custom'`
  - `PlannedDirection` = `'income' | 'expense'`
  - `CategoryPrivacyLevel` = `'total_only' | 'total_with_counts' | 'full_detail'`
  - `NotificationKind` = `'bank_reconnect_due' | 'bank_consent_expired' | 'weekly_digest' | 'over_budget_80' | 'over_budget_100'`
  - `HouseholdRole` = `'owner' | 'member'`
  - `AuthMethodKind` = `'password' | 'magic_link' | 'google_oauth'`
- **`LocaleCode`** (closed literal union `'en' | 'uk' | 'ru' | 'pl'`) — per ARCHITECTURE.md §5.8 ("`LocaleCode` — `'en' | 'uk' | 'ru' | 'pl'` in MVP").
- **`PlanPeriod`** as a discriminated union (see §4) — the structural shape; concrete `Plan` is BE-004.
- Light **helper constructors** (e.g. `UserId.of(s: string): UserId`) that validate string shape (non-empty; UUIDv7 regex per §8) — pure, no I/O.

### Out of scope (explicitly NOT this task)

- **Entity interfaces** (`User`, `Plan`, `Transaction`, etc.) — those compose IDs + value objects and ship in **BE-004**.
- **Persistence schema** — Drizzle table definitions and `InferModel`-derived row types live in `packages/backend/drizzle/` per ARCHITECTURE.md §8 (BE-005).
- **DTOs / wire-format types** — REST DTOs derive from entity types later; not here.
- **Validation libraries** (zod, valibot) integration — runtime validation is a separate future task. Helper constructors do hand-rolled shape checks only.
- **Domain services / pure functions** (`computePlanActuals`, `convertMoney`, `aggregateByCategoryWithPrivacy`, formatters) — BE-006 through BE-010.
- **`FxRateTable`** structure — though referenced here as a port input, its definition belongs with `FxRate` in BE-004 (it is an entity-shaped snapshot).
- **`RequestContext` / `HouseholdScope`** value object — defined as a backend cross-cutting concern in §5.10; goes with BE-011 / BE-014, not core.

---

## 3. Files to create / modify

All paths are under `packages/core/src/`. One file per concept where it earns its keep; small siblings grouped. ARCHITECTURE.md §4 sketches `src/{domain,logic,ids.ts,index.ts}` — we expand `domain/` into per-domain subdirectories so BE-004 has obvious slots to drop entity files into.

### Shared primitives

- `domain/shared/ids.ts` — branded ID type helper (`Brand<T, B>`), plus the `defineId<Brand>()` factory used by every per-domain `ids.ts` file (see §4 for the pattern). Exports `UserId`, `HouseholdId`, `HouseholdMemberId`, `SessionId`, `AuthMethodId`, `TotpSecretId`, `HouseholdInviteId`, etc. — _no_, scratch that: this file exports **only the helper**; each domain owns its own IDs.
  - Final shape: `Brand<T, B>` type, `defineId<Brand extends string>()` factory, `IsoDate`, `IsoDateTime`, `Uuidv7` branded primitives.
- `domain/shared/currency.ts` — `CurrencyCode` literal union (MVP currencies + open-ended `string & {}` widening for v3 expansion — see §8 decision), `Currency` record type, `CURRENCIES` const registry (`PLN`, `EUR`, `USD`, `GBP`, `UAH`, `RUB`, `CHF`, `CZK`, `SEK`, `NOK`, `DKK` for MVP "interesting" coverage), `getCurrency(code): Currency`, `isSupportedCurrency(code): code is CurrencyCode`.
- `domain/shared/money.ts` — `Money` value object (`{ readonly amountMinor: bigint; readonly currency: CurrencyCode }`) + namespace with pure ops (`Money.of`, `Money.zero`, `Money.add`, `Money.sub`, `Money.negate`, `Money.multiply`, `Money.equals`, `Money.compare`, `Money.isZero`, `Money.assertSameCurrency`). Throws `CurrencyMismatchError` on cross-currency arithmetic.
- `domain/shared/date-range.ts` — `IsoDate` brand re-exported, `DateRange` value object, `DateRange.of`, `DateRange.contains`, `DateRange.overlaps`, `DateRange.lengthInDays`. All math via ISO strings (no `Date` objects exposed).
- `domain/shared/locale.ts` — `LocaleCode` closed literal union, `SUPPORTED_LOCALES` const tuple, `DEFAULT_LOCALE = 'en'`, `isSupportedLocale(s: string): s is LocaleCode`.
- `domain/shared/encrypted-string.ts` — `EncryptedString` brand only; no operations.
- `domain/shared/errors.ts` — `CurrencyMismatchError`, `InvalidIdError`, `InvalidLocaleError`. Plain `Error` subclasses, no Node-specific imports.

### Per-domain ID barrels (entities deferred to BE-004)

Each of these files defines **only the branded IDs and enums** for the domain — entity interfaces will be added next to them by BE-004.

- `domain/auth/ids.ts` — `UserId`, `HouseholdId`, `HouseholdMemberId`, `SessionId`, `AuthMethodId`, `TotpSecretId`, `HouseholdInviteId`, `MagicLinkTokenId`.
- `domain/auth/enums.ts` — `AuthMethodKind`, `HouseholdRole`.
- `domain/bank/ids.ts` — `BankConnectionId`, `BankAccountId`, `SyncRunId`. `BankProvider` and `BankId` (composite key, see §4) live in `domain/bank/enums.ts`.
- `domain/bank/enums.ts` — `BankProvider`, `ConsentLifecycle`.
- `domain/transactions/ids.ts` — `TransactionId`, `TransactionMappingId`, `TransferId`, `IngestBatchId`.
- `domain/transactions/enums.ts` — `TransactionSource`.
- `domain/plans/ids.ts` — `PlanId`, `PlannedItemId`, `PlannedItemVersionId`, `LeftoverSnapshotId`.
- `domain/plans/enums.ts` — `PlanType`, `PlanPeriodKind`, `PlannedDirection`.
- `domain/plans/period.ts` — `PlanPeriod` discriminated union (see §4) — depends only on `IsoDate`.
- `domain/categories/ids.ts` — `CategoryId`, `CategoryPrivacyId`.
- `domain/categories/enums.ts` — `CategoryPrivacyLevel`.
- `domain/currency/ids.ts` — `FxRateId`.
- `domain/notifications/ids.ts` — `NotificationEventId`, `ExportId`.
- `domain/notifications/enums.ts` — `NotificationKind`.
- `domain/audit/ids.ts` — `AuditEventId`.

### Barrels

- `domain/shared/index.ts` — re-exports the shared primitives.
- `domain/auth/index.ts`, `domain/bank/index.ts`, … (one per domain) — re-export ids + enums.
- `domain/index.ts` — re-exports every domain barrel.
- `src/index.ts` — re-exports `domain/*` and (later) `logic/*`. Public API root.

### Tests

- `__tests__/ids.test.ts` (per domain or one shared) — assignability via `expect-type` or `tsd`.
- `__tests__/money.test.ts` — arithmetic, cross-currency rejection, zero, equals, compare, multiply.
- `__tests__/date-range.test.ts` — contains, overlaps, length.
- `__tests__/locale.test.ts` — `isSupportedLocale` for the four MVP codes + fallback.
- `__tests__/currency.test.ts` — registry lookup, `isSupportedCurrency`.
- `__tests__/public-api.test.ts` — snapshot of the surface exported from `src/index.ts`.

### Modifications outside `packages/core/`

- None. BE-002 already wires `workspace:*` consumption from backend/web/mobile; no other package imports anything yet.

---

## 4. Key interfaces & contracts

### 4.1 Branded ID pattern

The branding pattern is the same one ARCHITECTURE.md §4 calls out verbatim: `string & { readonly __brand: '<Name>Id' }`. We add a `defineId` factory so each ID gets a consistent shape constructor without copy-paste.

```ts
// domain/shared/ids.ts

export type Brand<T, B extends string> = T & { readonly __brand: B };

// UUIDv7 per ARCHITECTURE.md §8. Validation is shape-only — no parsing.
const UUIDV7_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface IdNamespace<B extends string> {
  of(raw: string): Brand<string, B>;
  isValid(raw: string): boolean;
  readonly brand: B;
}

export const defineId = <B extends string>(brand: B): IdNamespace<B> => ({
  brand,
  isValid(raw) {
    return typeof raw === "string" && UUIDV7_RE.test(raw);
  },
  of(raw) {
    if (!this.isValid(raw)) {
      throw new InvalidIdError(brand, raw);
    }

    return raw as Brand<string, B>;
  },
});
```

Per-domain usage:

```ts
// domain/auth/ids.ts
import { Brand, defineId } from "../shared/ids";

export type UserId = Brand<string, "UserId">;
export const UserId = defineId("UserId");

export type HouseholdId = Brand<string, "HouseholdId">;
export const HouseholdId = defineId("HouseholdId");
```

This produces both a type (`UserId`) and a runtime value namespace (`UserId.of(...)`), exactly mirroring the acceptance criterion in BACKLOG.md §BE-003 ("`UserId` is `string & { readonly __brand: 'UserId' }`; not assignable to `HouseholdId`").

### 4.2 `Money`

Minor-units `bigint` per the BE-003 description ("`Money` value object (bigint minor units + ISO 4217)") and §8 decision-record below.

```ts
// domain/shared/money.ts
import { CurrencyCode, getCurrency } from "./currency";
import { CurrencyMismatchError } from "./errors";

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
}

export const Money = {
  of(amountMinor: bigint, currency: CurrencyCode): Money {
    return { amountMinor, currency };
  },

  zero(currency: CurrencyCode): Money {
    return { amountMinor: 0n, currency };
  },

  add(a: Money, b: Money): Money {
    Money.assertSameCurrency(a, b);

    return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
  },

  sub(a: Money, b: Money): Money {
    Money.assertSameCurrency(a, b);

    return { amountMinor: a.amountMinor - b.amountMinor, currency: a.currency };
  },

  negate(m: Money): Money {
    return { amountMinor: -m.amountMinor, currency: m.currency };
  },

  // Integer-only scalar multiply (e.g. line-item count). Float multiplication
  // is deliberately not provided — use FX conversion via dedicated `convertMoney`.
  multiply(m: Money, factor: bigint): Money {
    return { amountMinor: m.amountMinor * factor, currency: m.currency };
  },

  equals(a: Money, b: Money): boolean {
    return a.currency === b.currency && a.amountMinor === b.amountMinor;
  },

  compare(a: Money, b: Money): -1 | 0 | 1 {
    Money.assertSameCurrency(a, b);
    if (a.amountMinor < b.amountMinor) {
      return -1;
    }
    if (a.amountMinor > b.amountMinor) {
      return 1;
    }

    return 0;
  },

  isZero(m: Money): boolean {
    return m.amountMinor === 0n;
  },

  assertSameCurrency(a: Money, b: Money): void {
    if (a.currency !== b.currency) {
      throw new CurrencyMismatchError(a.currency, b.currency);
    }
  },
};
```

Note: no division — cross-currency rate conversion goes through BE-007 `convertMoney` with a `FxRateTable`, not via `Money` itself. This keeps `Money` integer-pure.

### 4.3 `Currency`

```ts
// domain/shared/currency.ts

// MVP closed set — extend by adding rows here. v3 may widen to open-ended.
export type CurrencyCode =
  | "PLN"
  | "EUR"
  | "USD"
  | "GBP"
  | "UAH"
  | "RUB"
  | "CHF"
  | "CZK"
  | "SEK"
  | "NOK"
  | "DKK";

export interface Currency {
  readonly code: CurrencyCode;
  readonly exponent: 0 | 2 | 3; // minor-unit decimal places
  readonly symbol: string;
}

export const CURRENCIES: Readonly<Record<CurrencyCode, Currency>> = {
  PLN: { code: "PLN", exponent: 2, symbol: "zł" },
  EUR: { code: "EUR", exponent: 2, symbol: "€" },
  USD: { code: "USD", exponent: 2, symbol: "$" },
  GBP: { code: "GBP", exponent: 2, symbol: "£" },
  UAH: { code: "UAH", exponent: 2, symbol: "₴" },
  RUB: { code: "RUB", exponent: 2, symbol: "₽" },
  CHF: { code: "CHF", exponent: 2, symbol: "CHF" },
  CZK: { code: "CZK", exponent: 2, symbol: "Kč" },
  SEK: { code: "SEK", exponent: 2, symbol: "kr" },
  NOK: { code: "NOK", exponent: 2, symbol: "kr" },
  DKK: { code: "DKK", exponent: 2, symbol: "kr" },
};

export const isSupportedCurrency = (s: string): s is CurrencyCode =>
  s in CURRENCIES;

export const getCurrency = (code: CurrencyCode): Currency => CURRENCIES[code];
```

### 4.4 `LocaleCode`

Per ARCHITECTURE.md §5.8 — closed literal union for MVP (decision rationale in §8).

```ts
// domain/shared/locale.ts

export type LocaleCode = "en" | "uk" | "ru" | "pl";

export const SUPPORTED_LOCALES: ReadonlyArray<LocaleCode> = [
  "en",
  "uk",
  "ru",
  "pl",
];

export const DEFAULT_LOCALE: LocaleCode = "en";

export const isSupportedLocale = (s: string): s is LocaleCode =>
  (SUPPORTED_LOCALES as ReadonlyArray<string>).includes(s);
```

### 4.5 `PlanPeriod` discriminated union

Per PRD §4.5 ("Weekly / Monthly / Custom date range") and ARCHITECTURE.md §5.4 (`Plan.periodKind`).

```ts
// domain/plans/period.ts
import { IsoDate } from "../shared/ids";

export type PlanPeriod =
  | { readonly kind: "weekly"; readonly start: IsoDate; readonly end: IsoDate }
  | { readonly kind: "monthly"; readonly start: IsoDate; readonly end: IsoDate }
  | { readonly kind: "custom"; readonly start: IsoDate; readonly end: IsoDate };

export type PlanPeriodKind = PlanPeriod["kind"];
```

`PlanPeriodKind` is **derived** from the union — no separate enum to drift.

### 4.6 `DateRange`

```ts
// domain/shared/date-range.ts

export type IsoDate = Brand<string, "IsoDate">;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const IsoDate = {
  of(s: string): IsoDate {
    if (!ISO_DATE_RE.test(s)) {
      throw new InvalidIdError("IsoDate", s);
    }

    return s as IsoDate;
  },
};

export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export const DateRange = {
  of(start: IsoDate, end: IsoDate): DateRange {
    if (start > end) {
      throw new Error("DateRange.start must be <= end");
    }

    return { start, end };
  },

  contains(r: DateRange, d: IsoDate): boolean {
    return r.start <= d && d <= r.end;
  },

  overlaps(a: DateRange, b: DateRange): boolean {
    return a.start <= b.end && b.start <= a.end;
  },

  lengthInDays(r: DateRange): number {
    const ms =
      Date.parse(`${r.end}T00:00:00Z`) - Date.parse(`${r.start}T00:00:00Z`);

    return Math.round(ms / 86_400_000) + 1;
  },
};
```

### 4.7 Enums (literal unions)

All enums are literal unions, never TypeScript `enum`. Reason: literal unions erase at compile time (zero runtime cost), discriminate cleanly with `switch`, and serialise as plain strings over the wire.

```ts
// domain/transactions/enums.ts
export type TransactionSource = "bank" | "manual";

// domain/plans/enums.ts
export type PlanType = "personal" | "household";
export type PlannedDirection = "income" | "expense";

// domain/categories/enums.ts
export type CategoryPrivacyLevel =
  | "total_only"
  | "total_with_counts"
  | "full_detail";

// domain/notifications/enums.ts
export type NotificationKind =
  | "bank_reconnect_due"
  | "bank_consent_expired"
  | "weekly_digest"
  | "over_budget_80"
  | "over_budget_100";

// domain/bank/enums.ts
export type BankProvider = "gocardless" | "wise_personal";
export type ConsentLifecycle =
  | "pending"
  | "active"
  | "expiring"
  | "expired"
  | "disconnected";

// domain/auth/enums.ts
export type AuthMethodKind = "password" | "magic_link" | "google_oauth";
export type HouseholdRole = "owner" | "member";
```

### 4.8 Audit fields convention (documentation only — entity shapes are BE-004)

Every entity defined in BE-004 will use these shared field conventions, which BE-003 establishes via the supporting primitives:

- Identity: `readonly id: <DomainId>` — branded ID from BE-003.
- Tenancy: `readonly householdId: HouseholdId` for every tenant-scoped entity (auth-only `User` is the exception).
- Audit: `readonly createdAt: IsoDateTime; readonly updatedAt: IsoDateTime;` where the schema in §8 carries `created_at`.
- All fields `readonly`.

The entity interfaces themselves are not in this PR (BE-004) but the primitives they need (`HouseholdId`, `IsoDateTime`, branded IDs) are all delivered here.

---

## 5. Step-by-step build order

Each step is ≤30 minutes. Order matters: shared primitives first, then per-domain IDs / enums in dependency order (a domain's IDs depend only on shared primitives; no domain's IDs depend on another's). Tests can be written alongside each step or batched at the end of each section — the order below interleaves them where the cost is low.

### Phase A — Shared primitives (foundation)

1. Create `src/domain/shared/errors.ts` — `InvalidIdError`, `CurrencyMismatchError`, `InvalidLocaleError`.
2. Create `src/domain/shared/ids.ts` — `Brand`, `defineId`, `Uuidv7` regex, `IsoDate`, `IsoDateTime` brands + their `.of` constructors.
3. Unit test: `__tests__/ids.test.ts` — UUIDv7 validation positive + negative cases; brand assignability via `expect-type`.
4. Create `src/domain/shared/currency.ts` — `CurrencyCode`, `Currency`, `CURRENCIES`, `isSupportedCurrency`, `getCurrency`.
5. Unit test: `__tests__/currency.test.ts` — registry exhaustiveness and type-guard behaviour.
6. Create `src/domain/shared/money.ts` — `Money` interface + namespace ops.
7. Unit test: `__tests__/money.test.ts` — covers `add`, `sub`, `negate`, `multiply`, `equals`, `compare`, `isZero`, `assertSameCurrency` (rejection path).
8. Create `src/domain/shared/date-range.ts` — `IsoDate` (already brand-defined), `DateRange` ops.
9. Unit test: `__tests__/date-range.test.ts` — `contains`, `overlaps`, `lengthInDays`, invalid-range rejection.
10. Create `src/domain/shared/locale.ts` — `LocaleCode`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `isSupportedLocale`.
11. Unit test: `__tests__/locale.test.ts` — guard behaviour for all four MVP codes + a rejected `'de'`.
12. Create `src/domain/shared/encrypted-string.ts` — type-only brand for §5.10 ports.
13. Create `src/domain/shared/index.ts` barrel.

### Phase B — Auth domain IDs + enums

14. Create `src/domain/auth/ids.ts` — `UserId`, `HouseholdId`, `HouseholdMemberId`, `SessionId`, `AuthMethodId`, `TotpSecretId`, `HouseholdInviteId`, `MagicLinkTokenId`.
15. Create `src/domain/auth/enums.ts` — `AuthMethodKind`, `HouseholdRole`.
16. Create `src/domain/auth/index.ts` barrel.
17. Add cross-brand non-assignability test: `UserId` not assignable to `HouseholdId` (BACKLOG.md §BE-003 acceptance criterion).

### Phase C — Categories (depends on `HouseholdId` only, but logically before plans)

18. Create `src/domain/categories/ids.ts` — `CategoryId`, `CategoryPrivacyId`.
19. Create `src/domain/categories/enums.ts` — `CategoryPrivacyLevel`.
20. Create `src/domain/categories/index.ts` barrel.

### Phase D — Bank domain

21. Create `src/domain/bank/ids.ts` — `BankConnectionId`, `BankAccountId`, `SyncRunId`.
22. Create `src/domain/bank/enums.ts` — `BankProvider`, `ConsentLifecycle`.
23. `BankId` is a composite key `${BankProvider}:${string}` — type alias in `domain/bank/enums.ts` (e.g. `gocardless:PKO_BP_PL_BPKOPLPW` per ARCHITECTURE.md §5.2). Validated via constructor.
24. Create `src/domain/bank/index.ts` barrel.

### Phase E — Transactions domain

25. Create `src/domain/transactions/ids.ts` — `TransactionId`, `TransactionMappingId`, `TransferId`, `IngestBatchId`.
26. Create `src/domain/transactions/enums.ts` — `TransactionSource`.
27. Create `src/domain/transactions/index.ts` barrel.

### Phase F — Plans domain (depends on `IsoDate` for `PlanPeriod`)

28. Create `src/domain/plans/ids.ts` — `PlanId`, `PlannedItemId`, `PlannedItemVersionId`, `LeftoverSnapshotId`.
29. Create `src/domain/plans/enums.ts` — `PlanType`, `PlannedDirection`. `PlanPeriodKind` is derived from `PlanPeriod['kind']` in `period.ts`.
30. Create `src/domain/plans/period.ts` — `PlanPeriod` discriminated union + derived `PlanPeriodKind`.
31. Unit test: `__tests__/plan-period.test.ts` — exhaustive `switch` over `PlanPeriod['kind']` compiles; missing arm fails type-check.
32. Create `src/domain/plans/index.ts` barrel.

### Phase G — Currency (FX) and Notifications

33. Create `src/domain/currency/ids.ts` — `FxRateId`. Barrel.
34. Create `src/domain/notifications/ids.ts` — `NotificationEventId`, `ExportId`.
35. Create `src/domain/notifications/enums.ts` — `NotificationKind`.
36. Create `src/domain/notifications/index.ts` barrel.

### Phase H — Audit

37. Create `src/domain/audit/ids.ts` — `AuditEventId`. Barrel.

### Phase I — Top-level wiring + public-API gate

38. Create `src/domain/index.ts` re-exporting every domain barrel.
39. Update `src/index.ts` to re-export `domain/*` (and an empty `logic/*` stub so BE-006+ can fill it in).
40. Snapshot test `__tests__/public-api.test.ts` — captures every exported name from `src/index.ts`; intentional removals require updating the snapshot, accidental ones break CI.
41. Run `pnpm --filter @power-budget/core lint typecheck test build` locally; fix any issues.

### Phase J — Documentation hook (optional within the 2-day budget)

42. Add a one-paragraph `packages/core/README.md` section linking back to ARCHITECTURE.md §4 / §5 / §8 and noting "no I/O, no `Date.now()`, no singletons".

Total: ~42 micro-steps, comfortably under the M-effort (2 d) budget.

---

## 6. Test plan

All tests live in `packages/core/__tests__/` (or co-located `*.test.ts` — match BE-002's chosen convention). Tests use Vitest (per QA-001 in BACKLOG.md).

### 6.1 Type-level (assignability) tests

Use `expect-type` (recommended — zero-cost, no separate compile step) or `tsd`. Each test is a TS file the test runner compiles; failures are type errors at lint/typecheck time.

- A bare `string` is **not** assignable to `UserId` (must go through `UserId.of(...)`).
- `UserId` is **not** assignable to `HouseholdId` (BACKLOG.md §BE-003 acceptance criterion).
- `Money['amountMinor']` is `bigint`, not `number`.
- `PlanPeriod` exhaustive `switch` — adding a fourth kind without updating the switch is a type error.
- `LocaleCode` is the union `'en' | 'uk' | 'ru' | 'pl'` (not `string`).
- `CurrencyCode` literal-union check.

### 6.2 Runtime tests

- **`Money` arithmetic** (BACKLOG.md §BE-003 acceptance criterion: "100% line coverage on `Money` ops", "`1234n` PLN + `1n` PLN = `1235n` PLN; rejects cross-currency add"):
  - `Money.add(PLN 1234n, PLN 1n)` → `PLN 1235n`.
  - `Money.add(PLN 100n, EUR 100n)` throws `CurrencyMismatchError`.
  - `Money.sub`, `Money.negate`, `Money.multiply`, `Money.compare`, `Money.equals`, `Money.isZero` covered.
  - Zero handling: `Money.zero('PLN').amountMinor === 0n`.
- **`DateRange`** — `contains` edges, `overlaps` (touching ranges count as overlap), invalid range (`start > end`) throws.
- **`Currency`** — `isSupportedCurrency('PLN')` true; `isSupportedCurrency('xxx')` false.
- **`LocaleCode`** — `isSupportedLocale` for all four; `isSupportedLocale('de')` false.
- **`UserId.of`** — accepts a valid UUIDv7; rejects an empty string, a UUIDv4, a malformed string.

### 6.3 Public-API surface snapshot

`__tests__/public-api.test.ts` — imports `* as core from '../src'`, calls `Object.keys(core).sort()`, and snapshots. Accidental removal (or renaming) breaks CI; intentional changes require the developer to update the snapshot, surfacing the change in code review.

### 6.4 Lint gates

The ESLint `no-restricted-imports` rule installed in BE-002 must pass: nothing in `packages/core/src/**` imports `react`, `@nestjs/*`, `drizzle-orm`, `axios`, Node `fs`, Node `crypto`, DOM types, or React Native types (ARCHITECTURE.md §4 "Banned in `@power-budget/core`").

### 6.5 Coverage

Vitest coverage gate at 100 % on `domain/shared/money.ts` (per acceptance criterion). Other files are mostly type definitions and trivial guards; aim for 95 % overall.

---

## 7. Acceptance criteria

Refined from BACKLOG.md §BE-003:

- [ ] `UserId` is `string & { readonly __brand: 'UserId' }` and is **not** assignable to `HouseholdId`. Verified by a type-level test that fails to compile when the rule is violated.
- [ ] Every entity ID referenced in ARCHITECTURE.md §4 ("Branded ID types") and every additional ID required by §5 / §8 (`SessionId`, `AuthMethodId`, `TotpSecretId`, `HouseholdInviteId`, `SyncRunId`, `TransactionMappingId`, `TransferId`, `IngestBatchId`, `PlannedItemVersionId`, `LeftoverSnapshotId`, `CategoryPrivacyId`, `FxRateId`, `NotificationEventId`, `ExportId`, `AuditEventId`, `BankId`, `HouseholdMemberId`, `MagicLinkTokenId`) is exported as a branded `string` type + a value namespace with `.of` / `.isValid`.
- [ ] `Money` arithmetic is integer-only (bigint minor units). `Money.add(PLN 1234n, PLN 1n)` returns `PLN 1235n`. Cross-currency `Money.add` throws `CurrencyMismatchError`.
- [ ] 100 % line coverage on `domain/shared/money.ts` (per BACKLOG.md acceptance criterion).
- [ ] `LocaleCode` is the closed literal union `'en' | 'uk' | 'ru' | 'pl'`. `DEFAULT_LOCALE = 'en'`. `isSupportedLocale` correctly types-guards.
- [ ] `PlanPeriod` is a discriminated union of `weekly | monthly | custom`, each carrying `start: IsoDate; end: IsoDate`. An exhaustive `switch` on `PlanPeriod['kind']` type-checks.
- [ ] `CategoryPrivacyLevel` is the literal union `'total_only' | 'total_with_counts' | 'full_detail'`.
- [ ] `TransactionSource` is `'bank' | 'manual'`; `PlanType` is `'personal' | 'household'`; `PlannedDirection` is `'income' | 'expense'`.
- [ ] `pnpm --filter @power-budget/core lint typecheck test build` is green.
- [ ] `pnpm --filter @power-budget/core build` emits ESM `dist/` with type declarations (already configured by BE-002; this task must keep it green).
- [ ] ESLint `no-restricted-imports` still rejects banned modules (no new file violates it).
- [ ] Public-API snapshot test passes.

---

## 8. Open questions / decisions

Each decision must be confirmed by the reviewer before implementation begins. Recommendations are stated.

### 8.1 Money representation

**Decision: minor-units `bigint` + `CurrencyCode`.** Per ARCHITECTURE.md §5.6 ("`Money` — `{ amountMinor: bigint; currency: CurrencyCode }`. Value object in `@power-budget/core`. All arithmetic is integer; no floats anywhere"), §6 ("BIGINT for minor units"), §8 ("Money amounts stored as `(amount_minor BIGINT, currency CHAR(3))` pairs"), and BACKLOG.md §BE-003 ("bigint minor units + ISO 4217").

Alternatives considered:

- **Decimal string** — avoids the JSON-serialisation friction of `bigint` (which is not natively `JSON.stringify`-able), but introduces a string-math library dependency or rolling our own — violates "no dependencies in core" intent.
- **`number`** — IEEE 754 cannot represent `0.1 + 0.2` exactly; non-starter for money.

`bigint` JSON-serialisation friction is **acknowledged** and handled at the presentation boundary: REST DTOs (BE-015 onwards) serialise as a string `amountMinor`, and the API client deserialises back to `bigint`. RTK Query's `transformResponse` is the natural seam; mirrors how PostgreSQL drivers handle `BIGINT` in Node.

### 8.2 `Locale` — closed literal union vs. open string

**Decision: closed literal union `'en' | 'uk' | 'ru' | 'pl'`** in `@power-budget/core`. Per ARCHITECTURE.md §5.8: "`LocaleCode` — `'en' | 'uk' | 'ru' | 'pl'` in MVP; widened to `string` in the schema to allow content-only additions".

The schema-level widening to `string` lives in the **Drizzle column** (BE-005), not in core. Core's job is to be strict so adding a locale is a one-line PR (extend the union, ship the bundle); the database tolerates unknown values during a rolling deploy.

Open question: does the closed union cause friction with `Accept-Language` parsing in BE-013 / WEB-017? **Recommendation:** resolution logic lives in the application layer (`LocaleResolver` port, §5.8); it parses freely and outputs `LocaleCode | undefined`, falling back to `DEFAULT_LOCALE`. Core stays closed.

### 8.3 `Currency` — closed union vs. open

**Decision: closed literal union for the 11 MVP-relevant currencies** (PLN, EUR, USD, GBP, UAH, RUB, CHF, CZK, SEK, NOK, DKK). Same reasoning as locales — strict at the core, schema column is `CHAR(3)` so v3 widens by appending.

Open question: should less-common ECB-published currencies (TRY, JPY, etc.) be in the MVP union? **Recommendation:** no — keep the list to what PRD §4.4 calls out ("base currency + interesting currencies" for two real users in PL / UA / EU). v2 widens as needed.

### 8.4 `User` — one household or many

**Decision: M:N schema, application invariant of one-active household.** Per ARCHITECTURE.md §5.1 open question 3: "Single household per user in MVP, but data model is N:M. _Recommendation:_ model `household_users` as M:N from day one; enforce single-household via application invariant. v2 lifts the invariant, schema unchanged".

Core implication: there is no `User.householdId` field — household membership lives in `HouseholdMember` (BE-004). This task delivers `HouseholdMemberId` accordingly.

### 8.5 Period dates — `Date` vs. ISO 8601 string

**Decision: ISO 8601 strings (`IsoDate` for date-only, `IsoDateTime` for instants), both as branded `string`.** Rationale:

- `Date` does not round-trip cleanly through JSON (`JSON.stringify(new Date())` works but the reverse path loses type info; consumers always re-`new Date(s)`).
- ISO strings are stable across `bigint`-style serialisation issues.
- Core never does timezone arithmetic; that lives in `core/logic/` formatters (BE-010) using `Intl.DateTimeFormat` with the user's locale.
- ARCHITECTURE.md §8 uses `TIMESTAMPTZ` at the DB level; Drizzle exposes those as `Date` in TypeScript by default, but our **domain model** strings them at the application boundary to keep `core` JSON-portable.

Open question: do the pure-logic functions (BE-006/007) need `IsoDateTime` comparison? **Yes**, but ISO 8601 string comparison is byte-correct for sortable formats — no `Date` needed.

### 8.6 Helper constructor strictness

**Decision: validate shape (UUIDv7 regex), not existence.** `UserId.of('not-a-uuid')` throws; `UserId.of(<valid-uuidv7-string>)` succeeds even if no such user exists. Existence is the repo's job.

Trade-off: ID parsing in hot paths (e.g. RTK Query cache keys) pays a regex cost. **Mitigation:** brand-only assertion (no `.of`) is available via type assertion at the boundary; `.of` is for untrusted input only. Document the convention.

### 8.7 Where does `HouseholdScope` live?

**Decision: NOT in core.** Per ARCHITECTURE.md §5.10 it is a request-scoped value object that depends on session resolution, which is backend-only. `HouseholdId` lives in core; the scope wrapper lives in `packages/backend/src/domain/`. Reaffirms the "Banned in `@power-budget/core`" list in §4.

---

## 9. Risks

1. **`bigint` serialisation surprises downstream.** RTK Query and Nest's default JSON serialiser do not handle `bigint` out of the box. _Mitigation:_ document the convention now (DTO carries `amountMinor: string`; client transforms back to `bigint`); BE-015 owns the actual transformer. Add a deliberate test in BE-004 that `JSON.stringify(money)` throws (a guardrail that ensures we do not accidentally pass raw `Money` over the wire).
2. **Brand erosion via `as` assertions.** Developers may bypass `UserId.of` with `someString as UserId`, defeating the brand. _Mitigation:_ team rule from global `CLAUDE.md` ("Avoid `as` type assertions"); ESLint `@typescript-eslint/consistent-type-assertions` enforced in `packages/core/`. Code-review check.
3. **Currency / locale union closed too tightly.** Adding a fifth locale or a new currency is a core PR + version bump that ripples to every package. _Mitigation:_ the four-MVP scope is explicitly fixed by PRD §1; expansions are intentional events, not surprises. Per ARCHITECTURE.md §5.8, schema columns are open `string`, so the DB never blocks. Keep the public-API snapshot to make the rippling visible in CI.

---

## Closing notes

This plan is a foundation PR — small surface, high blast radius. The right shape unblocks ~20 downstream tasks; the wrong shape forces every downstream task to re-litigate. Lock the §8 decisions before writing code.
