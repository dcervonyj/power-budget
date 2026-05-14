# TestFlight QA Checklist — Power Budget

> Run before each TestFlight build. Both household members should complete the checklist.

## Pre-requisites
- Fresh install (delete app first if updating major version)
- Test account with at least one bank connection

## Core flows

### Auth
- [ ] Register new account
- [ ] Login with email + password
- [ ] Login with magic link (tap link from email on iOS)
- [ ] Google OAuth login
- [ ] Enable TOTP 2FA (scan QR with Authenticator app)
- [ ] Logout + login with TOTP code

### Bank Connection
- [ ] Connect a new bank account (GoCardless or Wise)
- [ ] Trigger manual sync
- [ ] Verify transactions appear after sync

### Transactions
- [ ] View transaction list
- [ ] Open transaction detail
- [ ] Map a transaction to a planned item
- [ ] Mark a transaction as a transfer

### Plans
- [ ] Create a new monthly plan
- [ ] Add a planned income item
- [ ] Add a planned expense item
- [ ] View plan dashboard (actuals vs. planned)

### Settings
- [ ] Change base currency
- [ ] Change language
- [ ] Disconnect a bank account

### Household
- [ ] Invite a second user
- [ ] Accept invite on second device
- [ ] Verify shared data is visible to both users

## Sign-off
- Tester 1: ___________  Date: ___________
- Tester 2: ___________  Date: ___________
