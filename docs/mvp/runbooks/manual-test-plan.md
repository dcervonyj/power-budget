# Power Budget — Manual Test Plan (MVP)

> Covers all 16 PRD user stories (§5) plus locale, currency, and biometric extras.
> Run against: **Web** `http://localhost:5173` · **API** `http://localhost:3000`
> Mobile tests run on physical iOS device or iOS Simulator.
> Local infra: `pnpm dev:db:up` (Postgres :5432, Redis :6379, Mailpit :8025).

---

## Test Environment Setup

| Step | Action |
|------|--------|
| 1 | `pnpm dev:db:up` — wait for all containers healthy |
| 2 | `pnpm dev` — start API (:3000) + Web (:5173) |
| 3 | Open Mailpit at `http://localhost:8025` for email interception |
| 4 | Prepare two test email addresses (e.g. `tester1@example.com`, `tester2@example.com`) |
| 5 | Have a TOTP app ready (e.g. Google Authenticator) |
| 6 | GoCardless sandbox credentials available (see `.env.example`) |

---

## Test Cases

---

### TC-001: User Registration (email + password)
**Story**: US-01 — As a new user I can register with my email address and a password.  
**Prerequisites**: Fresh DB (or a unique email not yet registered). Web app running at `:5173`.  
**Steps**:
1. Navigate to `http://localhost:5173`.
2. Click **Sign up**.
3. Enter `tester1@example.com` and a password that meets policy (≥12 chars, mixed case, number, symbol).
4. Click **Create account**.
5. Observe the confirmation page / toast.

**Expected**:
- UI shows "Check your inbox" message.
- No redirect to the dashboard yet (email unverified).
- Mailpit shows one new email addressed to `tester1@example.com`.
- Attempting to log in before verification returns an appropriate error.

**Pass/Fail**: [ ]

---

### TC-002: Email Verification
**Story**: US-02 — As a registered user I can verify my email address by clicking the link in the verification email.  
**Prerequisites**: TC-001 completed; verification email in Mailpit.  
**Steps**:
1. Open Mailpit (`http://localhost:8025`).
2. Open the verification email for `tester1@example.com`.
3. Click the verification link (or copy-paste it into the browser).
4. Observe the redirect.

**Expected**:
- Browser redirects to the app with a success indicator.
- User is now considered verified; login with the same credentials succeeds.
- A second click on the same link shows an "already verified" or "link expired" message (not a crash).

**Pass/Fail**: [ ]

---

### TC-003: Login with Password
**Story**: US-03 — As a verified user I can log in with my email and password.  
**Prerequisites**: TC-002 completed; user `tester1@example.com` verified.  
**Steps**:
1. Navigate to `http://localhost:5173`.
2. Click **Log in**.
3. Enter `tester1@example.com` and the correct password.
4. Click **Sign in**.

**Expected**:
- User reaches the onboarding wizard (first login) or the dashboard (subsequent logins).
- JWT access token is set (check DevTools Application → Cookies / localStorage).
- Entering the wrong password shows a validation error without exposing whether the email exists.

**Pass/Fail**: [ ]

---

### TC-004: TOTP 2FA Enrollment and Login
**Story**: US-04 — As a user I can enroll in TOTP 2FA and subsequently authenticate using my TOTP code.  
**Prerequisites**: TC-003 completed; user logged in.  
**Steps**:
1. Navigate to **Settings → Security → Two-factor authentication**.
2. Click **Enable 2FA**.
3. Scan the displayed QR code with a TOTP app.
4. Enter the current 6-digit code to confirm enrollment.
5. Note the backup codes shown; confirm you have saved them.
6. Log out.
7. Log in again with email + password.
8. On the TOTP prompt, enter the current 6-digit code.

**Expected**:
- Enrollment succeeds; backup codes are displayed exactly once.
- After step 7, a TOTP challenge screen appears (not the dashboard directly).
- Entering the correct code grants access to the dashboard.
- Entering an incorrect code shows an error and does not log in.
- Attempting to initiate a bank connection without 2FA enrolled shows a `requires_totp_enrollment` error.

**Pass/Fail**: [ ]

---

### TC-005: Magic-Link Login
**Story**: US-05 — As a user I can request a magic link and log in without entering my password.  
**Prerequisites**: TC-002 completed; user `tester1@example.com` verified.  
**Steps**:
1. Navigate to the login page.
2. Click **Send magic link** (or equivalent passwordless option).
3. Enter `tester1@example.com`.
4. Click **Send**.
5. Open Mailpit and find the magic-link email.
6. Click the link.

**Expected**:
- Mailpit receives a magic-link email within a few seconds.
- Clicking the link logs the user in without requiring a password.
- A second click on the same magic link shows an "expired / already used" message.
- Link expires after the configured TTL (e.g. 15 min); using an old link returns an appropriate error.

**Pass/Fail**: [ ]

---

### TC-006: Household Creation, Invite, and Accept
**Story**: US-06 — As a user I can create a household and invite my partner; my partner can accept the invite and join the household.  
**Prerequisites**: Two verified accounts (`tester1`, `tester2`). `tester1` logged in.  
**Steps**:
1. As `tester1`: complete onboarding (or navigate to **Settings → Household**).
2. Create a household named "Test Household".
3. Click **Invite partner**.
4. Enter `tester2@example.com` and click **Send invite**.
5. Check Mailpit for the invite email sent to `tester2`.
6. Log out as `tester1`.
7. Log in as `tester2`.
8. Click the invite link from the email (or enter the invite code in the app).
9. Accept the invite.

**Expected**:
- Invite email arrives in Mailpit within a few seconds.
- After accepting, `tester2` is a member of "Test Household".
- Both users see the household name in **Settings → Household**.
- `tester1`'s household-scoped data is visible through shared categories to `tester2` (per privacy settings).
- A third user cannot use the same invite link (link is single-use).

**Pass/Fail**: [ ]

---

### TC-007: Bank Connection via GoCardless (PKO BP)
**Story**: US-07 — As a user I can connect my PKO BP bank account via GoCardless so that transactions are imported automatically.  
**Prerequisites**: TC-004 (TOTP enrolled). GoCardless sandbox configured in `.env`. User logged in with 2FA active.  
**Steps**:
1. Navigate to **Settings → Bank Connections** (or onboarding step).
2. Click **Add bank connection**.
3. Select **PKO BP**.
4. If prompted for TOTP step-up, enter a valid TOTP code.
5. Choose the history import window (e.g. 90 days).
6. Follow the GoCardless consent redirect (sandbox: select mock PKO institution, grant consent).
7. Return to the app after consent.

**Expected**:
- Redirect returns to the app with a success state.
- At least one account (e.g. "PKO BP Checking") appears in **Bank Connections**.
- A `sync-connection` job is enqueued immediately; after a few seconds "Last synced" shows a recent timestamp.
- Transactions from the sandbox are visible in the Transactions list.
- The 2FA step-up gate returns a `requires_totp` error if the user's last TOTP verification was >5 min ago.

**Pass/Fail**: [ ]

---

### TC-008: Bank Connection via Wise API
**Story**: US-08 — As a user I can connect my Wise account so that multi-currency balances and transactions are imported.  
**Prerequisites**: TC-004 (TOTP enrolled). Wise sandbox API key configured in `.env`. User logged in with 2FA.  
**Steps**:
1. Navigate to **Settings → Bank Connections**.
2. Click **Add bank connection**.
3. Select **Wise**.
4. If prompted, enter TOTP step-up code.
5. Paste in the Wise Personal API token (sandbox).
6. Choose history import window (e.g. 30 days).
7. Click **Connect**.

**Expected**:
- Connection is saved and one or more Wise accounts (PLN, EUR, etc.) appear.
- Sync runs immediately; multi-currency transactions are imported.
- Transaction amounts appear in original currency + converted to the user's base currency.
- The Wise connector and GoCardless connector co-exist without conflict under the same user.

**Pass/Fail**: [ ]

---

### TC-009: Sync Trigger and Transaction Ingest
**Story**: US-09 — As a user I can manually trigger a sync and see new transactions appear without duplicates.  
**Prerequisites**: TC-007 or TC-008 completed (at least one bank connected).  
**Steps**:
1. Navigate to **Accounts** or **Bank Connections**.
2. Click **Refresh now** / **Sync** button.
3. Wait for the sync to complete (observe spinner / last-synced timestamp).
4. Click **Refresh now** again immediately.

**Expected**:
- First sync updates "Last synced" to the current time and may add new transactions.
- Second immediate sync does **not** create duplicate transactions (idempotency).
- If the bank sandbox returns no new transactions, the transaction count stays the same.
- A sync failure (e.g. revoked consent) shows a clear error banner on the affected account, not a blank screen.

**Pass/Fail**: [ ]

---

### TC-010: Transaction Mapping (Single)
**Story**: US-10 — As a user I can map a single transaction to a planned item in my active plan.  
**Prerequisites**: TC-009 (transactions present). A plan with at least one planned expense item created (see TC-012).  
**Steps**:
1. Navigate to **Transactions**.
2. Select an unmapped transaction.
3. Click **Map to plan item** (or tap the "Unplanned" badge).
4. In the picker, select the active plan and a planned expense item (e.g. "Groceries 2 000 PLN").
5. Confirm the mapping.

**Expected**:
- Transaction's badge changes from "Unplanned" to the chosen planned item name.
- Dashboard for that plan updates: the "Groceries" actual amount increases by the transaction amount.
- The mapping appears in the transaction's detail view.
- Removing the mapping (if the UI supports it) returns the transaction to "Unplanned".

**Pass/Fail**: [ ]

---

### TC-011: Bulk Transaction Mapping + Bulk Transfer/Ignore
**Story**: US-11 — As a user I can select multiple transactions and map them all to the same planned item, or mark them all as transfers / ignored in one action.  
**Prerequisites**: TC-009 (multiple unmapped transactions present). A plan with planned items created.  
**Steps**:
1. Navigate to **Transactions**.
2. Long-press (mobile) or check the checkbox (web) on the first transaction to enter bulk-select mode.
3. Select 3–4 more unmapped transactions.
4. Tap/click **Map all** and choose a planned item.
5. Confirm. Verify badges updated on all selected transactions.
6. Repeat steps 2–3 with a different set, then choose **Mark as Transfer**.
7. Repeat with another set and choose **Ignore**.

**Expected**:
- After bulk-map: all selected transactions show the chosen planned item badge; dashboard actual amount increases accordingly.
- After bulk-transfer: selected transactions are excluded from income/expense totals; the dashboard net figure adjusts.
- After bulk-ignore: selected transactions disappear from the default unplanned list (visible under "Ignored" filter).
- Each action is reversible from the individual transaction detail view.

**Pass/Fail**: [ ]

---

### TC-012: Plan Creation and Editing (PlannedItems)
**Story**: US-12 — As a user I can create a budget plan for a period, add planned income and expense items, and edit them mid-period with a full audit trail.  
**Prerequisites**: User logged in. Household created (for household plan test).  
**Steps**:
1. Navigate to **Plans → New Plan**.
2. Choose type: **Personal**, period: **Monthly**, name it "July Personal".
3. Add a planned income item: category "Salary", amount 10 000 PLN.
4. Add a planned expense item: category "Groceries", amount 2 000 PLN.
5. Add a planned expense item: category "Rent", amount 3 500 PLN.
6. Save the plan.
7. Edit the "Groceries" item: change amount from 2 000 to 2 500 PLN.
8. Click the history/audit icon next to "Groceries".
9. Repeat steps 1–6 but choose type **Household**.
10. Also create a **Custom date range** plan: "Vacation July 10–24".

**Expected**:
- Personal plan is only visible to `tester1`.
- Household plan is visible to both `tester1` and `tester2`.
- Audit trail on "Groceries" shows both versions with timestamps and the user who made the change.
- Custom-period plan shows the exact date range on the dashboard.
- Cloning a previous plan ("Create from previous") copies categories and amounts.

**Pass/Fail**: [ ]

---

### TC-013: Dashboard View (Personal + Household)
**Story**: US-13 — As a user I see a real-time planned-vs-actual dashboard for my personal plan and for the household plan.  
**Prerequisites**: TC-012 (plans created). TC-010/TC-011 (some transactions mapped).  
**Steps**:
1. Navigate to **Dashboard**.
2. Verify the default view shows the current active personal plan.
3. Check each section: Income (planned vs. received), Expenses (planned vs. spent with progress bars), Unplanned section, Leftover bucket, Bottom line net.
4. Switch to the **Household** plan via the plan switcher.
5. Verify shared categories are visible and respect privacy settings.
6. Verify the progress bar for "Groceries" is red/amber/green based on the spend level.
7. Verify "Unplanned expenses" and "Unplanned incomes" show correct totals.
8. Verify the Leftover bucket shows `planned − actual` for items under budget.

**Expected**:
- All sections present and correctly calculated.
- A planned item at >100% shows a red progress bar and "+X over" label.
- A planned item at 80–100% shows an amber/yellow indicator.
- Unplanned section total matches sum of all unmapped transactions for the period.
- Leftover = sum of `(planned − actual)` for under-budget expense items; over-budget items contribute 0.
- Dashboard loads in under 500 ms (check Network tab).

**Pass/Fail**: [ ]

---

### TC-014: Category Privacy Settings
**Story**: US-14 — As a user I can set the privacy level of each category, controlling how much detail my partner sees.  
**Prerequisites**: TC-006 (household with two members). Both users have transactions in shared categories.  
**Steps**:
1. As `tester1`: navigate to **Settings → Categories**.
2. For "Groceries" set privacy to **Total only**.
3. For "Rent" set privacy to **Full detail**.
4. For "Health" set privacy to **Total + counts**.
5. Log in as `tester2` and navigate to the household dashboard or categories view.
6. Inspect what `tester2` sees for each category.

**Expected**:
- **Groceries (Total only)**: `tester2` sees only the aggregate spend total; no transaction list, no merchant details.
- **Rent (Full detail)**: `tester2` sees individual transaction merchant, date, and amount — but **not** which account (PKO vs Wise) the transactions came from.
- **Health (Total + counts)**: `tester2` sees total + "them: N txns" counts, no merchant details.
- `tester1`'s own transactions are always fully visible to `tester1`.

**Pass/Fail**: [ ]

---

### TC-015: Notifications — Over-budget Alert, Weekly Digest, Reconnect Reminder
**Story**: US-15 — As a user I receive email notifications for over-budget events, weekly digests, and upcoming bank reconnects.  
**Prerequisites**: TC-012 (plan with budget items). TC-007 or TC-008 (bank connected). Mailpit running.  
**Steps**:

**Sub-test A — Over-budget alert**:
1. Ensure the "Groceries" planned item is set to 100 PLN (small amount for easy trigger).
2. Map a transaction of 85 PLN to "Groceries".
3. Check Mailpit for a 80%-threshold alert email.
4. Map another transaction of 20 PLN to "Groceries" (pushes to >100%).
5. Check Mailpit for a 100%-threshold alert email.

**Sub-test B — Weekly digest**:
1. Navigate to **Settings → Notifications**.
2. Ensure "Weekly digest" is opted in.
3. Trigger a test digest (dev-only endpoint or wait for scheduled job).
4. Check Mailpit for the weekly digest email.

**Sub-test C — Reconnect reminder**:
1. Set the GoCardless consent expiry to 7 days from now (dev override or fast-forward).
2. Trigger the reconnect-reminder job.
3. Check Mailpit for the 7-day reminder email.
4. Verify the email contains a one-click reconnect link.

**Expected**:
- Sub-test A: Two distinct emails received — one at 80% and one at 100%.
- Sub-test B: Weekly digest email in the user's preferred language shows last week's planned vs. actual, top categories, and unplanned highlights.
- Sub-test C: Reminder email in the user's preferred language with a valid reconnect link.
- All emails are in the user's preferred language (change to `pl` in settings and re-trigger; email should be in Polish).

**Pass/Fail**: [ ]

---

### TC-016: Data Export and Account Deletion
**Story**: US-16 — As a user I can export all my data as JSON and permanently delete my account.  
**Prerequisites**: User logged in with at least some transactions, plans, and mappings in the DB.  
**Steps**:

**Sub-test A — Data export**:
1. Navigate to **Settings → Privacy → Export my data**.
2. If a TOTP step-up is required, enter a valid code.
3. Click **Export**.
4. Download the resulting JSON file.
5. Inspect the file contents.

**Sub-test B — Account deletion**:
1. Navigate to **Settings → Privacy → Delete my account**.
2. If a TOTP step-up is required, enter a valid code.
3. Confirm the deletion (enter email or type "DELETE" as prompted).
4. Attempt to log in with the deleted account's credentials.

**Expected**:
- Sub-test A: JSON file contains user profile, households, plans, planned items, transactions, mappings, categories. No plaintext bank tokens or password hashes in the export.
- Sub-test B: Login with the deleted account returns a "no account found" error. DB inspection shows the user row is soft-deleted (with a 30-day hold). Hard-delete runs after the hold period.
- Attempting to access the API with a JWT from the deleted account returns 401.

**Pass/Fail**: [ ]

---

### TC-017: Locale Switching (en → pl → uk → ru → en)
**Story**: Derived from PRD §4.12 — the UI language changes immediately across the whole app when the user switches locale.  
**Prerequisites**: User logged in. All four locale bundles loaded (verify in network tab).  
**Steps**:
1. Navigate to **Settings → Language**.
2. Switch language to **Polish (pl)**.
3. Verify: UI labels, buttons, category names, number format (`1 234,56 zł`), date format in Polish.
4. Switch to **Ukrainian (uk)**.
5. Verify: UI in Ukrainian, number/date format follows Ukrainian conventions.
6. Switch to **Russian (ru)**.
7. Verify: UI in Russian.
8. Switch back to **English (en)**.
9. Log out, log back in — verify language preference persists (English shown on login).
10. On mobile: change the iOS system language to Polish; open the app as a new user (not yet logged in) — verify the UI auto-detects Polish.

**Expected**:
- Each language switch takes effect immediately — no page reload required.
- Zero hardcoded English strings visible in any of the four locales.
- Plural forms are correct in uk/ru/pl (e.g. "1 element", "2 elementy", "5 elementów" in Polish).
- Language preference is persisted in the user profile and survives logout/login.
- Auto-detection on first visit maps the system locale to the closest supported language.

**Pass/Fail**: [ ]

---

### TC-018: Currency Switcher on Dashboard (PLN → EUR → USD)
**Story**: Derived from PRD §4.4 — any displayed amount can be toggled through the user's interesting currencies without leaving the screen.  
**Prerequisites**: User has base currency PLN and interesting currencies EUR, USD configured. At least one transaction exists.  
**Steps**:
1. Open the dashboard.
2. Verify all amounts are shown in PLN.
3. Tap/click the currency switcher on the "Bottom line" total — should cycle to EUR.
4. Verify all dashboard totals update to EUR (using the stored daily FX rate).
5. Cycle to USD; verify totals in USD.
6. Cycle back to PLN; verify PLN amounts.
7. Tap an individual planned item's amount — verify it also cycles independently (or follows the global switcher, whichever is the design).

**Expected**:
- Currency switcher cycles through PLN → EUR → USD → PLN without page reload.
- The FX rate used and its date are visible (e.g. tooltip "ECB rate 2024-07-01").
- Original currency is always one of the options in the switcher.
- Amounts in non-base currencies are clearly marked as converted (e.g. "≈ €234.50").

**Pass/Fail**: [ ]

---

### TC-019: Biometric Unlock for Mobile (Face ID / Touch ID)
**Story**: Derived from PRD §4.1 — mobile users can enable biometric unlock to access the app without entering their password on re-open.  
**Prerequisites**: Physical iOS device or Simulator with Face ID/Touch ID enrolled. Mobile app installed (TestFlight or Expo Go). User logged in.  
**Steps**:
1. Navigate to **Settings → Security → Biometric unlock**.
2. Toggle **Enable Face ID / Touch ID**.
3. Confirm with Face ID / Touch ID when prompted.
4. Background the app.
5. Re-open the app.
6. Authenticate with Face ID / Touch ID (or cancel).

**Expected**:
- After toggling, the next app open prompts for biometric instead of the full login screen.
- Successful biometric unlocks the app and restores the last screen.
- Cancelling the biometric prompt falls back to email+password login.
- On devices without biometrics, the toggle is hidden or disabled with a clear explanation.
- Biometric credentials are stored in the iOS Keychain (`SecureStore`), never sent to the server.

**Pass/Fail**: [ ]

---

## Test Execution Sign-off

| # | Test Case | Tester | Date | Result |
|---|-----------|--------|------|--------|
| TC-001 | User Registration | | | |
| TC-002 | Email Verification | | | |
| TC-003 | Login with Password | | | |
| TC-004 | TOTP 2FA Enrollment + Login | | | |
| TC-005 | Magic-Link Login | | | |
| TC-006 | Household Creation + Invite + Accept | | | |
| TC-007 | Bank Connection (GoCardless PKO BP) | | | |
| TC-008 | Bank Connection (Wise API) | | | |
| TC-009 | Sync Trigger + Transaction Ingest | | | |
| TC-010 | Transaction Mapping (Single) | | | |
| TC-011 | Bulk Mapping + Transfer/Ignore | | | |
| TC-012 | Plan Creation + Editing | | | |
| TC-013 | Dashboard View (Personal + Household) | | | |
| TC-014 | Category Privacy Settings | | | |
| TC-015 | Notifications | | | |
| TC-016 | Data Export + Account Deletion | | | |
| TC-017 | Locale Switching | | | |
| TC-018 | Currency Switcher | | | |
| TC-019 | Biometric Unlock (Mobile) | | | |

**Overall result**: PASS / FAIL  
**Sign-off**: ___________________  Date: ___________
