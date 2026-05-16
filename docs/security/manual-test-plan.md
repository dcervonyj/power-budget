# Power Budget — Manual Security Test Plan

**Version**: MVP v1.0
**Environment**: Staging

---

## Test Scenarios

### 1. Authentication Flows

#### 1.1 Email/Password Login

- [ ] Valid credentials → JWT issued, redirects to dashboard
- [ ] Invalid password → 401, no user enumeration (same error message as unknown email)
- [ ] Empty password → 422 validation error
- [ ] SQL injection in email field → 422 (Zod rejects), no DB error leakage
- [ ] XSS payload in email field → sanitised, no script execution

#### 1.2 TOTP (Two-Factor Authentication)

- [ ] Enroll TOTP → QR code displayed, backup codes generated
- [ ] Login with valid TOTP → access granted
- [ ] Login with expired TOTP → 401
- [ ] Login with previously-used TOTP → 401 (replay prevention)
- [ ] Brute-force TOTP (10 attempts) → account locked or rate limited
- [ ] Backup code works for recovery
- [ ] Backup code cannot be used twice

#### 1.3 Magic Link

- [ ] Request magic link → email received within 60s
- [ ] Use magic link → session created, link invalidated
- [ ] Use magic link twice → second use rejected (single-use)
- [ ] Use expired magic link (>15 min) → 401
- [ ] Craft magic link with different email → rejected

#### 1.4 JWT Handling

- [ ] Tampered JWT signature → 401
- [ ] Expired access token → 401 with WWW-Authenticate header
- [ ] Refresh token rotation: use old refresh token after rotation → 401

---

### 2. Bank Connect Flow

#### 2.1 GoCardless OAuth

- [ ] Initiate connect → redirected to GoCardless consent page
- [ ] Cancel at consent page → graceful return, no orphaned state
- [ ] Complete consent → accounts linked, transactions start syncing
- [ ] Reconnect expired connection → new consent flow, existing data preserved

#### 2.2 Wise API

- [ ] Connect Wise account → API key validated, balances visible
- [ ] Invalid Wise API key → error shown, not logged in plaintext

#### 2.3 Webhook Security

- [ ] GoCardless webhook with invalid HMAC signature → 400 rejected
- [ ] GoCardless webhook replay (same `id`) → idempotent (no duplicate transactions)

---

### 3. Data Export & Delete

#### 3.1 Export

- [ ] POST /households/export → job queued, 202 returned
- [ ] Poll for status → pending → ready → download URL
- [ ] Download URL is time-limited (try after 15 min → expired)
- [ ] Another user cannot download another household's export (403)
- [ ] Export contains complete transaction history

#### 3.2 Account Deletion

- [ ] DELETE /households/:id without confirmation → 400
- [ ] DELETE /households/:id with confirmation → 200, 30-day soft delete scheduled
- [ ] After soft delete: login returns 403 (account pending deletion)
- [ ] Within 30 days: cancel deletion restores account
- [ ] After 30 days: all data purged (verify in DB)

---

### 4. Cross-Tenant Isolation

#### 4.1 Direct Object Reference

- [ ] User A cannot read User B's plans (GET /plans/:id → 403)
- [ ] User A cannot map User B's transactions (POST /mappings → 403)
- [ ] User A cannot view User B's categories (GET /categories → only returns own)
- [ ] User A cannot export User B's household (POST /households/:id/export → 403)

#### 4.2 RLS Verification

- [ ] Connect directly to Postgres as `app_user` role
- [ ] Attempt `SELECT * FROM plans WHERE household_id = 'other-household'` → 0 rows (RLS blocks)
- [ ] Attempt `UPDATE transactions SET amount_minor = 0` without `SET LOCAL app.household_id` → RLS blocks

---

### 5. Input Validation

#### 5.1 Transaction Amounts

- [ ] Negative amount → 422 validation error
- [ ] Zero amount → accepted (transfers can be 0)
- [ ] Amount > max bigint → 422
- [ ] Float amount string "12.50" → 422 (only integers allowed in minor units)

#### 5.2 Fuzz Testing (Manual)

- [ ] Send oversized payload (>10MB) → 413 rejected
- [ ] Send deeply nested JSON → 422 or 413
- [ ] Send binary data as JSON body → 400

---

### 6. Notification Security

#### 6.1 Email Delivery

- [ ] Notification emails contain unsubscribe link
- [ ] Unsubscribe marks `email_bouncing = true`, no further emails sent
- [ ] Notification payload does not contain sensitive data in email subject line

#### 6.2 Outbox Pattern

- [ ] Kill worker mid-dispatch → job retried, notification sent exactly once (check `dedupe_key`)
- [ ] Duplicate outbox entries rejected by unique constraint

---

## Test Environment Setup

```bash
# Start local environment
pnpm dev:db:up
pnpm -F @power-budget/backend db:migrate
pnpm -F @power-budget/backend db:seed

# Create test users
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"attacker@test.com","password":"Test123!","displayName":"Attacker"}'

curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"victim@test.com","password":"Test123!","displayName":"Victim"}'
```

## Reporting

Document findings in: `docs/security/findings-YYYY-MM-DD.md`

Severity levels:

- **Critical**: Data exposure, authentication bypass, privilege escalation
- **High**: CSRF, SSRF, stored XSS, SQL injection
- **Medium**: Reflected XSS, open redirect, missing rate limiting
- **Low**: Information disclosure, missing security headers
