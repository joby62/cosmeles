# Branch Governance (Desktop + Mobile)

## Branch Strategy
- Desktop: `feat/desktop-governance`
- Mobile: `feat/mobile-display`
- Main policy: **only merge via PR** (no direct push)

## Required Daily Routine
- Each developer runs at least once daily:
  - `git fetch origin`
  - `git rebase origin/main`

## CI Gates (must pass before merge)
- `frontend-lint`
- `frontend-typecheck-build`
- `backend-tests`

## Code Owners
- File: `.github/CODEOWNERS`
- Update mobile owner handle in this file before enabling strict CODEOWNERS review.

## Apply Branch Protection
```bash
OWNER=joby62 REPO=cosmeles ./.github/scripts/apply-branch-protection.sh
```

## Recommended GitHub Settings
- Require a pull request before merging
- Require approvals: `1`
- Require review from Code Owners
- Dismiss stale approvals when new commits are pushed
- Require approval of the most recent reviewable push
- Require conversation resolution before merging
- Require branches to be up to date before merging
- Require linear history
- Do not allow force pushes
- Do not allow deletions
