# Branch Governance (Desktop + Mobile)

## Branch Strategy
- Desktop: `main` freeze by default unless explicitly reopened.
- Mobile legacy baseline: `codex/mobile-v1-baseline`
- Mobile architecture program: `codex/mobile-arch-v2`
- Worker branches must branch from `codex/mobile-arch-v2`, not `main`.
- Main policy: **only merge reviewed milestones into `main`**.

## Current Refactor Program
- Baseline tag: `mobile-v1-freeze-2026-03-13`
- Canonical rule: `main` stays coherent and demoable; it is not the long-running construction site.
- Legacy code receives bug fixes only.
- New architecture work lands in `codex/mobile-arch-v2` until cutover.
- Worker branch naming:
  - `codex/mobile-kernel-contracts`
  - `codex/mobile-decision-shell`
  - `codex/mobile-utility-shell`

## Required Daily Routine
- Each developer runs at least once daily:
  - `git fetch origin`
  - `git rebase origin/codex/mobile-arch-v2`
- The architecture owner rebases `codex/mobile-arch-v2` onto `main` only at reviewed milestones.

## CI Gates (must pass before merge)
- `frontend-lint`
- `frontend-typecheck-build`
- `backend-tests`
- `mobile-contract-parity` (to be added during refactor)
- `mobile-result-contract` (to be added during refactor)

## Code Owners
- File: `.github/CODEOWNERS`
- Update mobile owner handle in this file before enabling strict CODEOWNERS review.

## Apply Branch Protection
```bash
OWNER=joby62 REPO=cosmeles ./.github/scripts/apply-branch-protection.sh
```

## Recommended GitHub Settings
- Require a pull request before merging
- Require approvals: `1` for worker branches, `2` for merge into `main`
- Require review from Code Owners
- Dismiss stale approvals when new commits are pushed
- Require approval of the most recent reviewable push
- Require conversation resolution before merging
- Require branches to be up to date before merging
- Require linear history
- Do not allow force pushes
- Do not allow deletions
