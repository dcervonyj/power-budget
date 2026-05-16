# App Store Metadata

This directory contains App Store Connect metadata for Power Budget.

## Structure

- `{locale}/description.txt` — Full app description (max 4000 chars)
- `{locale}/keywords.txt` — Keywords comma-separated (max 100 chars)
- `{locale}/subtitle.txt` — Short subtitle (max 30 chars, iOS only)

## Locales

- `en-US` — English (primary)
- `uk-UA` — Ukrainian
- `ru-RU` — Russian
- `pl-PL` — Polish

## Submit to App Store

```bash
eas submit --platform ios --profile production
```

Or for a specific build:

```bash
eas submit --platform ios --profile production --id <build-id>
```
