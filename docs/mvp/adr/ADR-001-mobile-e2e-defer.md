# ADR-001: Defer Detox Mobile E2E Testing to v2

**Status**: Accepted  
**Date**: 2025-01-30  
**Deciders**: Power Budget team

---

## Context

The Power Budget MVP targets iOS (React Native / Expo) as its mobile platform for a two-user household. Automated end-to-end mobile testing requires a dedicated tool. The two main options are:

1. **Detox** — Expo-compatible grey-box E2E framework by Wix, runs on iOS Simulator + Android Emulator via Xcode/device farms.
2. **Manual TestFlight QA** — human-executed test plan on real devices via TestFlight distribution.

Detox was evaluated for the MVP timeline. Key findings:

- Detox requires a **native (bare) Expo workflow** or the Expo Dev Client — the current managed workflow would need ejection or custom Expo plugin configuration before Detox can attach.
- Setting up a reliable iOS Simulator CI lane on GitHub Actions requires a **macOS runner** (10× the cost of ubuntu runners) and proper Xcode version pinning.
- The initial Detox configuration for two authenticated users, deep-linking, and biometric unlock typically takes ≥ **1 calendar week** for a single engineer unfamiliar with Detox internals.
- The MVP timeline allows only **10–13 calendar weeks** total. Spending 1 week on E2E infrastructure before a single screen is built is disproportionate.
- The two-person household context means the bug risk surface is well-covered by: **unit tests** (Vitest, `@power-budget/core` + `backend/application`), **component tests** (React Native Testing Library), and **manual TestFlight QA** on real iOS hardware.

## Decision

**Defer Detox (and all automated mobile E2E) to v2.**

For the MVP, mobile quality assurance relies on:

1. **Vitest unit tests** for all pure logic in `@power-budget/core` and `packages/backend/application/`.
2. **React Native Testing Library** component tests for critical interactive components (auth forms, plan editor, mapping flow).
3. **Manual TestFlight QA** — a checklist-driven process covering the six core flows (auth, bank connect, transaction list, mapping, plan dashboard, settings) run by both household members before each TestFlight build.
4. **Web Playwright E2E** (QA-003) covers the shared application logic end-to-end — since web and mobile share 90%+ of logic via `@power-budget/shared-app`, a web E2E pass gives high confidence for mobile too.

## Consequences

**Positive**:
- Saves ≥ 1 week of setup effort for MVP timeline.
- Avoids macOS CI runner cost during development.
- Web Playwright E2E (QA-003) provides indirect coverage for shared-app logic.

**Negative**:
- No automated regression safety net for mobile-specific navigation flows (deep linking, biometric unlock) at MVP.
- Risk: a React Navigation upgrade or Expo SDK bump could silently break navigation without catching it in CI.

**Mitigation**:
- All navigation integration points are isolated in `packages/mobile/src/presentation/navigation/` — easy to audit manually.
- TestFlight QA checklist will be committed as `docs/mvp/testflight-qa-checklist.md` before first beta.
- v2 milestone will include Detox setup as a dedicated sprint task once the app stabilises post-MVP.

## Alternatives Considered

| Option | Why rejected |
|--------|-------------|
| Detox on macOS CI | ≥ 1 week setup + high runner cost at MVP scale |
| Appium | Even more complex setup; less Expo integration |
| Maestro | Newer, less mature; still requires native build in CI |
| Skip all mobile QA | Unacceptable — manual TestFlight QA is a reasonable floor |
