# Security Setup — One-Time Steps

These settings must be enabled manually in the GitHub repository settings. They cannot be
configured via committed files.

## GitHub Secret Scanning

1. Go to **Settings → Security → Code security and analysis**.
2. Enable **Secret scanning**.
3. Enable **Push protection** (blocks pushes containing detected secrets).

## Branch Protection

Main branch protection rules (set via Settings → Branches → Add rule for `master`):

- Require a pull request before merging
- Require status checks to pass (CI workflow once INF-005 is merged)
- Do not allow bypassing the above settings
- Restrict force pushes

## Dependabot Alerts

Dependabot alerts are enabled automatically when Dependabot is configured
(`.github/dependabot.yml` — see INF-007). Verify in **Settings → Security → Dependabot alerts**.
