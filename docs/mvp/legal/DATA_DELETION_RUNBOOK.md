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
3. Sets `households.scheduledForDeletion = NOW() + INTERVAL '30 days'`
4. Writes an audit log entry: `household.deletion_scheduled`
5. Enqueues a `household-export` job to generate a final data export for the user (sent by email within 72 hours)
6. Returns `204 No Content`

The household becomes invisible in the UI immediately after this call (application layer filters `WHERE scheduled_for_deletion IS NULL`).

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

This clears `scheduled_for_deletion` and writes an audit entry `household.deletion_cancelled`.

---

## Hard-Delete Process (automated)

A BullMQ worker job (`household-export` + `period-close` queue) runs daily and processes households where `scheduled_for_deletion < NOW()`.

### Deletion order (respects FK constraints)

The worker deletes rows in the following order using a single serialisable transaction:

```sql
-- 1. Bank data
DELETE FROM sync_runs WHERE household_id = :id;
DELETE FROM bank_accounts WHERE household_id = :id;
DELETE FROM bank_connections WHERE household_id = :id;

-- 2. Financial data
DELETE FROM transaction_mappings WHERE household_id = :id;
DELETE FROM transfers WHERE household_id = :id;
DELETE FROM transactions WHERE household_id = :id;
DELETE FROM planned_item_versions WHERE household_id = :id;
DELETE FROM planned_items WHERE household_id = :id;
DELETE FROM plans WHERE household_id = :id;
DELETE FROM category_privacy WHERE household_id = :id;
DELETE FROM categories WHERE household_id = :id;

-- 3. Export artifacts
DELETE FROM household_exports WHERE household_id = :id;

-- 4. Notifications
DELETE FROM notifications_outbox WHERE household_id = :id;

-- 5. FX rates (household-specific only; shared rates are not deleted)
-- (no household-scoped fx_rates in MVP)

-- 6. Household membership
DELETE FROM household_members WHERE household_id = :id;

-- 7. Household itself
DELETE FROM households WHERE id = :id;
```

### Audit log anonymisation

Audit log rows reference actors who may be shared across households. We do **not** delete audit rows — instead, we anonymise the actor reference for rows whose `actor_user_id` belongs to a user who has no remaining households:

```sql
UPDATE audit_log
SET actor_user_id = NULL,
    context = context || '{"actor_anonymised": true}'
WHERE actor_user_id IN (
  SELECT u.id FROM users u
  LEFT JOIN household_members hm ON hm.user_id = u.id
  WHERE hm.user_id IS NULL  -- user has no remaining households
);
```

If the actor still has another household, their `actor_user_id` is **retained** (they are still an active user).

### User account deletion

If a user has no remaining household memberships after the deletion, their account is eligible for deletion:

```sql
DELETE FROM users WHERE id = :userId
AND NOT EXISTS (
  SELECT 1 FROM household_members WHERE user_id = :userId
);
```

User-owned encrypted data deleted in this step:
- TOTP secret (encrypted blob)
- OAuth refresh tokens (encrypted blobs)
- DEK (Data Encryption Key) — deleted from KMS grants

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

| Day | Event |
|-----|-------|
| 0 | User triggers `DELETE /households/:id`; household hidden from UI |
| 0 | Data export job enqueued |
| 1–3 | Data export artifact generated and emailed to owner |
| 1–30 | Soft-hold: data preserved, recovery possible via support |
| 30 | Hard-delete worker fires |
| 30 | All household rows deleted; audit log anonymised where applicable |
| 30 | User account deleted if no remaining households |
| 31+ | Verification query run by worker; result logged |

---

## Contact for Manual Requests

Email: privacy@powerbudget.app
Subject: "GDPR Erasure Request — [HouseholdId or email]"

Response time: 72 hours acknowledgement, 30 days completion (per Art. 12 GDPR).
