# Enable Banking: ASPSP facts for PKO BP and Wise (SPK-001)

> Checked 2026-10-30 against the live API (`api.enablebanking.com`) with the owner's own accounts.
> Application: "Power Budget", Production, restricted mode ("Account Information Restricted"), id `fb830e50-9f13-4fc0-b63c-741aae8fadb8` (the JWT `kid`; not a secret).
> Raw responses stay on the owner's machine (`~/.config/power-budget/enablebanking/spike-data`, mode 600); this page holds only aggregates, no account numbers, names or amounts.

## Setup that worked

1. Control Panel → Add a new application → Production → "Generate outside the browser and import public certificate". The key pair is an RSA 4096 key and a self-signed certificate (`openssl req -x509`); the private key never leaves the owner's machine.
2. The form needs a privacy URL and a terms URL. We used the repo's `docs/mvp/legal/PRIVACY_POLICY.md` and the repo root until the web app has its own pages.
3. Redirect URLs must be `https`; `http://localhost` is refused ("uses unsupported scheme"), `https://localhost:8765/eb-callback` is accepted. The spike used that local URL with a self-signed certificate so the authorisation code never left the machine.
4. "Activate by linking accounts" (country, ASPSP, usage type `personal`, bank SCA) moves the application to Active. Each linked account appears in the Control Panel (PKO: 1 IBAN; Wise: 1 BBAN, several IBANs and UID accounts).
5. Data access still needs the normal API flow: `POST /auth` → bank SCA → `POST /sessions {code}`. Linking in the Control Panel alone gives no session.

## ASPSP metadata (`GET /aspsps?country=PL`)

| Field                      | PKO BP                                    | Wise                                      |
| -------------------------- | ----------------------------------------- | ----------------------------------------- |
| `name` / `country`         | `PKO Bank Polski` / `PL`                  | `Wise` / `PL`                             |
| `maximum_consent_validity` | 15552000 s (180 days)                     | 15552000 s (180 days)                     |
| `psu_types`                | `business`, `personal`                    | `personal`, `business`                    |
| `auth_methods`             | `REDIRECT` for both PSU types, not hidden | `REDIRECT` for both PSU types, not hidden |
| `required_psu_headers`     | not set                                   | not set                                   |
| `beta`                     | `true`                                    | `false`                                   |
| Payments                   | none                                      | none                                      |

Both sessions were created with `valid_until` = now + 180 days and `psu_type: personal`; `access.valid_until` came back as 2027-04-28.

## Accounts and balances

|                         | PKO BP           | Wise                                                                                 |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------ |
| Accounts in the session | 1 (PLN, `CACC`)  | 8, **one per currency balance** (USD, CZK, EUR, GBP, PLN, THB, TRY, UAH), all `CACC` |
| `account_id`            | `iban` + `other` | `iban` + `other`                                                                     |
| `identification_hash`   | present          | present                                                                              |
| Balance types           | `ITBD`, `ITAV`   | `ITAV` only                                                                          |

## Transactions (`strategy=longest`)

|                                  | PKO BP                                      | Wise (all 8 accounts)                                                         |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Rows                             | 1189                                        | 7784                                                                          |
| Pages (`continuation_key`)       | 24                                          | 70 in total (39 for the busiest account)                                      |
| History depth                    | 2026-01-12 → 2026-10-29 (about 9.5 months)  | 2024-10-30 → 2026-10-29 (exactly 2 years on the oldest account)               |
| Status                           | `BOOK` 1189                                 | `BOOK` 7783, `PDNG` 1                                                         |
| `entry_reference`                | 100%, unique in this sample, 3–6 characters | 100%, **not unique** (see below)                                              |
| `transaction_id`                 | 100%                                        | 0%                                                                            |
| `booking_date`                   | 100%                                        | 100% (also on the `PDNG` row)                                                 |
| `value_date`, `transaction_date` | empty                                       | empty                                                                         |
| `merchant_category_code`         | empty                                       | empty                                                                         |
| `bank_transaction_code`          | empty                                       | 100%: `CARD` 7411, `TRANSFER` 243, `DEPOSIT` 81, `UNKNOWN` 26, `CONVERSION` 2 |
| `creditor` / `debtor`            | 6% / 1%                                     | 100% / 100%                                                                   |
| `remittance_information`         | 100%, a list of strings                     | 100%, a list of strings                                                       |
| `reference_number`               | empty                                       | 100%                                                                          |
| `balance_after_transaction`      | 100%                                        | empty                                                                         |
| Direction                        | `DBIT` 1147, `CRDT` 42                      | `DBIT` 7625, `CRDT` 159                                                       |

### Wise `entry_reference` and fees

- The format is `<profile id>.<KIND>-<id>`, with kinds `CARD`, `FEE-CARD`, `TRANSFER`, and others. Two profile ids appear in the prefixes.
- **Fees are separate rows**: 3745 of the 7784 rows (48%) are `FEE-*` rows (largest 27.29, most a few cents). A `FEE-CARD-<id>` row belongs to the `CARD-<id>` row with the same id.
- 132 references occur more than once within one account (none across accounts):
  - 93 groups are fully identical rows, next to each other in the response, all `FEE-CARD` rows of 0.26 or less.
  - 39 groups differ: only in `booking_date` (13), in `transaction_amount` (5), in amount and date (7), or in direction, amount and counterparty (`CRDT` next to `DBIT`, refunds and reversals).
- So `entry_reference` alone cannot be the Wise idempotency key: it would drop real refunds and re-bookings. BNK-001 needs a key that includes at least the direction, the amount and the booking date, plus an occurrence index for fully identical rows.

### Pending rows

- Wise shows an uncleared card payment as `PDNG` with an `entry_reference` and a `booking_date`. Whether the same reference later comes back as `BOOK` is not checked yet (re-fetch after it clears).
- PKO returned no `PDNG` or `HOLD` rows. It is not known yet whether PKO hides pending card payments or there were none at the time; check right after a card payment.

## Rate limits (unattended, no PSU headers)

On 2026-10-30, within about 10 minutes and without PSU headers:

- PKO: 2 full transaction fetches (25 calls each), then 5 × (`GET /sessions/{id}` + balances). No 429, no `ASPSP_RATE_LIMIT_EXCEEDED`.
- Wise: 1 full fetch (78 calls), then 2 × (`GET /sessions/{id}` + balances). No errors.

The "about 4 unattended fetches a day" limit from the EB FAQ did not show up on the first day. EB may serve repeats from cache; the "Data insights" page in the Control Panel shows market data, not our usage, so it cannot confirm the counting. The application's "Requests" menu is the next place to look. Re-check on a normal schedule (every 4 h) before SYNC-005 relies on it.

## Still open

- Partner linking from the owner's application and any cap on linked accounts: not tested (the partner has not linked yet). The owner linked 9 accounts (1 PKO + 8 Wise) without hitting a cap. The email to EB support is drafted in `docs/mvp/plan-banking.md` §6 question 1.
- Whether a `PDNG` row keeps its `entry_reference` when it is booked (Wise), and whether PKO shows pending card payments.
- PKO history depth: 9.5 months came back with `longest`; whether that is a PKO limit or the start of this account's history is not known.
