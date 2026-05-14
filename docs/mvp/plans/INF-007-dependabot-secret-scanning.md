# INF-007 — Dependabot + secret scanning — Implementation Plan

## 1. Task summary

- **Task ID**: INF-007
- **Title**: Dependabot + secret scanning
- **Area**: Infra
- **Effort**: XS (~0.5d)

**Context.** This task lays the supply-chain hygiene baseline for the Power Budget MVP: automatic dependency-update PRs for every workspace package and the GitHub Actions ecosystem, plus a two-layer secrets-leak defence (GitHub native push-protection + Gitleaks in pre-commit and CI). It is the security-baseline twin of INF-001 (repo + branch protection) and lands in wave 2 alongside INF-002 so the very first feature PRs already benefit from both vulnerability alerts and leak interception. The plan is anchored in ARCHITECTURE.md §6 ("Security & secrets"), which mandates encryption-at-rest for bank tokens, KMS-managed keys, no raw bank credentials in code, and strict CSP/CSRF on the web tier; INF-007 is the upstream guardrail that prevents the secrets referenced in §6 (KEK_MASTER, GOCARDLESS_SECRET_KEY, WISE_API_TOKEN, RESEND_API_KEY) from ever being committed in the first place, and that drives the eventual SEC-009 pen-test checklist toward a clean baseline.

## 2. Scope

**In scope**

- A `.github/dependabot.yml` covering:
  - `npm` ecosystem at the repo root and at each of the four workspace packages (`packages/core`, `packages/backend`, `packages/web`, `packages/mobile`) per ARCHITECTURE.md §4 monorepo layout. Although the project uses pnpm as the package manager, Dependabot's `package-ecosystem: "npm"` is the correct selector for pnpm workspaces (Dependabot detects `pnpm-lock.yaml` since GA in 2024).
  - `github-actions` ecosystem at `/` for workflow dependency pinning.
  - `docker` ecosystem at `/` (one image — INF-009 will deploy a single Dockerfile per ARCHITECTURE.md §10 Option A).
- A `.github/workflows/secret-scan.yml` workflow running Gitleaks on every `push`, `pull_request`, and on a weekly schedule.
- A `.gitleaks.toml` config with the standard ruleset + targeted allowlists for documentation examples in `docs/mvp/` (e.g. token-shaped strings inside PSD2/Wise descriptions in ARCHITECTURE.md §5.2 / §5.6).
- Wiring Gitleaks into the existing Husky pre-commit hook from INF-003 as a `gitleaks protect --staged` step (defence-in-depth: catch leaks before push).
- A `CODEOWNERS` file (extending the INF-001 placeholder) that routes the new security-sensitive paths (`.github/`, `.gitleaks.toml`, `SECURITY.md`, `CODEOWNERS` itself) to the repo owner.
- A `SECURITY.md` public disclosure policy at repo root (auto-rendered by GitHub on the repo's "Security" tab).
- Enable GitHub native **secret scanning** + **push protection** at the repo level via `gh api` (documented for both `gh` CLI and the UI fallback).
- Enable **Dependabot security updates** + **Dependabot alerts** at the repo level via the same API call.

**Out of scope**

- A full SAST suite (CodeQL, Semgrep) — deferred to SEC-009 if pen-test reveals coverage gaps.
- Snyk / Mend / GitHub Advanced Security premium integrations — cost concern, free-tier scanning is sufficient for MVP.
- License compliance scanning (FOSSA, license-checker) — deferred; legal exposure is low at private MVP phase.
- SBOM generation (`cyclonedx`, GitHub-native dependency graph export) — deferred; revisit when v3 SaaS launches.
- Required-status-check wiring for the secret-scan workflow — INF-005 owns the branch-protection required-checks list; INF-007 only authors the workflow.
- Auto-merge rules for Dependabot PRs (recommend opt-out in MVP — see §8).
- Per-package CODEOWNERS expansion — INF-002 / INF-003 / package-scaffold tasks will add per-package owners later.

## 3. Files to create / modify

| Path                                                   | Action | Purpose                                                                                                 |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------- |
| `.github/dependabot.yml`                               | create | Dependabot config — five `npm` entries (root + 4 packages), `github-actions`, `docker`.                 |
| `.github/workflows/secret-scan.yml`                    | create | Gitleaks scan job on push, PR, weekly schedule. Fails the build on any non-allowlisted finding.         |
| `.gitleaks.toml`                                       | create | Gitleaks config — `useDefault = true` + targeted allowlist for `docs/mvp/**` example tokens.            |
| `.husky/pre-commit`                                    | modify | Append `gitleaks protect --staged --redact -v --config .gitleaks.toml` to the hook authored in INF-003. |
| `CODEOWNERS`                                           | modify | Extend INF-001 placeholder with explicit ownership for `.github/`, `.gitleaks.toml`, `SECURITY.md`.     |
| `SECURITY.md`                                          | create | Public disclosure policy: contact email, response SLA, supported versions table (just `main` in MVP).   |
| `docs/mvp/plans/INF-007-dependabot-secret-scanning.md` | create | This plan file.                                                                                         |

No source files are touched. All paths are repo-root relative.

## 4. Key interfaces & contracts

### 4.1 Dependabot config

- **Schedule.** `weekly` for every ecosystem (Mondays 06:00 Europe/Warsaw) — matches BACKLOG.md INF-007 description ("npm weekly, GitHub Actions monthly"; deviating to weekly across the board because the monorepo is small and a single weekly cadence reduces context-switching).
- **Open PR cap.** `open-pull-requests-limit: 5` per ecosystem (default 5, set explicitly to make rotation predictable).
- **Grouping rule.** One **combined PR per ecosystem** grouping `minor` + `patch` updates into a single weekly PR per package. `major` updates remain individual PRs (they need scrutiny). Recommended in §8 over per-package fan-out — see Open Question 1.
- **Commit message prefix.** `chore(deps):` for production deps, `chore(dev-deps):` for dev deps. Includes scope (package name) for the four workspace packages.
- **Assignees / reviewers.** `<owner>` (single maintainer in MVP). Re-evaluated when a second human reviewer joins.
- **Labels.** `dependencies` (auto), plus `security` on alerts and `area:infra` for routing.
- **Version-ignore policy.** None in MVP — every transitive bump is welcome. (Revisit if a noisy package like `eslint-plugin-react` floods PRs.)
- **`registries` block.** Empty; no private npm registry in MVP.

### 4.2 Secret-scan workflow contract

- **Triggers.** `push` (all branches), `pull_request` (against `main`), `schedule: cron '0 6 * * 1'` (Monday 06:00 UTC for drift detection on long-lived branches).
- **Permissions.** `contents: read`, `pull-requests: write` (to comment finding summary on the PR), `security-events: write` (optional, for SARIF upload later).
- **Action.** `gitleaks/gitleaks-action@v2` pinned by full commit SHA (one of the few exceptions to "never pin to SHA" — Actions ecosystem hygiene per OWASP CI/CD top 10).
- **Failure semantics.** Any non-allowlisted leak → workflow fails with non-zero exit. INF-005 will later add this job to the branch-protection required-checks list.
- **Output.** Annotated PR comment + workflow summary table. No SARIF upload in MVP (would require GitHub Advanced Security on private repos — paid).

### 4.3 Gitleaks config (`.gitleaks.toml`)

```toml
title = "Power Budget Gitleaks config"

[extend]
useDefault = true

[allowlist]
description = "Documentation example tokens — never real credentials"
paths = [
  '''docs/mvp/.*\.md''',
]
regexes = [
  '''AKIA[0-9A-Z]{16}EXAMPLE''',
  '''sk_test_[A-Za-z0-9]{24}''',
  '''GOCARDLESS_SECRET_(ID|KEY)=<.*>''',
]
```

- Allowlist covers PRD/architecture example tokens (e.g. ARCHITECTURE.md §6 references `KEK_MASTER`, `GOCARDLESS_SECRET_KEY`).
- Allowlist is **path-scoped to docs**; source code paths get the default ruleset.
- Standard ruleset catches AWS, Stripe, Twilio, generic high-entropy strings, JWTs, private keys.

### 4.4 GitHub native scanning

Enabled at repo level. Set with one `gh api` call to `repos/<owner>/power-budget`:

```bash
gh api -X PATCH repos/<owner>/power-budget \
  -F security_and_analysis[secret_scanning][status]=enabled \
  -F security_and_analysis[secret_scanning_push_protection][status]=enabled \
  -F security_and_analysis[dependabot_security_updates][status]=enabled
```

Dependabot alerts are enabled separately:

```bash
gh api -X PUT repos/<owner>/power-budget/vulnerability-alerts
gh api -X PUT repos/<owner>/power-budget/automated-security-fixes
```

UI fallback path documented inline in §5 step 6 (Settings → Code security and analysis → Enable all four toggles).

### 4.5 CODEOWNERS extension

```text
# (existing line from INF-001)
*                       @<owner>

# Security-sensitive paths — route alerts and PRs explicitly
/.github/               @<owner>
/.gitleaks.toml         @<owner>
/CODEOWNERS             @<owner>
/SECURITY.md            @<owner>
```

### 4.6 `SECURITY.md` contract

- Reporting address: `security@<domain>` (placeholder — see Open Question 4 for domain decision).
- Response SLA: acknowledgment within 72 h, fix or mitigation within 30 days for high severity.
- Supported versions: only `main` in MVP (single deployment).
- Disclosure policy: coordinated, 90-day default embargo aligned with industry norm.

## 5. Step-by-step build order

Each step ≤30 min. Run inside the existing repo from INF-001 (no new repo creation).

1. **Verify prerequisites.** Confirm INF-001 is merged (`CODEOWNERS` exists at repo root) and `gh auth status` is green with `admin:repo_hook` + `repo` scopes.
2. **Author `.github/dependabot.yml`.** Five `npm` blocks (root + each of `packages/core`, `packages/backend`, `packages/web`, `packages/mobile`), one `github-actions` block, one `docker` block. Use the grouping + commit-message contract from §4.1.
3. **Author `.gitleaks.toml`** at repo root with the content shown in §4.3.
4. **Install Gitleaks locally** (`brew install gitleaks`) and dry-run against the current tree: `gitleaks detect --config .gitleaks.toml --redact -v`. Expect zero findings on the docs corpus.
5. **Author `.github/workflows/secret-scan.yml`** with the triggers, permissions, and pinned-SHA action from §4.2.
6. **Enable GitHub native scanning + Dependabot updates** via the three `gh api` calls in §4.4. Capture each response body in the PR description as the audit trail.
7. **Extend the Husky pre-commit hook** authored in INF-003: append the gitleaks protect line. If INF-003 has not yet landed, document the hook line in this plan and ship it as a follow-up commit in INF-003 (acceptable because pre-commit is defence-in-depth — the CI workflow and push protection are the load-bearing layers).
8. **Author `CODEOWNERS` additions** (append the four security-path lines from §4.5 to the file created by INF-001).
9. **Author `SECURITY.md`** with the contract from §4.6.
10. **Commit and open PR** with title `INF-007 dependabot + secret scanning`.
11. **Verify Dependabot ran.** Visit Insights → Dependency graph → Dependabot tab; trigger a manual run via the "Check for updates" button on each ecosystem entry. Expect either "no updates needed" (fresh repo) or one or more PRs.
12. **Negative test the leak interception.** From a throwaway local branch, commit a fake-but-format-valid AWS access key (`AKIA` + 16 chars, NOT matching the allowlist). Push and verify:
    - Push protection blocks the push at the git layer with a remediation URL.
    - When pushed via the `--no-verify-bypass` flow (acceptable for testing), the `secret-scan` workflow fails on the PR.
    - The pre-commit hook would have caught it locally (`git commit` shows the gitleaks failure).
13. **Negative test the allowlist.** Commit an `AKIA...EXAMPLE` string in `docs/mvp/scratch.md`, verify neither layer fires. Revert.
14. **Land the PR**; verify Dependabot fires on schedule within 24 h.

## 6. Test plan

| #   | Test                                                                           | Method                                                                                                                               | Expected                                                                              |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1   | Dependabot config is valid                                                     | GitHub UI: Insights → Dependency graph → Dependabot tab shows all entries green, no parse errors.                                    | All seven ecosystem entries listed; no errors badge.                                  |
| 2   | Dependabot opens PRs within 24 h of merge                                      | Manually trigger "Check for updates" per ecosystem after merge; wait up to 24 h for scheduled run.                                   | At least one PR or "no updates needed" status per ecosystem.                          |
| 3   | Push protection blocks a fake-but-realistic AWS key on a throwaway branch      | Commit `AKIA[16 random alphanum]` (NOT ending in `EXAMPLE`) to a feature branch; `git push`.                                         | Push rejected with `Secret scanning found a secret in your push` and remediation URL. |
| 4   | Secret-scan workflow fails on the same fake key if push protection is bypassed | Push via the official "Allow secret" bypass form to force the secret onto the branch; observe PR status.                             | `secret-scan / gitleaks` check fails red on the PR.                                   |
| 5   | Pre-commit hook fires locally on the same fake key                             | Stage the same content locally; `git commit`.                                                                                        | Hook exits non-zero with gitleaks finding output; commit not created.                 |
| 6   | Allowlisted example tokens in `docs/` do NOT trigger                           | Commit `AKIA0123456789ABCDEXAMPLE` to `docs/mvp/scratch.md`; push; observe.                                                          | Push succeeds, workflow green, pre-commit silent.                                     |
| 7   | Dependabot security-updates auto-apply on a known CVE                          | Pin one root devDep (e.g. `lodash@4.17.20`, which has CVE-2021-23337) in a follow-up branch; merge; wait for Dependabot security PR. | Dependabot opens a security-labelled PR within 24 h.                                  |
| 8   | CODEOWNERS additions trigger owner review request on `.github/` changes        | Open a draft PR modifying `.github/workflows/secret-scan.yml`.                                                                       | `@<owner>` automatically requested as reviewer.                                       |
| 9   | `SECURITY.md` renders on the GitHub Security tab                               | Visit `https://github.com/<owner>/power-budget/security/policy`.                                                                     | The policy text is visible.                                                           |

Tests 3, 4, 5, 6 must be run on a throwaway branch and the branch deleted afterwards. The fake key must NOT match any real AWS account — generate with `openssl rand -hex 8 | tr a-f A-F | head -c 16` prefixed with `AKIA`.

## 7. Acceptance criteria

(Refined from BACKLOG.md INF-007 and ARCHITECTURE.md §6.)

- [ ] `.github/dependabot.yml` is committed and lists seven ecosystem entries: `npm` × 5 (root + each of `packages/core`, `packages/backend`, `packages/web`, `packages/mobile`), `github-actions`, `docker`.
- [ ] Dependabot opens at least one PR (or returns "no updates needed") for every ecosystem within 24 h of merge.
- [ ] GitHub native **secret scanning**, **push protection**, **Dependabot alerts**, and **Dependabot security updates** are all `enabled` on the repo (verifiable via `gh api repos/<owner>/power-budget` → `security_and_analysis`).
- [ ] `.github/workflows/secret-scan.yml` runs on every push and PR; the job is green on the PR that introduces it.
- [ ] A deliberate fake secret on a throwaway branch is blocked by **both** push protection AND the secret-scan workflow (test #3 + #4 in §6).
- [ ] The Husky pre-commit hook blocks the same fake secret locally (test #5).
- [ ] Allowlisted example tokens inside `docs/mvp/**` do NOT trigger any layer (test #6).
- [ ] `CODEOWNERS` is updated with explicit ownership of `.github/`, `.gitleaks.toml`, `CODEOWNERS`, `SECURITY.md`.
- [ ] `SECURITY.md` is committed at repo root and renders at `/security/policy`.
- [ ] The throwaway test branch is deleted at the end of the verification run.

## 8. Open questions / decisions

| #   | Question                                                                                                   | Recommended default                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dependabot grouping aggressiveness — one PR per package or one combined PR per ecosystem?                  | **One combined PR per ecosystem** (`groups: minor-and-patch`). Solo maintainer review bandwidth is the bottleneck; weekly batched PRs minimise context-switching. Majors stay individual.                      |
| 2   | Auto-merge Dependabot patch updates?                                                                       | **No in MVP.** Manual review for every Dependabot PR. Auto-merge requires green CI + at-least-one approval; with one maintainer that is a self-approval pattern. Revisit when CI matrix in INF-005 stabilises. |
| 3   | Use GitHub native scanning, Gitleaks, or both?                                                             | **Both.** Native push-protection blocks the leak at the git layer (cannot bypass without explicit ACK). Gitleaks catches at PR time and locally; covers patterns native scanning may miss (custom regexes).    |
| 4   | What email address to publish in `SECURITY.md`?                                                            | `security@<domain>` once the domain decision in INF-009 / INF-011 lands. Until then, the maintainer's personal email is acceptable — placeholder noted in the file.                                            |
| 5   | Pin GitHub Actions by tag (`@v2`) or full commit SHA?                                                      | **Full commit SHA** for security-relevant actions (`gitleaks-action`, `setup-node`). Tag pins are vulnerable to retagging; SHA pins are the OpenSSF Scorecard recommendation.                                  |
| 6   | Should Gitleaks scan deleted files / git history on every PR (full scan), or only the diff?                | **Diff-only on PR; full historical scan on weekly schedule.** Full-scan-on-PR is slow on growing repos; weekly catches retro additions.                                                                        |
| 7   | Where to enable Dependabot config drift detection (e.g. someone editing the file to disable an ecosystem)? | Rely on CODEOWNERS auto-review on `.github/` paths. Add an explicit lint job in INF-005 if drift becomes a recurring issue.                                                                                    |

## 9. Risks

| Risk                                                                                                                               | Mitigation                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dependabot PR-fatigue swamps the solo maintainer**, leading to ignored security updates that defeat the whole point of the task. | Combined per-ecosystem PRs (Open Question 1) keep weekly volume to ≤3 PRs typical. Add `Dependabot` to a Slack/email digest in INF-012 observability so updates surface without manually checking the tab. Re-evaluate cadence after sprint 2. |
| **Pre-commit Gitleaks slows down `git commit` noticeably** on a growing repo and developers bypass with `--no-verify`.             | `gitleaks protect --staged` scans only the diff — fast (<200 ms on this repo size). Document the runtime cost in the hook file. If it becomes painful, move full scans to CI-only and leave pre-commit as a fast advisory.                     |
| **False positive on a real example in product docs** (e.g. PSD2 token shapes in ARCHITECTURE.md §5.2) blocks a legitimate PR.      | The path-scoped allowlist in `.gitleaks.toml` already exempts `docs/mvp/**`. Process for new false positives: maintainer adds the specific regex (not a blanket path) to the allowlist in the same PR. Document this in `SECURITY.md`.         |
