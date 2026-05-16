# Power Budget — Partner Onboarding Rehearsal

> **Purpose**: A step-by-step rehearsal script for two MVP partner users so they can independently set up the app, connect their banks, and use the core budgeting workflow before the public launch.
>
> **Partner A** — uses **iOS mobile app** (installed via TestFlight).  
> **Partner B** — uses **Web app** (`https://<app-url>` or `http://localhost:5173` in dev).
>
> Allow **45–60 minutes** for a first-time walkthrough; subsequent sessions will be much faster.
>
> Support channel during rehearsal: direct message / call with the app developer.

---

## Pre-rehearsal Checklist (Developer)

Before handing off to the partners, verify:

- [ ] TestFlight build distributed to Partner A's Apple ID.
- [ ] Staging/production environment healthy (Postgres, Redis, SMTP/Resend all green).
- [ ] GoCardless sandbox (or production) credentials configured in `.env`.
- [ ] Wise sandbox (or production) API configured in `.env`.
- [ ] Mailpit (dev) or Resend (staging/prod) configured for transactional email.
- [ ] Both partner email addresses whitelisted or invite codes generated.
- [ ] `docs/mvp/runbooks/manual-test-plan.md` bookmarked for reference if something unexpected occurs.

---

## Phase 1 — Installation

### Partner A (iOS / TestFlight)

| Step | Action |
|------|--------|
| 1 | Open the **TestFlight** app on iPhone (install from the App Store if not present). |
| 2 | Open the TestFlight invitation email and tap **View in TestFlight**. |
| 3 | Tap **Install** on the Power Budget beta entry. |
| 4 | Wait for download to complete; tap **Open**. |
| 5 | Grant any system permissions the app requests (notifications recommended). |

> **Checkpoint**: App launches and displays the **Welcome / Sign up** screen.

### Partner B (Web)

| Step | Action |
|------|--------|
| 1 | Open a browser (Chrome, Safari, or Firefox). |
| 2 | Navigate to the app URL provided by the developer. |
| 3 | The welcome / sign-up page loads. |

> **Checkpoint**: Both partners see the welcome screen. Confirm with each other before proceeding.

---

## Phase 2 — Registration and Email Verification

### Both partners (steps are identical)

| Step | Action | Notes |
|------|--------|-------|
| 1 | Tap / click **Sign up**. | |
| 2 | Enter your email address and a strong password (≥12 characters, mixed case, number, symbol). | Use a real inbox you can access. |
| 3 | Tap / click **Create account**. | |
| 4 | Check your inbox for a verification email from Power Budget. | May take up to 1–2 minutes. Check spam if not received. |
| 5 | Click the verification link in the email. | |
| 6 | The app shows "Email verified". | |
| 7 | Tap / click **Continue to login**. | |
| 8 | Log in with your email and password. | |

> **Checkpoint A**: Both partners see the onboarding wizard (first-login flow). Confirm before Phase 3.

---

## Phase 3 — Onboarding Wizard

Each partner completes the onboarding wizard independently. The wizard has 5 steps.

### Step 1 — Language

| Action | Expected |
|--------|----------|
| The app auto-detects your language from the device / browser. | Partner A (iOS, Polish system): Polish shown. Partner B (browser): matches `Accept-Language`. |
| If the detected language is wrong, tap the language name and select your preferred language. | Language list shows: English, Ukrainian, Russian, Polish. |
| Tap **Continue**. | |

### Step 2 — Base Currency

| Action | Expected |
|--------|----------|
| Select **PLN** as the base currency (the primary currency for all budget totals and dashboards). | PLN appears pre-selected for PL locale. |
| Tap **Continue**. | |

### Step 3 — Interesting Currencies

| Action | Expected |
|--------|----------|
| Select **EUR** and **USD** from the list (multi-select). | Both show a checkmark. |
| These currencies will be available in the currency switcher on the dashboard. | |
| Tap **Continue**. | |

### Step 4 — Connect First Bank *(Optional — can skip and do later)*

| Action | Expected |
|--------|----------|
| You will connect your bank in Phase 5. For now tap **Skip for now**. | Wizard advances to step 5. |

### Step 5 — Create First Plan *(Optional — can skip and do later)*

| Action | Expected |
|--------|----------|
| Tap **Skip for now** — we will create a plan in Phase 7. | Wizard completes; you land on the dashboard (empty state). |

> **Checkpoint B**: Both partners see the main dashboard in empty state. It shows prompts to "Connect a bank" and "Create a plan".

---

## Phase 4 — TOTP 2FA Setup

TOTP is **mandatory before connecting a bank**. Complete this now.

### Both partners

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Settings → Security → Two-factor authentication**. | |
| 2 | Tap **Enable 2FA**. | |
| 3 | Open a TOTP app on your phone (Google Authenticator, Authy, or 1Password). | Partner A can use a TOTP app on the same iPhone. Partner B should use a separate device (phone). |
| 4 | Tap **Scan QR code** in your TOTP app, then scan the code shown in Power Budget. | Alternatively, tap "Can't scan? Enter code manually" and type the secret. |
| 5 | In Power Budget, enter the 6-digit code displayed in your TOTP app. | Code refreshes every 30 seconds; enter it before it expires. |
| 6 | Tap **Confirm**. | |
| 7 | **Save your backup codes** — screenshot or write them down somewhere safe. | These are shown only once. |
| 8 | Tap **Done**. | |

> **Checkpoint C**: Settings → Security shows "2FA: Enabled".

---

## Phase 5 — GoCardless PKO BP Bank Connection

> **For Partner A (iOS) and Partner B (web) — follow the same flow on each platform.**

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Settings → Bank Connections** (or tap "Connect a bank" on the dashboard). | |
| 2 | Tap **Add bank connection**. | |
| 3 | Select **PKO BP** from the bank list. | |
| 4 | The app prompts for a TOTP step-up — enter your current 6-digit code. | Required because connecting a bank is a sensitive action. |
| 5 | Choose how far back to import history: select **90 days**. | |
| 6 | Tap **Connect** — the app opens the GoCardless consent screen (in-app browser or Safari). | |
| 7 | Log in to PKO BP with your internet banking credentials (or use sandbox test credentials). | Do not close the browser. |
| 8 | Grant consent for the requested account access. | |
| 9 | The browser redirects back to Power Budget. | |
| 10 | The app shows a success message and the PKO connection appears in the list. | |

> **Checkpoint D**: Power Budget shows "PKO BP — Last synced: just now" and one or more account entries (e.g. "PKO BP Main Account").

---

## Phase 6 — Sync and Viewing Transactions

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Transactions** (or **Accounts → PKO BP**). | |
| 2 | Transactions from the last 90 days should already be visible (imported during connection). | May take 10–30 seconds for initial ingest. Pull-to-refresh if nothing appears. |
| 3 | Scroll through the list. Verify: date, merchant/description, amount in original currency, converted amount in PLN (or your base currency), "Unplanned" badge. | |
| 4 | Return to **Settings → Bank Connections** and tap **Refresh now** next to PKO BP. | |
| 5 | Observe the "Last synced" timestamp update. | |
| 6 | Check that no duplicate transactions appear after the second sync. | |

> **Checkpoint E**: At least 5 transactions visible. No duplicates after manual re-sync.

---

## Phase 7 — Create First Budget Plan

### Partner A — Personal Monthly Plan

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Plans → New Plan**. | |
| 2 | Plan type: **Personal**. Period: **Monthly**. Name: "My July Budget". | |
| 3 | Tap **Add income item**. Category: **Salary**. Amount: `10 000`. Currency: `PLN`. | |
| 4 | Tap **Add expense item**. Category: **Rent**. Amount: `3 500`. Currency: `PLN`. | |
| 5 | Add: **Groceries** `2 000 PLN`. | |
| 6 | Add: **Transport** `500 PLN`. | |
| 7 | Add: **Subscriptions** `200 PLN`. | |
| 8 | Tap **Save plan**. | |

### Partner B — Household Monthly Plan

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Plans → New Plan**. | |
| 2 | Plan type: **Household**. Period: **Monthly**. Name: "Household July". | |
| 3 | Add income: **Salary** `10 000 PLN`. | |
| 4 | Add expense: **Rent** `3 500 PLN`. | |
| 5 | Add expense: **Groceries** `3 000 PLN`. | |
| 6 | Add expense: **Utilities** `800 PLN`. | |
| 7 | Tap **Save plan**. | |

> **Checkpoint F**: Partner A sees their personal plan on the dashboard. Partner B sees the household plan.

---

## Phase 8 — Map a Transaction

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to **Transactions**. | |
| 2 | Find a grocery-related transaction (e.g. "Biedronka", "Lidl"). | |
| 3 | Tap the transaction to open the detail view. | |
| 4 | Tap **Map to plan item** (or the "Unplanned" badge). | |
| 5 | The picker shows your active plans and their planned items. Select the appropriate plan and "Groceries". | |
| 6 | Tap **Confirm**. | |
| 7 | Verify the transaction's badge now shows "Groceries". | |
| 8 | Go to a different transaction. Tap "Map to plan item". Notice the **suggested mapping** (same merchant as a previously mapped transaction, if applicable). | |

> **Checkpoint G**: At least one transaction mapped; dashboard shows updated actual spend for Groceries.

---

## Phase 9 — Dashboard Verification (Planned vs. Actual)

| Step | Action | Notes |
|------|--------|-------|
| 1 | Navigate to the **Dashboard**. | |
| 2 | Verify the header: plan name, type (Personal / Household), period dates, "X days remaining". | |
| 3 | Check the **Income** section: Salary shows planned 10 000 PLN vs. received amount (should be 0 if no income mapped yet). | |
| 4 | Check the **Expenses** section: Groceries shows planned amount vs. the actual amount from the mapped transaction. Progress bar should be green (low %), amber (close to 100%), or red (over). | |
| 5 | Check the **Unplanned** section: all other transactions that have not been mapped appear here as a total. Tap to see the list. | |
| 6 | Check the **Leftover bucket**: shows projected savings for under-budget expense items. | |
| 7 | Tap the currency switcher on the bottom-line total — cycle through PLN → EUR → USD → PLN. | |

> **Checkpoint H**: Dashboard shows correct planned vs. actual data. Currency switcher works without reload.

---

## Phase 10 — Household Invite and Accept

> Partner B will invite Partner A to join the household.

### Partner B (sends the invite)

| Step | Action |
|------|--------|
| 1 | Navigate to **Settings → Household**. |
| 2 | Tap **Invite member**. |
| 3 | Enter Partner A's email address. |
| 4 | Tap **Send invite**. |

### Partner A (accepts the invite)

| Step | Action |
|------|--------|
| 1 | Check your email inbox for an invite from Power Budget. |
| 2 | Tap **Accept invite** in the email (or copy the invite code into **Settings → Household → Join household**). |
| 3 | Confirm joining the household. |

### Verify household membership

| Step | Action | Expected |
|------|--------|----------|
| 1 | Both partners navigate to **Settings → Household**. | Both see the same household name and both member names listed. |
| 2 | Partner A navigates to the **Dashboard** and switches to the household plan created by Partner B. | Partner A sees the household plan. |
| 3 | Partner B navigates to **Dashboard → Household** and sees Partner A listed as a member. | |

> **Checkpoint I**: Both partners are in the same household. Household plan is visible to both.

---

## Phase 11 — Settings Walkthrough

Each partner should walk through all Settings sections to familiarise themselves with the app.

| Section | What to check |
|---------|--------------|
| **Profile** | Display name, avatar. Confirm email is verified. |
| **Language** | Switch through en → pl → uk → ru → en. Verify immediate UI change each time. |
| **Currency** | Base currency PLN. Interesting currencies EUR + USD. Add/remove one to test. |
| **Security** | 2FA status shows "Enabled". Backup codes reminder link present. |
| **Bank Connections** | PKO BP listed with last-synced time. "Refresh now" and "Disconnect" buttons present. |
| **Notifications** | Over-budget alert: on. Weekly digest: opt in. Reconnect reminder: on. |
| **Categories** | Default categories present with icons. Try adding a custom category. |
| **Privacy** | Data export and account deletion options visible. |
| **Household** | Members listed. Invite link copyable. |
| **About** | App version, changelog link. |

---

## Rehearsal Sign-off

| Partner | Device | Date | Completed phases | Notes / issues found |
|---------|--------|------|-----------------|----------------------|
| Partner A | iOS (TestFlight) | | 1–11 | |
| Partner B | Web | | 1–11 | |

**Rehearsal outcome**: PASS / NEEDS FOLLOW-UP  
**Developer sign-off**: ___________________  Date: ___________

---

## Frequently Asked Questions (for partners)

**Q: I didn't get the verification / magic-link email.**  
A: Check your spam folder. If using a development environment, open Mailpit at `http://localhost:8025`.

**Q: The TOTP code is "invalid".**  
A: Make sure your phone's time is correct (TOTP is time-based). Try entering the code immediately after it refreshes.

**Q: My bank connection says "consent required".**  
A: PKO BP PSD2 consent expires every 90 days. Tap **Reconnect** and go through the GoCardless consent flow again.

**Q: I see duplicate transactions.**  
A: Tap **Refresh now** only once; duplicate syncs are deduped at the server level. If genuine duplicates appear, report them with the transaction external IDs (visible in the detail view).

**Q: The app is in the wrong language.**  
A: Go to **Settings → Language** and choose your preferred language. The change is instant.
