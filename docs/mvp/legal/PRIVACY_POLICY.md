# Privacy Policy

**Power Budget**
Last updated: <!-- RELEASE_DATE -->

## 1. Who We Are

Power Budget ("we", "us", "our") is a personal finance application that helps households track budgets and bank transactions. This Privacy Policy explains how we collect, use, and protect your personal data in accordance with the General Data Protection Regulation (EU) 2016/679 ("GDPR") and applicable national data protection laws.

**Data Controller:** Power Budget (contact: privacy@powerbudget.app)

---

## 2. What Data We Collect

### 2.1 Account Data
- Email address (required for account creation and notifications)
- Password hash (bcrypt — we never store raw passwords)
- TOTP secret (stored encrypted at rest using AES-256-GCM with per-user DEK)
- Preferred locale and base currency

### 2.2 Household & Budget Data
- Household name and member relationships
- Budget plans, planned items, and categories
- Category privacy preferences (set per category by each household member)
- Manually entered transactions and notes

### 2.3 Bank Connection Data (if you connect a bank)
- Bank provider name and account identifiers from GoCardless (PSD2) or Wise
- Consent tokens (stored encrypted at rest — we never store your bank login credentials)
- Transaction data imported from your bank: date, amount, currency, description, merchant name

### 2.4 Technical Data
- Hashed IP address (for audit log context — never stored in raw form)
- User-agent class (browser family only, not full string)
- Session tokens (short-lived JWT; refresh tokens stored encrypted)
- Sentry error reports (anonymised before sending — email and IP stripped)

### 2.5 Audit Log
We maintain an append-only audit log of every data-changing action in your household. This log records: action type, actor (you or a household member), affected entity, and timestamp. The audit log is retained indefinitely in MVP (subject to review at v3).

---

## 3. Legal Basis for Processing

| Data | Legal Basis |
|------|-------------|
| Account data | Contract performance (Art. 6(1)(b)) |
| Bank connection data | Consent (Art. 6(1)(a)) — you explicitly connect each bank |
| Budget and transaction data | Contract performance (Art. 6(1)(b)) |
| Audit log | Legitimate interests — security and fraud prevention (Art. 6(1)(f)) |
| Notification emails | Contract performance / legitimate interests |
| Error reporting (Sentry) | Legitimate interests — service reliability |

---

## 4. How We Use Your Data

- **Core service:** Store and display your budget plans, transactions, and category aggregates
- **Bank sync:** Fetch transactions automatically every 4 hours from connected bank accounts via GoCardless or Wise API
- **Notifications:** Send email alerts for over-budget categories, weekly spending digests (opt-out available), and bank-reconnect reminders
- **Security:** Maintain audit logs, detect anomalous access patterns, enforce multi-tenancy (your data is never visible to other households)
- **Reliability:** Anonymised crash reports via Sentry to improve the application

---

## 5. Data Sharing

We do not sell your personal data. We share data only with:

| Recipient | Purpose | Data shared |
|-----------|---------|------------|
| GoCardless Ltd (UK/EU) | PSD2 bank data aggregation | Account consent tokens, transaction queries |
| Wise Payments Ltd | Wise account data (if you connect) | Wise API token (encrypted at rest) |
| Resend Inc (USA) | Transactional email delivery | Email address + notification content |
| Sentry (USA) | Error monitoring | Anonymised crash data (no email, no IP) |
| PostgreSQL hosting (EU region) | Data storage | All household data |

All processors are bound by Data Processing Agreements. US transfers rely on Standard Contractual Clauses (SCCs).

---

## 6. Data Retention

| Category | Retention Period |
|----------|----------------|
| Active account data | For the lifetime of the account |
| Deleted household data | 30-day soft-hold, then hard-deleted (see §8) |
| Audit log | Indefinite in MVP; anonymised if actor account deleted |
| Bank connection tokens | Deleted immediately on disconnection |
| Exported data artifacts | 24 hours (signed URL TTL) |

---

## 7. Your Rights

Under GDPR you have the right to:

- **Access** your data — `GET /me/data-export` generates a full JSON export of all household data within 72 hours
- **Rectification** — update your profile via Settings
- **Erasure** — `DELETE /households/:id` triggers the deletion process described in §8
- **Restriction** — contact privacy@powerbudget.app
- **Portability** — your data export is in machine-readable JSON format
- **Withdraw consent** — disconnect any bank account at any time; this revokes consent and deletes the consent token
- **Complain** — to your national supervisory authority (e.g., UODO in Poland, ICO in the UK)

To exercise rights not available via in-app self-service, email privacy@powerbudget.app with subject "GDPR Request — [right]".

---

## 8. Security

- **Encryption at rest:** Sensitive fields (bank tokens, TOTP secrets, OAuth refresh tokens) use AES-256-GCM with per-user Data Encryption Keys (DEKs). DEKs are wrapped by a master KEK stored in AWS KMS (production) or environment variable (development only).
- **Encryption in transit:** TLS 1.2+ everywhere; HSTS preload enabled; Cloudflare in front.
- **Access control:** Postgres Row-Level Security enforces per-household data isolation as defence-in-depth, in addition to application-level household scoping.
- **TOTP step-up:** Sensitive actions (connect/disconnect bank, change email, request data export) require re-verification of TOTP within the last 5 minutes.

---

## 9. Cookies and Local Storage

We do not use tracking cookies. We use `localStorage` in the web application for:
- JWT access token (cleared on logout)
- Locale preference (`pb_locale`)
- Theme preference

---

## 10. Children

Power Budget is not directed at children under 18. We do not knowingly collect data from children.

---

## 11. Changes to This Policy

We will notify you by email at least 30 days before any material change to this policy. Continued use after the effective date constitutes acceptance.

---

## 12. Contact

**Data Controller:** Power Budget
**Email:** privacy@powerbudget.app
**DPO:** Not required at current scale — contact general privacy address above.
