# Wise personal API token and `balances#update` webhook (SPK-002)

> Checked 2026-10-30 against `api.wise.com` with the owner's own personal profile.
> Raw responses stay on the owner's machine (`~/.config/power-budget/wise/spike-data`, mode 600); this page and the fixtures hold no account numbers, names or real amounts.

## Token availability

| Person  | Personal API tokens                                                              |
| ------- | -------------------------------------------------------------------------------- |
| Owner   | Yes: `wise.com → Settings → API tokens` offers Full access and Read only tokens. |
| Partner | Not checked yet.                                                                 |

The create form has an optional "Allowed IPs" list. We left it empty because the owner's egress IP changes (VPN); the Full token lived a few minutes.

## Read-only token

| Call                                            | Result                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/profiles`                              | 200, one `personal` profile                                                                                                          |
| `GET /v4/profiles/{id}/balances?types=STANDARD` | 200, no SCA challenge; 8 balances (CZK, EUR, GBP, PLN, THB, TRY, UAH, USD), the same currencies Enable Banking returns as 8 accounts |
| `GET /v1/profiles/{id}/activities?size=100`     | 200, no SCA challenge; cursor paging (`cursor` → `nextCursor`); 30 pages read = 3000 activities back to July 2025, more available    |
| `GET /v3/profiles/{id}/subscriptions`           | 200, lists the subscriptions                                                                                                         |
| `POST /v3/profiles/{id}/subscriptions`          | **403 `unauthorized`**: creating a subscription needs a Full access token                                                            |

Activities:

- Fields: `id`, `type`, `resource {type, id}`, `title`, `description`, `primaryAmount`, `secondaryAmount`, `status`, `createdOn`, `updatedOn`.
- Types seen: `CARD_PAYMENT` 2754, `TRANSFER` 135, `CARD_CHECK` 54, `CASH_WITHDRAWAL` 32, `BALANCE_CASHBACK` 17, `DIRECT_DEBIT_TRANSACTION` 6, `INTERBALANCE` 2. Statuses: `COMPLETED` 2814, `CANCELLED` 186.
- `resource.type:resource.id` was unique across all 3000 rows. Fees are not separate rows (unlike Enable Banking, see [`eb-aspsp-facts.md`](eb-aspsp-facts.md)).
- Amounts are display strings: `"12 EUR"`, `"<positive>+ 1.23 USD</positive>"`; `title` carries tags such as `<strong>`. `secondaryAmount` is empty unless there was a conversion. They need parsing and are only good for enrichment, not for money.

## `balances#update` subscription

- `POST /v3/profiles/{profileId}/subscriptions` with `{ name, trigger_on: "balances#update", delivery: { version, url } }` → 201. Versions `2.0.0` and `4.0.0` both work.
- Wise sends a test notification (`X-Test-Notification: true`, dummy data) to the URL within seconds of creating the subscription.
- **Use schema `4.0.0`.** It adds `balance_id`, `step_id`, `post_transaction_balance_amount` and `channel_name`; `2.0.0` has only `resource`, `amount`, `currency`, `transaction_type`, `occurred_at`, `transfer_reference`.
- After the Full token was deleted, both subscriptions were still listed (read-only token). Delivery after the deletion: see "Still open".

### Payload (`4.0.0`)

- Top level: `data`, `subscription_id`, `event_type`, `schema_version`, `sent_at`.
- `data.resource`: `{ id, profile_id, type: "balance-account" }`.
- `amount` is a positive JSON number; the sign is in `transaction_type` (`debit` / `credit`). `step_id` is a number. `channel_name` was `TRANSFER` for a transfer (`BALANCE` in the test notification).
- One real event per subscription: the owner's transfer reached both subscriptions in the same millisecond, about 230 ms after `occurred_at`.

Fixtures (in [`wise-fixtures/`](wise-fixtures)):

- `balances-update-v2-test.json`, `balances-update-v4-test.json`: Wise test notifications (dummy data) with the exact raw body and the real `X-Signature-SHA256`. They verify against the production key and fail when one byte is added. WISE-001 can use them as-is.
- `balances-update-v4-real-anonymised.json`: the real transfer event with ids, amounts, reference and currency replaced; field names, order and JSON types kept. The signature does not apply to it.
- `wise-webhook-production.pub`: the production public key from the Wise event-handling guide (RSA 2048).

Check a fixture by hand:

```bash
node -e 'const f=require("./balances-update-v4-test.json");require("fs").writeFileSync("/tmp/b",f.body);require("fs").writeFileSync("/tmp/s",Buffer.from(f.headers["x-signature-sha256"],"base64"))'
openssl dgst -sha256 -verify wise-webhook-production.pub -signature /tmp/s /tmp/b   # Verified OK
```

### Headers

`content-type`, `user-agent`, `x-delivery-id`, `x-signature-sha256`, `x-signature` (a second signature header, not used here), `x-tw-client-request-start-epoch-ms`, and `x-test-notification` on test messages. Senders seen: `18.184.162.0/24` and `52.58.50.0/24` (AWS Frankfurt), not the `45.129.54.0/23` ranges in `plan-banking.md`. An IP allow-list must use Wise's current published list, or be left out in favour of the signature.

## Enrichment from activities (WISE-003)

For the real transfer, `activities?since=occurred_at-5m&until=occurred_at+5m` returned exactly one activity (`TRANSFER`, `COMPLETED`, created 3 s before `occurred_at`):

- The webhook `amount` equals the activity's `secondaryAmount`, not `primaryAmount`: for a conversion, `primaryAmount` is the target currency and `secondaryAmount` the balance currency.
- The webhook `transfer_reference` contains the activity's `resource.id`. Match on that reference first and fall back to amount and currency only when there is no reference (card payments: still to check).

## Still open

- A card payment event: its `channel_name`, `transfer_reference` and how it matches a `CARD_PAYMENT` activity.
- Delivery after the Full token is deleted (the subscriptions are still listed; the next real event confirms delivery).
- The partner's token availability.
- The two spike subscriptions point at a temporary Cloudflare quick tunnel. Delete them once the checks are done (`DELETE /v3/profiles/{id}/subscriptions/{subscriptionId}`, read-only token to be tested; otherwise a new Full token).
