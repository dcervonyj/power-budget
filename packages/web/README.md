# Web and mobile message catalogs

Legacy messages remain in `locales/<locale>.json`. Feature messages belong in
`locales/<locale>/<feature>.json` for all four locales: `en`, `pl`, `uk`, and `ru`.

Message IDs use one prefix per feature: `shell.`, `overview.`, `tx.`, `plan.`,
`auth.`, `onboarding.`, `categories.`, `household.`, `banks.`, `settings.`, or
`glass-<area>.`. Every ticket creates and solely edits its own feature files.

Web discovers feature catalogs through Vite glob imports. Mobile uses a generated
static index for Metro; run `pnpm -F @power-budget/mobile i18n:extract` after adding
or removing a mobile feature catalog to regenerate it. Both `i18n:extract` commands
write extracted IDs to `/tmp` and never rewrite legacy catalogs or move feature IDs there.
