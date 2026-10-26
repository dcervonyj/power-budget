# EAS Submit — Manual Instructions

## Prerequisites

1. Expo account with EAS enabled
2. Apple Developer account
3. App Store Connect app ID created

## Environment variables needed

Set these as GitHub Actions secrets:

- `EXPO_TOKEN` — Expo access token
- `APPLE_APP_SPECIFIC_PASSWORD` — App-specific password for Apple ID

## Manual submit command

```bash
cd packages/mobile
eas submit --platform ios --profile production --id <build-id>
```

## TestFlight flow

1. Build is created by EAS (see eas.json production profile)
2. Build is automatically submitted to TestFlight when tag v\* is pushed
3. Apple review takes 1-2 business days for TestFlight
4. Distribute to internal testers via TestFlight app in App Store Connect

## TODO: EAS project and Apple IDs (owner action)

`eas.json` `submit.production.ios` still holds `APPLE_ID_PLACEHOLDER`,
`APP_STORE_CONNECT_APP_ID_PLACEHOLDER` and `APPLE_TEAM_ID_PLACEHOLDER`, and `app.json` has no
`extra.eas.projectId` yet. The owner must create the EAS project (`eas init`) and fill in the real
IDs; they are deliberately not invented here.

## API URL

Builds read `EXPO_PUBLIC_API_URL` (set per profile in `eas.json`; `.env` locally). Unset, dev
builds use `http://localhost:3000` and all others `https://power-budget-api-eu.onrender.com`.
