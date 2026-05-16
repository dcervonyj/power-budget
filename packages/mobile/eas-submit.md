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
