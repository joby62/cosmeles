# Branch Governance

## Core Rule

- `main` is the default reviewed source of truth unless the owner explicitly freezes another integration branch for a scoped program.
- If an initiative temporarily uses a non-`main` integration branch, that branch must be named in a governed workflow or initiative doc before workers branch from it.
- Branch policy must follow current docs, not stale historical branch names remembered from earlier refactor phases.

## Default Strategy

- Default base branch for new work: `main`
- Worker branches should be cut from the owner-designated base branch for the current initiative.
- Long-running integration branches are opt-in, not assumed.
- Historical mobile branches such as `codex/mobile-arch-v2` or `codex/mobile-v1-baseline` are historical references unless a current doc explicitly reactivates them.

## Required Daily Routine

- Each developer runs at least once daily:
  - `git fetch origin`
  - `git rebase origin/<owner-designated-base-branch>`
- If the current initiative has no explicit alternate integration branch, treat `main` as `<owner-designated-base-branch>`.
- The architecture owner decides when reviewed work merges back to `main`.

## CI Gates (must pass before merge)

- `frontend-lint`
- `frontend-typecheck-build`
- `backend-tests`
- `mobile-contract-parity` when enabled
- `mobile-result-contract` when enabled

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
