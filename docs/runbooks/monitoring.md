# Monitoring Runbook

Error reporting and uptime checks for Power Budget (HOST-004, PO decision D11 of 29 Oct).
Both run on free plans and were set up on 30 Oct 2026.

---

## 1. What is watched

| Tool                     | Target                                            | Plan                  | Alert                          |
| ------------------------ | ------------------------------------------------- | --------------------- | ------------------------------ |
| Better Stack Uptime      | `https://power-budget-api-eu.onrender.com/health` | Free, 3-minute checks | Email to the primary responder |
| Better Stack Uptime      | `https://power-budget.pages.dev`                  | Free, 3-minute checks | Email to the primary responder |
| Sentry project `backend` | API and worker errors (NestJS)                    | Developer (free), EU  | Email for high-priority issues |
| Sentry project `web`     | Web app errors (React)                            | Developer (free), EU  | Email for high-priority issues |
| Sentry project `mobile`  | Mobile app errors (React Native)                  | Developer (free), EU  | Email for high-priority issues |

Sentry org: `power-budget`, data region EU (Germany, `ingest.de.sentry.io`). Org settings: data scrubber
and default scrubbers on, IP addresses scrubbed. Each project has Sentry's default alert rule
"Send a notification for high priority issues" (email to issue owners, falling back to members).
Free quota: 5k errors a month for the org.

---

## 2. Where the DSN is configured

The DSN is a public key; no code change is needed to turn reporting on or off.

| App     | Variable                 | Where                                                                                   |
| ------- | ------------------------ | --------------------------------------------------------------------------------------- |
| Backend | `SENTRY_DSN`             | Render service `power-budget-api-eu` → Environment (runtime)                            |
| Web     | `VITE_SENTRY_DSN`        | Cloudflare Pages project `power-budget` → Settings → Variables, production (build time) |
| Mobile  | `EXPO_PUBLIC_SENTRY_DSN` | `packages/mobile/eas.json`, `preview` and `production` build profiles                   |

Notes:

- Web: the DSN is baked into the bundle at build time, so a change needs a new Pages deploy. The CSP
  `connect-src` is derived from the DSN (`packages/web/src/infrastructure/security/securityHeaders.ts`).
- Web source maps are optional: set `SENTRY_AUTH_TOKEN` (an org auth token with `project:releases`)
  as a Pages secret; `SENTRY_ORG` defaults to `power-budget` and `SENTRY_PROJECT` to `web`.
  Without the token, stack traces stay minified but errors are still captured.
- Mobile: `SENTRY_DISABLE_AUTO_UPLOAD=true` is set in the same profiles, so EAS builds do not need a
  Sentry auth token. Remove it and add `SENTRY_AUTH_TOKEN` as an EAS secret to upload source maps.
- To turn reporting off, remove the variable (and redeploy the web).

---

## 3. When an alert fires

### Uptime: API `/health` down

1. Open the Render dashboard → `power-budget-api-eu` → Events and Logs. Look for a failed deploy,
   an out-of-memory restart or a boot error (the API refuses to boot without a valid `JWT_SECRET`).
2. `/health` is a liveness check only: it answers 200 while the process runs, even when the database
   or Redis is down. If it fails, the process is down or not reachable (crash loop, failed boot,
   Render outage).
3. If the last deploy broke it, roll back in Render (Deploys → previous deploy → Rollback).

### Uptime: web down

1. Open Cloudflare → Pages → `power-budget` → Deployments; a failed build keeps the previous
   deployment live, so a real outage is usually Cloudflare-wide (check the Cloudflare status page).
2. Roll back to the previous deployment from the same page if the latest one is broken.

### Sentry: new high-priority issue

1. Open the issue; check the release, environment and the first-seen time against recent deploys.
2. Fix forward with a ticket, or roll back the deploy if users are blocked.
3. Resolve the issue in Sentry once the fix is deployed.

---

## 4. Not covered yet

- Bank sync alerts (consent expiry, sync failures, webhook errors) are part of SYNC-009 and will be
  documented in `docs/mvp/runbooks/bank-sync.md` once live bank sync (SYNC-005) exists.
- A database (Neon) or Redis outage does not fail `/health`; it shows up as Sentry errors from the
  API and worker. A readiness check that probes both is not built yet.
- The webhook route has no uptime check until the custom domain (HOST-003) and live sync exist.
