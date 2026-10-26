# Data Deletion Runbook

**Power Budget — GDPR Deletion Runbook**
Version: 1.0 | Applies to: v1 (MVP)

---

## Overview

This runbook covers the full lifecycle of a household deletion request under GDPR Article 17 (Right to Erasure). The process has two phases:

1. **Soft-hold (30 days):** Household is hidden from the UI and recoverable by support. Data remains in the database.
2. **Hard-delete:** All household-owned rows are permanently deleted. Audit-log cross-references are anonymised.

---

## Triggering Deletion

### Path 1 — User-initiated via API

The household owner (or any admin member) sends:

```http
DELETE /households/:id
Authorization: Bearer <access_token>
```

This endpoint:

1. Validates that the requester is the household owner
2. Checks that the household has not already been scheduled for deletion
3. Sets `households.delete_scheduled_at = NOW() + INTERVAL '30 days'`
4. Writes an audit log entry: `household.deletion_scheduled`
5. Enqueues a `household-export` job to generate a final data export for the user (sent by email within 72 hours)
6. Returns `204 No Content`

The household becomes invisible in the UI immediately after this call (application layer filters `WHERE delete_scheduled_at IS NULL`).

### Path 2 — Admin-initiated (support / compliance)

An admin with database access or an admin CLI tool may trigger deletion for:

- Abuse / Terms of Service violations
- Court order / regulatory requirement
- Manual GDPR erasure request received by email (privacy@powerbudget.app)

**Admin CLI command** (to be implemented):

```bash
pnpm -F @power-budget/backend cli household:schedule-deletion <householdId> --reason "GDPR_REQUEST" --admin-email "admin@powerbudget.app"
```

This performs the same steps as the API path but bypasses the ownership check and accepts a `--reason` flag for audit purposes.

### Path 3 — Recovery within 30-day window

A support agent can recover a household during the soft-hold period:

```bash
pnpm -F @power-budget/backend cli household:cancel-deletion <householdId> --admin-email "admin@powerbudget.app"
```

This clears `delete_scheduled_at` and writes an audit entry `household.deletion_cancelled`.

---

## Hard-Delete Process (automated)

The worker's `household-purge` cron (daily 03:30 UTC, `HouseholdPurgeCronService`, worker process only, system DB scope) runs `PurgeDeletedHouseholdsUseCase` (CLN-022). It processes every household where `households.delete_scheduled_at <= NOW()`, in batches of 50, oldest first. A household that fails is logged, skipped for the rest of that run and stays scheduled, so it is retried by the next run and never blocks the others.

### Deletion order (respects FK constraints)

Each household is purged in its own transaction (default isolation, READ COMMITTED). The transaction first locks the household row (`SELECT ... FOR UPDATE`) and re-checks `delete_scheduled_at <= NOW()`, so a deletion cancelled meanwhile is skipped. `DrizzleHouseholdPurgeRepository` then deletes, in this order:

```sql
-- 1. Bank sync and financial data (children before parents)
DELETE FROM sync_runs WHERE connection_id IN (SELECT id FROM bank_connections WHERE household_id = :id);
DELETE FROM transaction_mappings WHERE transaction_id IN (SELECT id FROM transactions WHERE household_id = :id);
DELETE FROM transfers WHERE household_id = :id;
DELETE FROM transactions WHERE household_id = :id;
DELETE FROM bank_accounts WHERE household_id = :id;
DELETE FROM bank_connections WHERE household_id = :id;

-- 2. Plans and categories
DELETE FROM planned_item_versions WHERE household_id = :id;
DELETE FROM planned_items WHERE household_id = :id;
DELETE FROM leftover_snapshots WHERE household_id = :id;
DELETE FROM plans WHERE household_id = :id;
DELETE FROM category_privacy WHERE household_id = :id;
DELETE FROM categories WHERE household_id = :id;

-- 3. Export artifacts, notifications, invites
DELETE FROM household_exports WHERE household_id = :id;
DELETE FROM notifications_outbox WHERE household_id = :id;
DELETE FROM household_invites WHERE household_id = :id;

-- 4. Membership, then the household itself
DELETE FROM household_users WHERE household_id = :id;
DELETE FROM households WHERE id = :id;
```

FX rates are shared reference data and are not deleted.

### Audit log anonymisation

Audit rows are never deleted. `audit_log` is append-only for the app role, so anonymisation is done by the foreign keys: since migration `0015_cln-022_audit_set_null`, `audit_log.household_id` and `audit_log.actor_user_id` are `ON DELETE SET NULL`. Deleting the household nulls `household_id`; deleting a user with no remaining household nulls `actor_user_id`; an actor who still has another household keeps the reference. The `UPDATE` below is the equivalent in plain SQL (it is not run by the code and the `context` flag is not written):

```sql
UPDATE audit_log
SET actor_user_id = NULL,
    context = context || '{"actor_anonymised": true}'
WHERE actor_user_id IN (
  SELECT u.id FROM users u
  LEFT JOIN household_users hm ON hm.user_id = u.id
  WHERE hm.user_id IS NULL  -- user has no remaining households
);
```

If the actor still has another household, their `actor_user_id` is **retained** (they are still an active user).

### User account deletion

In the same transaction, each former member who has no remaining household membership loses the account. The code deletes, for those users: `sessions`, `auth_methods`, `totp_secrets` (encrypted TOTP secret), `magic_link_tokens`, and the `notifications_outbox` rows addressed to them; it sets `household_invites.invited_by_user_id` / `accepted_by_user_id` and `plans.owner_user_id` to NULL, then deletes the `users` row. A member who still belongs to another household keeps their account.

Not implemented: deletion of key material from a KMS (the app uses an environment KEK, there are no per-user DEK grants). Bank consent tokens live in the deleted household's `bank_connections` rows.

---

## Verification

After a hard-delete, run the following verification query:

```sql
-- Should return 0 rows
SELECT 'households' AS tbl, COUNT(*) FROM households WHERE id = :id
UNION ALL
SELECT 'plans', COUNT(*) FROM plans WHERE household_id = :id
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions WHERE household_id = :id
UNION ALL
SELECT 'bank_connections', COUNT(*) FROM bank_connections WHERE household_id = :id
UNION ALL
SELECT 'notifications_outbox', COUNT(*) FROM notifications_outbox WHERE household_id = :id;
```

All rows should be 0 after deletion.

---

## Data Export (pre-deletion)

Before the hard-delete, the system generates a GDPR data export artifact:

- Triggered automatically when `DELETE /households/:id` is called
- Contains all household data as a single JSON document
- Excludes encrypted blobs (existence is noted but ciphertext is not exported)
- Stored in S3-compatible storage with a signed URL (24-hour TTL)
- URL sent to the household owner's email

The export includes:

- `household`: name, createdAt
- `members`: userId, email, role, joinedAt
- `plans`: all plans + planned items + versions
- `categories`: all categories + privacy settings
- `transactions`: all transactions + mappings + transfers
- `bankConnections`: provider, accountId, connectedAt, lastSuccessfulAt (no tokens)
- `auditLog`: all audit events (limited to this household)
- `notificationsOutbox`: pending/sent notifications (no email bodies)

---

## Timeline Summary

| Day  | Event                                                             |
| ---- | ----------------------------------------------------------------- |
| 0    | User triggers `DELETE /households/:id`; household hidden from UI  |
| 0    | Data export job enqueued                                          |
| 1–3  | Data export artifact generated and emailed to owner               |
| 1–30 | Soft-hold: data preserved, recovery possible via support          |
| 30   | Hard-delete worker fires                                          |
| 30   | All household rows deleted; audit log anonymised where applicable |
| 30   | User account deleted if no remaining households                   |
| 31+  | Verification query: run manually (the job only logs purge counts) |

---

## Contact for Manual Requests

Email: privacy@powerbudget.app
Subject: "GDPR Erasure Request — [HouseholdId or email]"

Response time: 72 hours acknowledgement, 30 days completion (per Art. 12 GDPR).
