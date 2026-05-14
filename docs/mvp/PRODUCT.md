# Power Budget — Product Requirements Document (v1.0)

> Product requirements only. Technical architecture, stack, hosting, and data design are deliberately **out of scope** for this document and will be covered in a separate technical design document.

---

## Context

You want a personal budgeting app that actually fits how you and your partner manage money — one that pulls real bank data automatically and centres on a **planned vs. actual** view in real time. The MVP starts with **PKO BP (Poland)** and **Wise (multi-currency)**, with **Monobank (Ukraine)** and broader bank coverage coming after. You and your partner will be the first users; the app should evolve into a full SaaS without a rewrite.

The killer differentiator is plan-based budgeting: you define a plan for a period (week / month / custom), list expected incomes and planned expense items, and then as transactions arrive you map them to those items. The dashboard always tells you, in real time, whether you are on track — and unplanned transactions are surfaced separately so they cannot hide.

---

## 1. Goals & Non-Goals

### MVP Goals

- Connect to **PKO BP** and **Wise** and pull balances + transactions automatically.
- **Two users** (you + partner) with a **private accounts, shared categories** model. Per-category privacy controls (total-only vs. full detail).
- **Plan-based budgeting**: weekly, monthly, or custom-period plans; per-user _or_ shared household plans.
- Real-time **planned vs. actual dashboard**, with **unplanned** transactions called out separately, plus a **Leftover / Saved bucket** that captures unspent budget at period end.
- **Multi-currency display**: user picks a base currency + a list of "interesting" currencies; any amount can be viewed in any of them.
- **Multi-language UI**: full localization in **English, Ukrainian, Russian, Polish** at launch (see §4.12).
- **Manual transaction entry** for cash and other off-bank flows.
- **Web + iOS** at launch.
- Email notifications for the situations that matter (see §4.10).

### MVP Non-Goals (future-ready, not built)

The following are intentionally **out of MVP scope**, but the product and underlying foundations must be designed so they can be added later without major rework.

- **AI-assisted categorization** (transaction → planned item suggestions).
- **Monobank** and other banks beyond PKO + Wise. Architecture must support _any_ bank via a uniform connector model.
- **Android** app.
- **Auto-detected transfers** between own accounts (manual flagging in MVP — see §4.3).
- **Investments / net-worth / debt / loan / goals / savings buckets** as first-class concepts (a basic Leftover bucket exists, but it is not a goals system).
- **Bill reminders, recurring detection, forecasting**.
- **Public signup / billing / marketing / multi-tenant SaaS**.
- **Receipt OCR / attachments**.
- **Push notifications** (email only in MVP).
- **Joint / shared accounts** (in MVP every account is private to one user; shared categories provide the household-level view).
- **Languages beyond the four MVP languages** (architecture must allow adding new locales without code changes — see §4.12).

---

## 2. Target Users

| Phase | Users                       | Distribution                          |
| ----- | --------------------------- | ------------------------------------- |
| MVP   | You + partner               | Private deployment, invite-only       |
| v2    | Friends, family, small beta | Still invite-only                     |
| v3    | General public              | Full SaaS — signups, billing, support |

This PRD is written for MVP. Every product decision should be checked against "does this also work for v3?" — the answer should be yes or "yes, with extension we know how to build".

---

## 3. Core Concepts (Product Language)

These are the **business concepts** users see in the UI and that we use when talking about the product.

- **Household** — a logical group of users (you + partner). All sharing happens within a household.
- **User** — a person. Belongs to one household in MVP. Has a preferred UI language.
- **Bank Connection** — a credential link to a bank (PKO, Wise). Owned by one user. Refreshed on a schedule; requires periodic re-consent.
- **Account** — a single account/wallet at a bank (PKO checking, Wise PLN, Wise EUR, etc.). Belongs to a connection. **Private to the owning user.**
- **Transaction** — a record from a bank or entered manually: date, amount, currency, description, merchant (if known), account, optional notes. Manual transactions are flagged so they are distinguishable from bank-sourced ones.
- **Currency** + **FX Rate** — supported currencies and daily exchange rates between them.
- **Category** — a labelled bucket (Groceries, Rent, etc.). **Shared across the household.** Each category has a **privacy setting** that controls how much detail your partner sees (see §4.9).
- **Plan** — a budget for a period. Has a type: **personal** (private to one user) or **household** (visible and editable by both users). Has a period type: **weekly**, **monthly**, or **custom date range**.
- **Planned Item** — a line within a plan: a category + expected amount + direction (income or expense) + currency.
- **Mapping** — a link from one transaction to **exactly one** planned item (no transaction splitting in MVP). A transaction with no mapping is **Unplanned**.
- **Transfer** — a transaction explicitly marked by the user as moving money between their own accounts. Transfers are excluded from income/expense totals.
- **Leftover bucket** — at period end, any unspent planned expense amount is rolled into a virtual "Saved / Leftover" bucket so it is not lost (see §4.8).
- **Locale** — the user's language + regional formatting preferences. Defaults from the browser/device, overridable in settings.

---

## 4. MVP Feature Set

### 4.1 Authentication & Onboarding

- **Email + password** signup with verification.
- **Magic link** as an alternative passwordless option.
- **Google OAuth** sign-in / sign-up.
- **Two-factor authentication (TOTP)** — mandatory once the user connects a bank. This app proxies bank data; 2FA is not optional.
- **Household creation**: first user creates a household; partner joins via an invite link / code.
- **First-run onboarding**:
  1. Confirm / change UI language (auto-detected from browser/device).
  2. Pick base currency.
  3. Pick interesting currencies (multi-select).
  4. (Optional) connect first bank.
  5. (Optional) create first plan or skip.

### 4.2 Bank Connections

- A user can connect multiple banks (PKO, Wise in MVP).
- **Connect flow**: pick bank → consent screen on the bank/aggregator side → return to app → accounts and balances appear.
- **History import**: at the moment of connecting, the user **picks how far back to import** (e.g. 30 / 90 / 365 days, capped by what the bank allows).
- **Background sync**: automatic, regular refresh; UI shows "last synced X minutes ago" and a "Refresh now" button.
- **Re-consent reminder**: PKO consent expires every 90 days (PSD2). UI must surface this clearly _before_ expiry, and an email reminder fires (see §4.10).
- **Disconnect**: removes the live connection but **keeps the historical transactions and accounts** as read-only records.

### 4.3 Transactions

**Sources:**

- Imported from banks (PKO, Wise).
- Created manually by the user (cash, gifts, IOUs).

**Per-transaction display:**

- Date, merchant / description, original amount + currency, **converted amount in the user's base currency**, mapped planned item (or "Unplanned"), category icon.
- Source indicator (bank / manual).
- Plan badge (which plan this transaction is mapped into, since custom-period plans can overlap).

**Per-transaction actions:**

- **Map** to a planned item from any of the user's active plans (personal or shared household).
- **Mark as Transfer** — excludes it from income/expense totals. The user picks the matching counterpart transaction from their other accounts, or marks it standalone if the counterpart isn't visible yet. _(Auto-pairing across accounts is a v2 feature; the data model must be ready to support it without migration.)_
- **Ignore** — for duplicates / system noise.
- **Edit notes** — freeform user note.
- **Bulk actions** — select multiple → map all to the same planned item or mark all as transfers.

**Lists & filters:**

- List view per account and per household (the user only sees their own transactions plus shared-category aggregates from partner; see §4.9).
- Filters: date range, category, mapped / unmapped / transfer, currency, source (bank / manual), text search.

### 4.4 Multi-Currency Display

- User picks a **base currency** (the unit for all aggregations: budgets, totals, dashboards).
- User picks a list of **interesting currencies**.
- Any displayed amount has a currency switcher — tap to cycle through the interesting list. Original currency is always available as one of the options.
- **FX source**: a daily exchange rate is captured and stored per-day so historical figures stay stable. The rate source is shown in the UI.

### 4.5 Plans

**Plan types (MVP supports both — user picks at creation time):**

- **Personal plan** — visible and editable by one user only.
- **Household plan** — visible and editable by both users in the household.

**Plan periods (MVP supports all three):**

- **Weekly**
- **Monthly**
- **Custom date range** (e.g. "Vacation: July 10–24")

Multiple plans can be active at the same time — e.g. a monthly personal plan, a monthly household plan, and a custom vacation plan all running in July. When mapping a transaction, the user picks which plan + planned item.

**Plan contents:**

- **Expected incomes** — e.g. "Salary 12 000 PLN", "Freelance 3 000 PLN".
- **Planned expenses** — e.g. "Rent 3 500 PLN", "Groceries 2 000 PLN".
- Each planned item has: category, amount, currency, optional note.

**Plan editing:**

- Mid-period edits are allowed.
- All edits are **versioned with an audit trail** — the dashboard reflects the latest value, but a history icon next to each planned item reveals every change with timestamp and user. Restoring the original household trust between two people requires this transparency.

**Plan templates / cloning:**

- "Create new plan from previous" duplicates the structure (categories + amounts) of the most recent plan of the same period type.

### 4.6 Mapping (Transaction → Planned Item)

- Each new transaction is **Unplanned** by default.
- User opens a transaction and picks a planned item from any active plan (personal or household).
- **One-to-one mapping** — a transaction maps to a single planned item. (Splits are a future-ready non-goal.)
- **Heuristic suggestions** (not AI): if you previously mapped a transaction from "Biedronka" to "Groceries", the next "Biedronka" transaction comes with that suggestion pre-filled. User confirms or overrides.
- **Future-ready**: the mapping model should accept multi-line splits in v2 without breaking existing data.

### 4.7 Over-Budget Behaviour

- Planned 2 000 PLN, actual 2 200 PLN → progress bar turns red, shows "+200 over".
- The transaction that pushed you over still maps to the planned item — no blocking, no forced re-routing.
- An over-budget email alert may fire (see §4.10).

### 4.8 Leftover / Saved Bucket

- At the **end of a period**, every planned expense with `actual < planned` contributes `planned − actual` to a virtual **Leftover / Saved bucket** for that period.
- Leftover is shown per planned item and as a household / personal total on the dashboard.
- Leftover from past periods **accumulates over time** — you can see your running "saved" balance.
- Leftover is **read-only in MVP** — it is a reporting concept, not yet a spendable envelope. (Making it withdrawable / re-assignable is a v2 enhancement; the data model should accept that without rework.)
- Over-budget items contribute **0** to leftover (not negative). The over-budget figure is tracked separately.

### 4.9 Categories & Sharing

**Categories:**

- Shared at household level — one category list for both users.
- Pre-seeded defaults: Groceries, Rent, Utilities, Transport, Eating Out, Health, Entertainment, Subscriptions, Travel, Gifts, Other.
- Pre-seeded category names and icons are localized in all four MVP languages.
- Each category has an icon + colour for quick recognition.
- Users can add / rename / archive (not delete — would orphan history). User-created names are stored as entered (single string, no auto-translation).

**Privacy controls per category:**
Each category has a household-visibility setting that controls what your partner sees:

- **Total only** — partner sees the aggregated total spend for the category, nothing else.
- **Total + counts** — partner sees the total plus "you: 4 txns, them: 9 txns" (no merchant detail).
- **Full detail** — partner sees every transaction in the category (merchant, date, amount), but **never the account it came from**.
- Default: **Total only** (most private). User can elevate on a per-category basis (e.g. "Rent" → full detail; "Gifts" → total only).

**Account & transaction privacy:**

- Bank accounts and individual transactions are always private to the owning user.
- Sharing only ever happens via shared categories at the level the user chose for that category.

### 4.10 Notifications (Email-only in MVP)

- **Bank reconnect reminder** — fires when consent is approaching expiry (e.g. 7 days, 1 day, on expiry). Critical: without this, sync silently breaks.
- **Weekly summary digest** — opt-in. "Last week's planned vs. actual + top categories + unplanned highlights."
- **Over-budget alert** — fires when a planned item crosses 80% and again at 100% of its limit. User-configurable thresholds in settings.
- All notification emails are sent in the **user's preferred language** (see §4.12).
- **Out of MVP scope**: push notifications, unmapped-transaction nudges (deferred — the dashboard already calls these out).

### 4.11 Dashboard (the home screen)

For the **currently viewed plan** (default: today's active monthly personal plan, switchable to any active plan):

- **Header**: plan name, type (personal / household), period dates, "X days remaining".
- **Income section**: each expected income line — planned vs. received, progress bar.
- **Expense section**: each planned item — planned vs. spent, progress bar, green / amber / red cues. History icon for audit trail.
- **Unplanned section**:
  - Unplanned **expenses** total (and tap-to-list).
  - Unplanned **incomes** total (and tap-to-list).
- **Leftover bucket**: running total of saved / leftover across all closed periods, plus this period's projected leftover.
- **Bottom line**: net for the period — `(planned + unplanned income) − (planned + unplanned expense)` in base currency, with the currency switcher for "interesting" currencies.

A separate household-level view aggregates shared categories across both users (respecting each category's privacy setting).

### 4.12 Internationalization & Localization (i18n / l10n)

**Supported languages in MVP:**

- **English (en)** — default / fallback.
- **Ukrainian (uk)**.
- **Russian (ru)**.
- **Polish (pl)**.

**Scope of localization:**

- All UI strings (labels, buttons, errors, validation, empty states, tooltips, onboarding copy).
- All system-generated emails (verification, magic link, reconnect reminder, weekly digest, over-budget alert).
- Pre-seeded category names and default plan templates.
- Date formats, number formats, and currency separators follow each locale's conventions (e.g. `1 234,56 zł` for `pl`, `1,234.56` for `en`).
- Currency symbols / codes follow ISO standards and are displayed in a locale-appropriate position.
- Bank, merchant, and transaction descriptions returned from external sources are **not translated** — shown as received.
- User-entered text (plan names, notes, custom category names, planned item descriptions) is stored and shown as entered. No auto-translation.

**Language selection & persistence:**

- On first visit, the UI auto-detects language from the browser / device (`Accept-Language` header on web; system locale on iOS).
- Detected language is mapped to the closest supported language; anything unsupported falls back to English.
- Logged-in users have a **language preference stored on the user profile**, which overrides browser detection and follows them across web and mobile.
- Language is changeable at any time from Settings; takes effect immediately, no reload.
- The language preference also controls the language of all notification emails sent to that user.

**Future-readiness:**

- Translations live in **resource files keyed by locale code**, loaded dynamically. Adding a new language (e.g. Spanish for v3) requires only a new resource bundle — no code changes.
- The translation pipeline must accommodate a workflow where strings can be extracted, sent to translators (or LLM-assisted translation), reviewed, and reimported without rebuilding the app.
- All user-facing strings must come from the resource bundle — no hardcoded strings in the codebase. This rule must be enforceable via lint / CI.
- Plural rules and gendered forms are handled via ICU MessageFormat (or equivalent), not string concatenation, so languages with complex plural rules (Ukrainian, Russian, Polish all have multi-form plurals) render correctly.
- Right-to-left languages are not supported in MVP but the layout system should not block adding them later.

---

## 5. Key User Stories (MVP Acceptance)

1. _I sign up with Google in seconds, set my base currency to PLN, connect PKO + Wise, and see my balances within 5 minutes._
2. _I create a monthly **personal** plan with my expected salary, planned rent, groceries, and transport._
3. _I create a **household** plan with my partner for shared expenses like rent and utilities._
4. _I add a 50 PLN cash transaction manually for a coffee paid in cash._
5. _I map yesterday's PKO transactions to my active plans in under a minute, with smart suggestions from previously mapped merchants._
6. _I mark a 1 000 PLN PKO → Wise transfer as "Transfer" so it doesn't pollute my totals._
7. _I see at a glance how much I've spent on groceries this month vs. the 2 000 PLN planned, plus how much I've already saved in the Leftover bucket._
8. _I see every unplanned transaction for the month — what I didn't budget for._
9. _I switch the dashboard total between PLN, EUR, and UAH without leaving the screen._
10. _My partner views the household "Groceries" total at the level of detail I chose to share (total-only by default; full detail if I switch the category)._
11. _I get an email a week before my PKO consent expires, with a one-click reconnect link._
12. _I get an email when my Groceries budget hits 80% and again when it crosses 100%._
13. _I raise my Groceries budget from 2 000 to 2 500 mid-month; my partner can see in the audit log exactly when and by whom it was changed._
14. _I create a "Vacation" custom-period plan for July 10–24 with its own incomes / expenses, independent from the monthly plan._
15. _I open the app for the first time in a Polish browser and the entire UI is in Polish, with `1 234,56 zł` number formatting; I can switch to Ukrainian from Settings and the change is instant and persistent._
16. _I (Ukrainian-speaking) and my partner (Polish-speaking) each see the app in our own language; emails arrive in each of our preferred languages; the same shared category appears with its localized name on both sides._

---

## 6. Non-Functional Requirements (Product-Level)

These are product-level expectations. Detailed implementation will be covered in the technical design.

### Security

- All bank tokens encrypted at rest.
- 2FA mandatory for any user with an active bank connection.
- TLS in transit; HSTS.
- No raw bank credentials ever stored — only OAuth-style tokens from the aggregator or user-generated personal API tokens.
- Audit log of every bank credential access.
- GDPR-aligned: data export (JSON) and data deletion on request.

### Reliability

- Bank sync failures must not block the UI — the rest of the app remains usable; the affected account shows last-successful-sync time and a clear banner.
- Re-running sync is idempotent (no duplicates).

### Performance

- Dashboard for a household with 12 months of transactions (~5 000 rows) loads in under 500 ms.

### Compliance

- PKO connection must go through a licensed PSD2 AISP aggregator (no direct screen-scraping).
- Wise Personal API is for account holders only — fine for MVP. SaaS will require a Wise Platform partnership (v3 concern).

### Localization Quality

- 100% of user-facing strings are translatable; no hardcoded English copy.
- Each MVP language is reviewed by a native speaker before launch.
- All four MVP languages must pass the same UI acceptance tests; no language-specific layout breakage.

---

## 7. Future-Readiness Principles

Because all MVP Non-Goals (§1) will be added later, the product must be designed so that adding them is an _extension_, not a _redesign_. Concrete principles:

- **Bank connectors** are interchangeable behind a uniform interface. Adding Monobank, Salt Edge, Plaid, etc. is implementing one adapter — no UI or domain changes.
- **Transaction mapping** is one-to-one in MVP but the mapping model must accept multi-line splits in v2 without migration.
- **Transfer marking** is manual in MVP but the data model supports linking two transactions as a transfer pair so auto-pairing can be added later.
- **Categorization** is heuristic in MVP but exposes the inputs an AI v2 will need (merchant text, prior user mappings, transaction features).
- **Notifications** are email in MVP but use a single notification dispatch layer so push (iOS / Android) plugs in without rewriting business logic.
- **Auth** supports password + magic link + Google OAuth in MVP and is designed to accept Apple, Microsoft, and SAML SSO for v3 SaaS without core changes.
- **Multi-tenancy** is single-household in MVP but the domain model is household-scoped from day one so v3 SaaS is a matter of allowing multiple households, not introducing the concept.
- **Categories, plans, and accounts** are household-scoped types, never globally shared — this is the foundation of multi-tenant correctness.
- **Leftover bucket** is read-only reporting in MVP but designed so v2 can let users "spend from" or "re-assign" leftover without schema change.
- **Localization** infrastructure (resource files, ICU plurals, locale-aware formatters) is built once in MVP; adding a new language is a content task only, never a code task.

---

## 8. Roadmap

### v1 (MVP) — target: 8–12 weeks part-time

Everything in §4.

### v2 — target: 3–6 months after MVP

- **Monobank** integration.
- **Android** app.
- **AI-assisted categorization**.
- **Auto-detected transfers** between own accounts.
- **Recurring transaction detection** (Netflix, rent, salary).
- **Forecasting** based on recurring + historical averages.
- **Push notifications** (iOS + Android).
- **Joint / shared accounts** as a first-class concept.
- **Transaction splits** (one transaction → multiple planned items).
- **Spendable leftover** — re-assign / withdraw from the Leftover bucket.
- **Receipt attachments**.
- **Additional languages** as needed (German, Spanish, etc.).

### v3 — target: 6–12 months after MVP, SaaS

- Public signup, billing (Stripe), tier limits.
- Broader bank coverage (Salt Edge / Plaid).
- Marketing site, docs, support — also fully localized.
- Investments view (read-only).
- Net-worth dashboard, debt / loan tracking, named goals.
- Data export integrations (Notion, Google Sheets).
- SSO (Apple, Microsoft, SAML).
- Full GDPR / compliance tooling (DPA, ROPA, privacy controls).

---

## 9. Risks (Product-Level)

| Risk                                                                     | Likelihood | Impact | Mitigation                                                                                           |
| ------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| PKO 90-day re-consent feels clunky for users                             | High       | Medium | Prominent in-app reminder + email alert chain; one-click reconnect.                                  |
| Partner does not engage with the app                                     | High       | High   | Demo at week ~4; cut features she ignores. Per-category privacy controls reduce friction.            |
| Manual mapping feels like a chore                                        | Medium     | High   | Strong heuristic suggestions in MVP; AI in v2. Bulk-map UX must be excellent.                        |
| Multi-currency confusion (which rate, which day)                         | Medium     | Medium | Always show original + converted, with rate source + date.                                           |
| Plan / mapping model needs splits sooner than expected                   | Medium     | Medium | Future-ready design (see §7) means splits can be added cleanly.                                      |
| Aggregator outages break PKO sync                                        | Low        | High   | Surface last-sync clearly; design connector layer so a second aggregator can be added as a fallback. |
| Building too much before getting real-world feedback                     | High       | High   | Strict MVP cut; weekly check-in with partner once dashboard is usable.                               |
| Translation quality is poor (LLM-translated without review)              | Medium     | Medium | Every MVP language reviewed by a native speaker before launch; broken strings tracked as bugs.       |
| Text expansion in `uk` / `ru` / `pl` breaks UI layouts designed for `en` | Medium     | Low    | Design with ~30% text expansion headroom; visual regression test in all four languages.              |

---

## 10. Open Questions (Resolved)

All material product questions have been resolved during PRD drafting. Recorded here for the record:

| #   | Question                   | Decision                                                                                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | Plan ownership             | Both personal and household plans supported in MVP.                                         |
| 2   | Transaction splits         | One-to-one in MVP; future-ready for multi-line splits.                                      |
| 3   | Transfer handling          | Manual marking in MVP; data model ready for auto-pair detection in v2.                      |
| 4   | Plan periods               | Weekly + monthly + custom date ranges.                                                      |
| 5   | Plan edits                 | Versioned with audit trail visible to household members.                                    |
| 6   | Over-budget                | Visual warning only; no blocking.                                                           |
| 7   | Rollover unspent budget    | Captured in a virtual Leftover / Saved bucket per period, cumulative; read-only in MVP.     |
| 8   | Shared-category privacy    | User chooses per category (total-only / total + counts / full detail). Default: total-only. |
| 9   | Manual transactions        | Yes, with a source flag.                                                                    |
| 10  | First-import history depth | User picks at connect time.                                                                 |
| 11  | Notifications scope        | Email: reconnect, weekly summary (opt-in), over-budget alert.                               |
| 12  | Auth methods               | Email + password, magic link, Google OAuth; 2FA mandatory once a bank is connected.         |
| 13  | MVP languages              | English, Ukrainian, Russian, Polish — full UI and email localization.                       |

Any remaining open items will be technical (covered in the next session).

---

## 11. Verification (Definition of Done for MVP)

- [ ] All user stories in §5 are demonstrably reproducible on web and iOS.
- [ ] PKO + Wise sync run unattended for 7 consecutive days with no manual intervention (apart from re-consent if it falls in window).
- [ ] You + partner have run **one full month** of real planning + tracking and produced one real planned-vs.-actual report.
- [ ] 2FA blocks login without the second factor.
- [ ] Bank tokens are encrypted at rest (verified by manual data inspection).
- [ ] Data export (JSON) works for the entire household.
- [ ] Re-consent reminder email arrives at 7 days, 1 day, and on expiry in a test scenario.
- [ ] Per-category privacy settings are honoured in the partner's view.
- [ ] Leftover bucket correctly accumulates across at least two consecutive monthly plans.
- [ ] Audit trail captures plan edits with timestamp + user.
- [ ] All four MVP languages (en / uk / ru / pl) pass the full UI acceptance tests with no untranslated strings.
- [ ] System emails arrive in each user's preferred language.
- [ ] Plural-sensitive copy renders correctly in `uk`, `ru`, `pl` (1 / 2-4 / 5+ forms).

---

## Next Document

Technical design — to be produced separately. Will cover:

- Domain model and data schema.
- API surface.
- Bank connector port contracts.
- Sync job design.
- Auth + 2FA implementation.
- i18n implementation (libraries, file format, plural handling, build pipeline).
- Hosting and infrastructure.
- Sprint plan / week-by-week MVP build.
