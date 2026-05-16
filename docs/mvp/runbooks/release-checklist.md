# Power Budget — Release Checklist (MVP)

> **Purpose**: Gate criteria that must all be ✅ before the MVP build is promoted to partners.  
> Complete every section in order. Do **not** proceed past a ❌ item without resolving or explicitly accepting the risk (document the acceptance and approver in the Notes column).
>
> Target audience: developer (release manager) running the final pre-release pass.

---

## 1. Pre-Release

### 1.1 Code & CI

| # | Item | Status | Notes |
|---|------|--------|-------|
| PR-01 | All 16 backlog waves (INF-*, BE-*, WEB-*, MOB-*, QA-*, SEC-*) merged to `master`. | ☐ | |
| PR-02 | CI pipeline is green on `master` (all jobs: lint, typecheck, unit tests, integration tests, Playwright smoke suite). | ☐ | Link to last green run: |
| PR-03 | No open `P0` or `P1` bugs in the issue tracker. | ☐ | |
| PR-04 | Dependency audit: `pnpm audit --audit-level=high` returns no high/critical vulnerabilities. | ☐ | Run: `pnpm audit --audit-level=high` |
| PR-05 | All four locale bundles (en, uk, ru, pl) reviewed by a native speaker; no missing keys (`pnpm -F @power-budget/web lint` i18n rule passes). | ☐ | |

### 1.2 Versioning & Changelog

| # | Item | Status | Notes |
|---|------|--------|-------|
| VR-01 | `package.json` versions bumped to `1.0.0` across all packages. | ☐ | |
| VR-02 | `CHANGELOG.md` updated with all user-visible changes for v1.0.0. | ☐ | |
| VR-03 | Git tag `v1.0.0` created and pushed: `git tag v1.0.0 && git push origin v1.0.0`. | ☐ | |

### 1.3 Mobile Build

| # | Item | Status | Notes |
|---|------|--------|-------|
| MB-01 | EAS production build submitted: `eas build --platform ios --profile production`. | ☐ | EAS Build ID: |
| MB-02 | TestFlight build processed and available (Apple review or internal distribution). | ☐ | TestFlight version: |
| MB-03 | TestFlight build installed on at least one physical iOS device and launched without crash. | ☐ | Device: |
| MB-04 | App icon, launch screen, and bundle identifier correct in the TestFlight listing. | ☐ | |

---

## 2. Infrastructure

### 2.1 Staging / Production Environment

| # | Item | Status | Notes |
|---|------|--------|-------|
| IF-01 | Postgres 16 instance running and accepting connections; `SELECT 1` returns OK. | ☐ | |
| IF-02 | Redis 7 instance running; `redis-cli ping` returns `PONG`. | ☐ | |
| IF-03 | DB migrations applied to production: `pnpm -F @power-budget/backend migration:run`. | ☐ | Migration hash: |
| IF-04 | Staging DB seeded with default categories (all four locales) and default plan templates. | ☐ | Run: `pnpm -F @power-budget/backend seed:prod` |
| IF-05 | BullMQ worker process running and `sync-connection` / `notification-dispatch` queues visible in dashboard. | ☐ | Worker URL: |
| IF-06 | Environment variables from `.env.example` all populated in production secrets (no placeholder values). | ☐ | |

### 2.2 Email (Resend / SES)

| # | Item | Status | Notes |
|---|------|--------|-------|
| EM-01 | Resend (or SES) API key configured and account active. | ☐ | |
| EM-02 | Sending domain verified (DNS TXT / DKIM records propagated). | ☐ | Domain: |
| EM-03 | Test email sent to `tester1@example.com` from production; delivered without landing in spam. | ☐ | |
| EM-04 | All six email templates (verification, magic-link, over-budget 80%, over-budget 100%, weekly digest, reconnect reminder) render correctly in all four locales. | ☐ | |

### 2.3 Bank Integrations

| # | Item | Status | Notes |
|---|------|--------|-------|
| BK-01 | GoCardless **production** application credentials (`GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`) configured and active. | ☐ | |
| BK-02 | GoCardless PKO BP institution ID confirmed valid in production (`ASPSP_ID`). | ☐ | |
| BK-03 | GoCardless redirect URI for production environment registered in the GoCardless developer portal. | ☐ | URI: |
| BK-04 | Wise **production** API key for personal account owner configured (`WISE_API_KEY`). | ☐ | |
| BK-05 | ECB FX rate fetch job runs successfully; at least one day of rates stored in `fx_rates` table. | ☐ | |

---

## 3. Security

| # | Item | Status | Notes |
|---|------|--------|-------|
| SC-01 | HTTPS certificate valid and not expiring within 30 days. | ☐ | Expiry date: |
| SC-02 | HSTS header present with `max-age ≥ 31536000; includeSubDomains`. | ☐ | Verify: `curl -I https://<domain>` |
| SC-03 | CSP header is strict (no `unsafe-inline` scripts); Mozilla Observatory score ≥ A−. | ☐ | Observatory URL: |
| SC-04 | `Referrer-Policy: same-origin` and `Permissions-Policy: ()` headers present. | ☐ | |
| SC-05 | Rate limiting active on `/auth/login`, `/auth/magic-link/request`, `/auth/totp/verify` — verified by sending 6 requests in 15 min and receiving HTTP 429. | ☐ | |
| SC-06 | Bank tokens encrypted at rest: DB inspection of `bank_connections.consent_token` shows opaque ciphertext (not plaintext). | ☐ | |
| SC-07 | Password hashes are Argon2id (not bcrypt or MD5): DB inspection confirms `$argon2id$` prefix. | ☐ | |
| SC-08 | TOTP step-up enforced for sensitive actions: bank connect, data export, account deletion each return 403 `requires_totp` when last verification >5 min. | ☐ | |
| SC-09 | No secrets committed to git: `git log --all -S "SECRET\|API_KEY\|PASSWORD" -- '*.env*'` returns nothing. | ☐ | |
| SC-10 | SEC-005 GDPR privacy policy document committed under `docs/mvp/legal/`. | ☐ | |

---

## 4. Smoke Tests

### 4.1 Playwright Web Smoke Suite

Run from the repo root:

```bash
pnpm -F @power-budget/web test:smoke --reporter=list
```

| # | Smoke Test | Status | Notes |
|---|-----------|--------|-------|
| SM-01 | `auth/register.spec.ts` — registration + email verification flow passes. | ☐ | |
| SM-02 | `auth/login.spec.ts` — login with password + TOTP challenge passes. | ☐ | |
| SM-03 | `auth/magic-link.spec.ts` — magic-link request + login passes. | ☐ | |
| SM-04 | `plans/create-plan.spec.ts` — create plan with planned items passes. | ☐ | |
| SM-05 | `transactions/map-transaction.spec.ts` — single transaction mapping passes. | ☐ | |
| SM-06 | `dashboard/view.spec.ts` — dashboard loads within 500 ms (measured by Playwright `page.waitForSelector`). | ☐ | |
| SM-07 | `i18n/locale-switch.spec.ts` — all 4 locales switch without hardcoded strings. | ☐ | |

All Playwright smoke tests: **PASS / FAIL**

### 4.2 Mobile Smoke Test (Manual — iOS)

Run on the TestFlight build from MB-01:

| # | Step | Status |
|---|------|--------|
| MS-01 | App launches; no crash on cold start. | ☐ |
| MS-02 | Registration → email verification → login flow completes end-to-end. | ☐ |
| MS-03 | TOTP enrollment completes. | ☐ |
| MS-04 | GoCardless PKO BP bank connection flow completes (production consent). | ☐ |
| MS-05 | Transactions list loads with imported transactions. | ☐ |
| MS-06 | Transaction mapping works; dashboard updates. | ☐ |
| MS-07 | Language switch (en → pl) takes effect immediately. | ☐ |
| MS-08 | Currency switcher on dashboard cycles PLN → EUR → USD. | ☐ |
| MS-09 | Biometric unlock (Face ID) prompts on app re-open and grants access. | ☐ |
| MS-10 | App background → foreground does not require full re-login within JWT validity window. | ☐ |

Mobile smoke test: **PASS / FAIL**

---

## 5. Go / No-Go Criteria

**ALL items below must be ✅ before proceeding to partner distribution.**  
A single ❌ blocks release unless explicitly risk-accepted with written justification.

| # | Criterion | Status |
|---|-----------|--------|
| GNG-01 | All CI checks green on `master` (PR-02). | ☐ |
| GNG-02 | Zero open P0/P1 bugs (PR-03). | ☐ |
| GNG-03 | TestFlight build installed and smoke-tested on device (MB-03). | ☐ |
| GNG-04 | Postgres + Redis + Worker healthy in production (IF-01, IF-02, IF-05). | ☐ |
| GNG-05 | Production email delivery verified — no spam landing (EM-03). | ☐ |
| GNG-06 | GoCardless production credentials active and PKO BP connect flow completes end-to-end (BK-01, BK-02). | ☐ |
| GNG-07 | HTTPS cert valid ≥30 days + HSTS present (SC-01, SC-02). | ☐ |
| GNG-08 | Rate limiting active on auth endpoints (SC-05). | ☐ |
| GNG-09 | All 7 Playwright smoke tests pass (SM-01 – SM-07). | ☐ |
| GNG-10 | All 10 mobile smoke steps pass (MS-01 – MS-10). | ☐ |
| GNG-11 | Manual test plan (TC-001 – TC-019) signed off by developer. | ☐ |
| GNG-12 | Partner onboarding rehearsal completed successfully by both partners. | ☐ |

**Go / No-go decision**: ☐ **GO** &nbsp;&nbsp; ☐ **NO-GO**  
**Decision maker**: ___________________  
**Date / time**: ___________________

---

## 6. Rollback Plan

If a critical issue is discovered **after** distribution to partners, follow this plan.

### 6.1 Trigger Conditions (any one triggers rollback consideration)

| Condition | Severity |
|-----------|----------|
| Data loss or corruption (transactions deleted, mappings lost, household data mixed) | P0 — immediate rollback |
| Authentication bypass (users can access another user's data) | P0 — immediate rollback |
| Bank token exposure in logs or API responses | P0 — immediate rollback |
| App crash on launch for > 50% of sessions | P0 — immediate rollback |
| Email notifications sending to wrong recipients | P1 — rollback within 2 h |
| Dashboard calculation error (wrong totals) | P1 — hotfix or rollback within 4 h |
| Bank sync completely broken (no syncs completing) | P1 — hotfix or rollback within 4 h |

### 6.2 Rollback Steps

#### Step 1 — Notify partners (< 5 min)
1. Send a direct message / call to both partners: "We've identified a critical issue. The app is temporarily unavailable while we fix it. We'll update you within the hour."
2. If email is affected, use a personal channel.

#### Step 2 — Stop ingress (< 5 min)
1. Switch the app URL to a maintenance page (Cloudflare "Under maintenance" rule, or update the DNS to a static holding page).
2. Stop the BullMQ worker to prevent further bank syncs and notification dispatches: `systemctl stop power-budget-worker` (or the equivalent container stop command).

#### Step 3 — Identify the last known-good state (< 10 min)
1. Identify the last green CI run before the broken deployment: `git log --oneline origin/master`.
2. Note the commit SHA of the known-good release (e.g. `v0.9.5` tag or the previous deployment SHA).

#### Step 4 — Roll back the API + Worker (< 15 min)
1. Re-deploy the previous container image:
   ```bash
   # Example for Docker / Railway / Fly.io — adapt to actual hosting
   docker pull ghcr.io/dcervonyj/power-budget-api:<previous-sha>
   docker stop power-budget-api && docker rm power-budget-api
   docker run -d --name power-budget-api ... ghcr.io/dcervonyj/power-budget-api:<previous-sha>
   ```
2. Verify the API returns 200 on `GET /health`.

#### Step 5 — Assess DB migration rollback (< 20 min)
1. Check whether the current deployment applied any new migrations.
2. If yes, and if the migration is reversible:
   ```bash
   pnpm -F @power-budget/backend migration:revert
   ```
3. If the migration is **not** reversible (destructive): restore from the last automated backup.
   - RDS / managed Postgres: point-in-time restore to 5 minutes before the bad deployment.
   - Verify with a SELECT count on key tables (`transactions`, `plans`, `mappings`).

#### Step 6 — Roll back the web frontend (< 5 min)
1. Re-deploy the previous static build to the CDN / hosting platform.
2. Verify `https://<app-url>` loads the previous version.

#### Step 7 — Roll back the TestFlight build (< 15 min)
1. In App Store Connect → TestFlight, navigate to the previous build.
2. Select **Make available** on the prior build to push it to testers.
3. Notify partners to update via TestFlight.

#### Step 8 — Restore services and verify (< 10 min)
1. Remove the maintenance page from Cloudflare / DNS.
2. Restart the BullMQ worker.
3. Confirm `GET /health` returns healthy for API and worker.
4. Ask one partner to log in and verify the basic flow works.

#### Step 9 — Post-incident review (within 24 h)
1. Write an incident report in `docs/mvp/incidents/YYYY-MM-DD-<slug>.md`.
2. Document: timeline, root cause, impact, fix, prevention.
3. Add any missing test coverage to the manual test plan and/or Playwright suite.

---

## Appendix — Useful Commands

```bash
# Health check
curl https://<api-url>/health

# Check DB migrations status
pnpm -F @power-budget/backend migration:status

# Run all Playwright smoke tests
pnpm -F @power-budget/web test:smoke

# Run the over-budget notification job manually (dev)
curl -X POST http://localhost:3000/admin/jobs/run/notification-dispatch \
  -H "Authorization: Bearer <admin-token>"

# Run the bank sync job manually (dev)
curl -X POST http://localhost:3000/admin/jobs/run/sync-connection \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"connectionId": "<id>"}'

# Check Redis BullMQ queue depth
redis-cli -n 0 LLEN bull:sync-connection:wait

# Tail API logs
docker logs -f power-budget-api 2>&1 | grep -E "ERROR|WARN|health"
```
