# Docs Index

`docs/` is now split into two systems with different jobs.

## Top-Level Split

- `docs/workflow/`
  - rules about how people work
  - team-owned prompts and handoffs
  - startup bootstraps for new dialogs
  - operations runbooks and coordination guides
- `docs/initiatives/`
  - initiative output docs
  - live product, architecture, rollout, review, and record docs
  - initiative-level history and archive

## Placement Rule

- If the file teaches people how to collaborate, start a role dialog, dispatch work, govern docs, or operate the repo, it belongs in `docs/workflow/`.
- If the file defines or records what a product or system currently is, what changed, what shipped, what is blocked, or what was archived for a specific initiative, it belongs in `docs/initiatives/`.
- Team prompts, startup prompts, governance, and ops docs do not belong inside initiative folders.
- PRDs, specs, architecture baselines, rollout plans, reviews, records, and archive snapshots do not belong inside `docs/workflow/`.

## Workflow Areas

- `docs/workflow/governance/`
  - cross-team rules, document-state policy, and decision SOPs
- `docs/workflow/operations/`
  - runbooks, deployment notes, and repo operating instructions
- `docs/workflow/teams/`
  - role-owned prompts, handoffs, review notes, and assignment scaffolds
- `docs/workflow/startup-prompts/`
  - copy-ready first-message bootstraps for owner and worker dialogs

## Initiative Areas

- `docs/initiatives/<initiative>/product/`
  - live product truth
- `docs/initiatives/<initiative>/architecture/`
  - live system truth, rollout, and audit docs
- `docs/initiatives/<initiative>/reviews/`
  - initiative-facing acceptance, critique, and audit output
- `docs/initiatives/<initiative>/records/`
  - milestone history, completion notes, and decision logs
- `docs/initiatives/<initiative>/archive/`
  - superseded or historical initiative docs

## Current High-Value Entry Points

- workflow index: `/Users/lijiabo/Documents/New project/docs/workflow/README.md`
- initiatives index: `/Users/lijiabo/Documents/New project/docs/initiatives/README.md`
- deployment and scale guide: `/Users/lijiabo/Documents/New project/docs/workflow/operations/README.md`
- day-2 ops runbook: `/Users/lijiabo/Documents/New project/docs/workflow/operations/operations-runbook.md`
- initiative currentness surfaces:
  - `/Users/lijiabo/Documents/New project/docs/initiatives/NOW.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/DOC_INDEX.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/TIMELINE.md`
- mobile initiative docs: `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/`
- mobile current entry surface: `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/README.md`
- engineering team prompt hierarchy: `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/`
- startup bootstraps: `/Users/lijiabo/Documents/New project/docs/workflow/startup-prompts/`
- cross-team collaboration rules: `/Users/lijiabo/Documents/New project/docs/workflow/governance/team-collaboration-decision-sop.md`
- document state system design: `/Users/lijiabo/Documents/New project/docs/workflow/governance/document-state-system-design-v1.md`
