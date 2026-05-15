# Key Rotation Runbook

This runbook describes procedures for rotating encryption keys in Power Budget.
The system uses a two-layer encryption scheme:

- **KEK (Key Encryption Key)**: Master key stored in environment variable `KEK_BASE64`.
  Used by `EnvKekEncryption` to directly encrypt/decrypt sensitive data fields.
- **DEK (Data Encryption Key)**: Per-user data encryption keys (planned, post BE-023).
  Currently all data is encrypted directly with the KEK.

---

## 1. Master KEK Rotation

**When to rotate**: quarterly, or immediately after suspected KEK exposure.

### Prerequisites

- Access to the production environment variables (Fly.io secrets or equivalent)
- Database admin access
- Ability to run a Node.js migration script

### Steps

#### 1.1 Generate a new KEK

```bash
# Generate a new 256-bit key encoded as base64
node -e "const c = require('crypto'); console.log(c.randomBytes(32).toString('base64'));"
```

Save the output as `NEW_KEK_BASE64`.

#### 1.2 Re-encrypt all sensitive data

Run the migration script (to be implemented as a one-off job):

```bash
# Set both old and new KEK for the migration
OLD_KEK_BASE64="<current value>" \
NEW_KEK_BASE64="<new value>" \
pnpm -F @power-budget/backend tsx scripts/migrate-kek.ts
```

The script must:

1. Read all encrypted fields from: `totp_secrets.encrypted_secret`, future OAuth token fields
2. Decrypt each field with `OLD_KEK_BASE64`
3. Re-encrypt each field with `NEW_KEK_BASE64`
4. Write the new ciphertext back atomically

#### 1.3 Deploy with new KEK

```bash
# Update the environment variable in production
fly secrets set KEK_BASE64="<NEW_KEK_BASE64>" --app power-budget-api

# Verify the deployment completed
fly status --app power-budget-api
```

#### 1.4 Verify

- Check that users can still log in (TOTP still works)
- Monitor error logs for decryption failures
- Retain the old KEK in a secure vault for 7 days in case of rollback

#### 1.5 Rollback

If decryption failures occur after rotation:

```bash
fly secrets set KEK_BASE64="<OLD_KEK_BASE64>" --app power-budget-api
```

---

## 2. Per-User DEK Rotation

**Status**: The `RotateUserDekUseCase` is implemented and ready. Full DEK isolation
(one encrypted DEK record per user) is pending BE-023.

Currently, "DEK rotation" re-encrypts all per-user sensitive fields under the current KEK
with a fresh IV, which is equivalent to re-keying each field.

### Triggering rotation for a single user

The use case can be triggered via a BullMQ job (post BE-023):

```typescript
// When the job processor is wired:
const result = await rotateUserDekUseCase.execute({ userId });
console.log(`Rotated ${result.fieldsRotated} fields for user ${userId}`);
```

### Bulk rotation (all users)

To rotate all users' DEKs after a KEK rotation:

1. Fetch all user IDs from the database
2. Enqueue a `rotate-user-dek` job for each user
3. The BullMQ processor calls `RotateUserDekUseCase.execute({ userId })` for each
4. Monitor the queue until all jobs complete

### Idempotency

`RotateUserDekUseCase` is safe to run multiple times — re-encrypting with the same key
material generates a new ciphertext with a fresh IV, which is valid and secure.

---

## 3. Sensitive fields inventory

| Table          | Column             | Encrypted                 | Rotation target |
| -------------- | ------------------ | ------------------------- | --------------- |
| `totp_secrets` | `encrypted_secret` | Yes (AES-256-GCM via KEK) | Yes             |
| `auth_methods` | `provider_subject` | No                        | N/A             |

Future fields (post bank-sync implementation):
| `bank_connections` | `consent_token` | Planned | Yes |
| `bank_connections` | `access_token` | Planned | Yes |

---

## 4. Verifying encryption health

```bash
# Check for any unencrypted totp_secrets (should return 0 rows)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM totp_secrets WHERE encrypted_secret NOT LIKE 'env-v1:%'"
```

---

## 5. Emergency contacts

- For production incidents: follow your organization's incident response playbook
- Key management owner: platform / infrastructure team
