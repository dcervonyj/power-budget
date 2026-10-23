# Key Rotation Runbook

This runbook describes procedures for rotating encryption keys in Power Budget.
The system uses a two-layer encryption scheme:

- **KEK (Key Encryption Key)**: Master key stored in environment variable `KEK_BASE64`.
  Used by `EnvKekEncryption` to directly encrypt/decrypt sensitive data fields.
- **DEK (Data Encryption Key)**: not used. Per-user DEKs were descoped in CLN-004
  (see section 2); all data is encrypted directly with the KEK.

---

## 1. Master KEK Rotation

**When to rotate**: quarterly, or immediately after suspected KEK exposure.

### Prerequisites

- Access to the production environment variables (the Render dashboard today; the VPS `.env` after HOST-002 per ADR-003)
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
# Render (current): Dashboard -> power-budget-api-eu -> Environment -> set KEK_BASE64, then redeploy.
# VPS (after HOST-002): edit the compose .env, then `docker compose up -d api worker`.
# Verify the deployment completed (Render deploy log, or `docker compose ps`).
```

#### 1.4 Verify

- Check that users can still log in (TOTP still works)
- Monitor error logs for decryption failures
- Retain the old KEK in a secure vault for 7 days in case of rollback

#### 1.5 Rollback

If decryption failures occur after rotation:

```bash
# Put the old KEK_BASE64 back (Render dashboard, or the VPS .env) and redeploy.
```

---

## 2. Per-User DEK (descoped, CLN-004)

**Decision (SEC-001 / SEC-002, CLN-004):** Power Budget is a two-person app with one
deployment. All sensitive fields are encrypted directly with the env KEK
(`EnvKekEncryption`, AES-256-GCM, a fresh IV per value, a `kid` in every ciphertext).
There is no per-user DEK and no DEK rotation; the unused `RotateUserDekUseCase` was
removed. KEK rotation (section 1) re-encrypts every field and is the only rotation.
Revisit when there is a managed KMS (envelope encryption) or many tenants.

TOTP secrets are encrypted with the context `totp:<userId>`, bound as GCM additional
authenticated data: a ciphertext copied to another user's row fails to decrypt. A KEK
rotation script must pass the same context when it decrypts and re-encrypts
`totp_secrets.encrypted_secret`. Bank consents are encrypted without a context.

---

## 3. Sensitive fields inventory

| Table          | Column             | Encrypted                                          | Rotation target |
| -------------- | ------------------ | -------------------------------------------------- | --------------- |
| `totp_secrets` | `encrypted_secret` | Yes (AES-256-GCM via KEK, context `totp:<userId>`) | Yes             |
| `auth_methods` | `provider_subject` | No                                                 | N/A             |

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
