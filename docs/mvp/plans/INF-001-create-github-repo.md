# INF-001 — Create GitHub repository + branch protection — Implementation Plan

## 1. Task summary

- **Task ID**: INF-001
- **Title**: Create GitHub repository + branch protection
- **Area**: Infra
- **Effort**: XS (~0.5d)

**Context.** This task creates the bare container that every subsequent piece of the Power Budget MVP lives in: a private GitHub repo named `power-budget` with `master` as the protected default branch, an initial commit holding only repo-management metadata (`README`, `LICENSE`, `.gitignore`, `CODEOWNERS`, PR template), and branch-protection rules that require PR + (eventually) green CI before merging. It is wave-1 because every other wave-1/2 task — INF-002 (pnpm + Turborepo scaffold), INF-003 (ESLint), INF-007 (Dependabot + secret scanning) — is blocked on a working repo with a protected `master`. It directly enables the CI workflow described in ARCHITECTURE.md §10 ("CI: GitHub Actions … `pull_request`: `pnpm install`, `pnpm turbo run lint typecheck test`") and the secret-handling discipline described in §6 ("Security & secrets") / §6 "Multi-tenancy" testing gates that must run in CI before merge.

## 2. Scope

**In scope**

- Create a private GitHub repository under the chosen owner with the name `power-budget`.
- Set default branch name to `master`.
- Push an initial commit containing: `README.md` (one-paragraph project blurb + link to `docs/mvp/`), `LICENSE`, `.gitignore` (Node + macOS + JetBrains), `CODEOWNERS` placeholder, and a PR template under `.github/PULL_REQUEST_TEMPLATE.md`.
- Configure branch protection on `master`:
  - Require pull request before merge (≥1 approving review; CODEOWNERS review when the owners file matches).
  - Require status checks to pass — placeholder list now (no required checks selected yet because no CI workflow exists); INF-005 will add `ci / lint`, `ci / typecheck`, `ci / test` to the required list.
  - Require branches to be up to date before merge.
  - Block direct pushes to `master` (no force-pushes, no deletions).
  - Require linear history.
  - Require conversation resolution before merge.
  - Apply rules to administrators (`enforce_admins: true`) to avoid bypass accidents.
- Enable squash-merge as the only allowed merge style; disable merge commits and rebase-merges in repo settings.
- Enable "Automatically delete head branches" after merge.
- Disable Wiki + Projects (we use Jira/docs); keep Issues enabled (low-cost backlog overflow).
- Document the branch-protection state in `docs/mvp/plans/INF-001-create-github-repo.md` as the source-of-truth snapshot (this file).

**Out of scope**

- Any source code (no `package.json`, no TypeScript, no Turborepo wiring — that is INF-002).
- CI workflows (`.github/workflows/ci.yml`, `build.yml`) — INF-005 / INF-006.
- Dependabot config and secret-scanning configuration — INF-007.
- Branch-protection on additional branches (e.g. `staging`) — added when INF-013 sets up staging.
- Deploy environments and required reviewers — INF-006 adds the `staging` environment.
- Team/role management beyond the initial owner + partner collaborator.
- Required status checks bound to CI jobs — added by INF-005 once those jobs exist.

## 3. Files to create / modify

All paths are relative to repo root unless stated otherwise.

| Path                                           | Purpose                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `README.md`                                    | One-paragraph project description + pointer to `docs/mvp/PRODUCT.md` and `docs/mvp/ARCHITECTURE.md`.        |
| `LICENSE`                                      | Repo license file (see Open Question 3 — recommended `UNLICENSED` for the MVP private phase).               |
| `.gitignore`                                   | Baseline ignores: `node_modules/`, `dist/`, `.turbo/`, `.env*`, `.DS_Store`, `.idea/`, `.vscode/`, `*.log`. |
| `CODEOWNERS`                                   | Placeholder ownership: `* @<owner>` so every PR triggers an owner review until per-package owners exist.    |
| `.github/PULL_REQUEST_TEMPLATE.md`             | PR description scaffold: Summary, Linked task ID, Screenshots/Logs, Test plan, Risk.                        |
| `.github/CODEOWNERS` _(alternative)_           | GitHub also recognises this path — pick one location; this plan uses repo-root `CODEOWNERS`.                |
| `docs/mvp/plans/INF-001-create-github-repo.md` | This plan file (already authored).                                                                          |

No directories outside `.github/`, `docs/`, and the repo root are touched in this task.

## 4. Key interfaces & contracts

These values are consumed by downstream tasks and must be fixed here.

- **Repo URL**: `https://github.com/<owner>/power-budget` (owner TBD — see Open Question 1).
- **Default branch**: `master`.
- **Visibility**: `private`.
- **Allowed merge style**: squash merge only. Squash commit title pattern recommended: `<TASK-ID> <short imperative summary>` to match the global commit convention in `~/.claude/CLAUDE.md`.
- **Branch protection rules on `master`**

  | Rule                                           | Value                                                                    |
  | ---------------------------------------------- | ------------------------------------------------------------------------ |
  | Require a pull request before merging          | true                                                                     |
  | Required approving reviews                     | 1                                                                        |
  | Dismiss stale reviews on new commit            | true                                                                     |
  | Require review from Code Owners                | true                                                                     |
  | Require status checks to pass                  | true (strict mode — branch must be up to date)                           |
  | Required status check contexts (initial)       | `[]` (none yet; INF-005 adds `ci / lint`, `ci / typecheck`, `ci / test`) |
  | Require conversation resolution before merging | true                                                                     |
  | Require linear history                         | true                                                                     |
  | Require signed commits                         | false (revisit when team grows — Open Question 5)                        |
  | Block force pushes                             | true                                                                     |
  | Block deletions                                | true                                                                     |
  | Enforce for administrators                     | true                                                                     |
  | Allow specified actors to bypass               | none                                                                     |

- **CODEOWNERS structure** (initial — every path owned by the single maintainer until INF-002 splits the repo into packages; INF-003 / BE-001 / WEB-001 / MOB-001 will add per-package owners as separate PRs):

  ```text
  # CODEOWNERS — see https://docs.github.com/en/repositories/managing-your-repositories-settings-and-customizing-your-repository/about-code-owners
  *                @<owner>
  /docs/           @<owner>
  /.github/        @<owner>
  ```

- **Env-var / secret naming convention** (declared here so downstream tasks INF-007 / INF-009 / INF-010 / SEC-002 use the same names):
  - All secrets live in GitHub Actions org/repo secrets and in Fly.io secrets — never committed.
  - Naming: `SCREAMING_SNAKE_CASE`, prefixed by purpose. Reserved keys for later tasks:
    - `DATABASE_URL` (Postgres, set by INF-010)
    - `REDIS_URL` (BullMQ, set by INF-010)
    - `KEK_MASTER` (encryption KEK in dev/test, KMS-managed in prod — ARCHITECTURE.md §6)
    - `RESEND_API_KEY` (email)
    - `GOCARDLESS_SECRET_ID`, `GOCARDLESS_SECRET_KEY`
    - `WISE_API_TOKEN`
    - `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
    - `SENTRY_DSN` (INF-014)
    - `FLY_API_TOKEN` (for INF-009 deploy workflow)
  - This task only **reserves** the names; no values are set.

- **PR template fields** (downstream automation may scrape them):

  ```markdown
  ## Summary

  ## Linked task

  Task ID: <e.g. INF-002>

  ## Test plan

  ## Screenshots / logs

  ## Risk & rollout
  ```

## 5. Step-by-step build order

Each step is ≤30 min and ordered top-to-bottom. Steps use `gh` CLI commands; substitute the resolved values for `<owner>`, etc.

1. **Confirm `gh` CLI is authenticated.** `gh auth status`. If not authenticated, `gh auth login` (HTTPS, scopes: `repo`, `workflow`, `admin:org` if owner is an org).
2. **Decide the four open variables.** Confirm with the user (see §8): repo owner (`<owner>`), visibility (`private`), license (`UNLICENSED`), CODEOWNER (`@<owner>`).
3. **Create the repo (empty, no auto-init).**

   ```bash
   gh repo create <owner>/power-budget \
     --private \
     --description "Household budgeting app — planned vs actual with real bank data (MVP)" \
     --disable-wiki \
     --disable-issues=false \
     --confirm
   ```

   Then locally:

   ```bash
   cd ~/IdeaProjects/power-budget
   git init -b master
   git remote add origin git@github.com:<owner>/power-budget.git
   ```

4. **Stage the initial files locally.** Create `README.md`, `LICENSE` (per chosen license), `.gitignore`, `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`. Keep `docs/mvp/` (already present) staged as-is.
5. **First commit.**

   ```bash
   git add README.md LICENSE .gitignore CODEOWNERS .github/PULL_REQUEST_TEMPLATE.md docs/
   git commit -m "INF-001 initial repo scaffold: license, gitignore, CODEOWNERS, PR template"
   git push -u origin master
   ```

6. **Configure repo-level settings via `gh api`.**

   ```bash
   gh api -X PATCH repos/<owner>/power-budget \
     -f default_branch=master \
     -F allow_squash_merge=true \
     -F allow_merge_commit=false \
     -F allow_rebase_merge=false \
     -F delete_branch_on_merge=true \
     -F has_wiki=false \
     -F has_projects=false
   ```

7. **Apply branch protection on `master`.**

   ```bash
   gh api -X PUT repos/<owner>/power-budget/branches/master/protection \
     -H "Accept: application/vnd.github+json" \
     --input - <<'JSON'
   {
     "required_status_checks": { "strict": true, "contexts": [] },
     "enforce_admins": true,
     "required_pull_request_reviews": {
       "dismiss_stale_reviews": true,
       "require_code_owner_reviews": true,
       "required_approving_review_count": 1,
       "require_last_push_approval": false
     },
     "required_linear_history": true,
     "required_conversation_resolution": true,
     "allow_force_pushes": false,
     "allow_deletions": false,
     "block_creations": false,
     "restrictions": null
   }
   JSON
   ```

8. **Invite the partner / collaborator (if applicable).** `gh api -X PUT repos/<owner>/power-budget/collaborators/<partner-handle> -f permission=push`.
9. **Smoke-test the protection** (see §6 step 4): from a feature branch, attempt a direct push to `master` and confirm rejection.
10. **Capture the resulting state.** Run the verification snippet in §6 step 1 and paste the output into the PR that lands this plan, so the recorded contract matches reality.

## 6. Test plan

Verification for an infra task is observability of state, not unit tests.

1. **Branch-protection state matches the contract.**

   ```bash
   gh api repos/<owner>/power-budget/branches/master/protection \
     | jq '{
         req_pr: .required_pull_request_reviews,
         req_checks: .required_status_checks,
         linear: .required_linear_history.enabled,
         conv: .required_conversation_resolution.enabled,
         force: .allow_force_pushes.enabled,
         del: .allow_deletions.enabled,
         admins: .enforce_admins.enabled
       }'
   ```

   Assert every flag matches the table in §4.

2. **Repo settings match.**

   ```bash
   gh api repos/<owner>/power-budget \
     | jq '{private, default_branch, allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge, has_wiki, has_projects}'
   ```

3. **CODEOWNERS is recognised.** Open a draft PR touching `docs/`; confirm `@<owner>` is auto-requested as reviewer.
4. **Direct push to `master` is rejected.**

   ```bash
   git checkout master && git commit --allow-empty -m "INF-001 protection smoke test" && git push origin master
   ```

   Expected: `remote: error: GH006: Protected branch update failed for refs/heads/master`. Reset (`git reset --hard origin/master`) after.

5. **PR template renders.** Open a draft PR; confirm the body is pre-filled with the template fields from §4.
6. **Manual visual check in the GitHub UI.** Settings → Branches → `master` → all rules visible and ticked. Settings → General → merge button shows only "Squash and merge".

## 7. Acceptance criteria

(Refined from BACKLOG.md INF-001.)

- [ ] Private repo exists at `github.com/<owner>/power-budget` with default branch `master`.
- [ ] `gh api repos/<owner>/power-budget/branches/master/protection` returns a JSON body whose fields match the table in §4 exactly.
- [ ] Direct `git push origin master` from a local clone is rejected with `GH006` (verified in §6 step 4).
- [ ] A PR targeting `master` requires at least one approving review and CODEOWNERS review before the merge button enables.
- [ ] Only "Squash and merge" is available on the merge button.
- [ ] Repository has `has_wiki=false`, `has_projects=false`, `delete_branch_on_merge=true`.
- [ ] `CODEOWNERS` file is committed at repo root and matched paths auto-request `@<owner>`.
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` is committed and renders on new PRs.
- [ ] `LICENSE`, `README.md`, `.gitignore` are committed.
- [ ] Required status checks list is empty in this task (placeholder); INF-005 will populate it.

## 8. Open questions / decisions

| #   | Question                                                                                  | Recommended default                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which GitHub account owns the repo — personal `@dimitryc-ytree`-style user, or a new org? | Personal account for MVP (zero cost, simplest); create an org when a third collaborator joins.                                                                                                                                     |
| 2   | Exact repo name — `power-budget` or something more distinctive?                           | `power-budget` to match the working dir and BACKLOG references. Defer rebrand to v3 marketing.                                                                                                                                     |
| 3   | License — `UNLICENSED` private, MIT, or AGPL?                                             | `UNLICENSED` (proprietary, all rights reserved) for MVP. The project is a private household app; revisit before public v3.                                                                                                         |
| 4   | Who is the initial CODEOWNER and the required reviewer?                                   | The single maintainer (`@<owner>`). Until INF-002 introduces packages, one owner is sufficient. Self-approval is impossible — solo-dev workflow needs an exception (see Risk 2).                                                   |
| 5   | Require signed commits on `master`?                                                       | Off in MVP; on once a second human committer joins. Signing adds operational friction that does not pay off with one committer.                                                                                                    |
| 6   | Required approving review count — 1 or 0 for solo work?                                   | 1, with a documented exception: maintainer pushes via the "Allow specified actors to bypass" list when working solo. Cleaner alternative: keep at 1 and use stacked PRs reviewed by AI-assisted review tooling. Confirm with user. |
| 7   | Should branch protection include `staging` already?                                       | No; INF-013 introduces staging and adds protection in the same task.                                                                                                                                                               |
| 8   | Where does CODEOWNERS live — repo root or `.github/`?                                     | Repo root (`CODEOWNERS`) — single canonical location, matches existing `~/.claude/CLAUDE.md` convention referenced in this repo.                                                                                                   |

All eight require user confirmation before step 2 of §5 runs.

## 9. Risks

| Risk                                                                                                                                                  | Mitigation                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Solo-dev block by branch protection.** With `required_approving_review_count: 1` and `enforce_admins: true`, the sole maintainer cannot self-merge. | Add the maintainer to the bypass list temporarily, OR keep enforcement strict and require self-approval via a second account / GitHub's AI reviewer until the partner joins as a reviewer in Sprint 2. Decide via Open Question 6 before pushing the rule. |
| **CODEOWNERS file syntactically invalid → silently ignored.** Means CODEOWNERS review is not enforced even though the protection rule says it is.     | Run `gh api repos/<owner>/power-budget/codeowners/errors` after the first commit; CI in INF-005 will also start failing on invalid CODEOWNERS — wire that test as part of INF-005's checklist.                                                             |
| **Required status checks list is empty now, so PRs can be merged without CI.** Window of weakness until INF-005 lands.                                | Treat INF-002 + INF-005 as a single tight follow-on (both planned for wave 2). Maintainer commits to not merging untested PRs before INF-005; add a `TODO` issue tagged `INF-005-required-checks` to track the gap close.                                  |
