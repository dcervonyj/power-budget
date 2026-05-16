# Deep Linking — iOS Universal Links & Custom Scheme

## Overview

Power Budget supports two deep link flavours:

| Type | Prefix | Use case |
|---|---|---|
| **iOS Universal Links** | `https://app.power-budget.com` | Magic-link sign-in, OAuth callback |
| **Custom URL scheme** | `powerbudget://` | Dev / fallback |

---

## Handled routes

| Path | Screen | Query params |
|---|---|---|
| `/auth/magic-link` | `MagicLinkScreen` | `token` |
| `/auth/oauth/google/callback` | `OAuthCallbackScreen` | `code`, `state` |

### Examples

```
# Universal Link — magic-link sign in
https://app.power-budget.com/auth/magic-link?token=abc123

# Universal Link — Google OAuth callback
https://app.power-budget.com/auth/oauth/google/callback?code=xyz&state=csrf

# Custom scheme (dev/fallback)
powerbudget://auth/magic-link?token=abc123
powerbudget://auth/oauth/google/callback?code=xyz&state=csrf
```

---

## iOS Universal Links setup

### 1. Expo configuration (`app.json`)

```json
{
  "expo": {
    "scheme": "powerbudget",
    "ios": {
      "associatedDomains": ["applinks:app.power-budget.com"]
    }
  }
}
```

### 2. Apple App Site Association (AASA)

The file `packages/mobile/assets/apple-app-site-association` must be served at:

```
https://app.power-budget.com/.well-known/apple-app-site-association
```

With `Content-Type: application/json` and **no file extension** in the URL.

Replace `TEAMID` in the `appID` field with your Apple Team ID (10-character uppercase string found in the Apple Developer portal under Membership).

> **Tip:** Expo's EAS Build can handle the `associatedDomains` entitlement automatically. Ensure the bundle identifier in `app.json` matches the one in App Store Connect.

### 3. Verifying Universal Links on device

On a physical iPhone (iOS 11+):

```bash
# Test with xcrun
xcrun simctl openurl booted "https://app.power-budget.com/auth/magic-link?token=TEST"
```

Or tap the URL in Messages / Notes — iOS will open the app directly if Universal Links are configured correctly.

---

## React Navigation linking config

The config lives in `packages/mobile/src/presentation/App.tsx`:

```typescript
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['https://app.power-budget.com', 'powerbudget://'],
  config: {
    screens: {
      Auth: {
        screens: {
          MagicLink: 'auth/magic-link',
          OAuthCallback: 'auth/oauth/google/callback',
        },
      },
    },
  },
};
```

React Navigation automatically extracts query params and passes them as `route.params` to the target screen.

---

## Adding new deep link routes

1. Add the path to `linking.config.screens` in `App.tsx`
2. Ensure the screen's param list in `types.ts` matches the query params
3. Add the path to `assets/apple-app-site-association` → `paths[]`
4. Update this document
