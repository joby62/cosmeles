# Mobile Initiative Docs

This folder contains the mobile initiative's active docs plus dated archive snapshots.

## Subfolders

- `product/`
  - active PRDs, user-path definitions, and product-behavior decisions
- `architecture/`
  - active architecture rules, playbooks, audits, and convergence notes
- `reviews/`
  - initiative-facing acceptance notes, audits, and review records
- `records/`
  - completion notes, decision logs, and milestone checkpoints
- `archive/`
  - dated snapshots of superseded mobile docs kept for project history

## Placement Rules

- If the doc defines what the current mobile product should do, place it under `product/`.
- If the doc defines how the current mobile system is structured, migrated, or audited, place it under `architecture/`.
- If the doc records initiative-facing review output, place it under `reviews/`.
- If the doc records what happened, shipped, rolled back, or closed, place it under `records/`.
- If a durable doc is being replaced or materially rewritten, archive the prior version first under `archive/YYYY-MM-DD/` while preserving the original area shape such as `root/` or `architecture/`.
- Archived snapshots should keep source-path metadata plus original file timestamps appended at the end of the document.

## Current High-Value Entry Points

- current product PRD: `product/mobile-decision-prd-v1.md`
- current result-intent PRD: `product/mobile-result-intent-routing-prd-v1.md`
- current closure execution freeze: `architecture/mobile-first-run-and-compare-closure-rollout.md`
- current architecture baseline: `architecture/mobile-architecture-v2.md`
- current architecture playbook: `architecture/mobile-refactor-playbook.md`
- initiative currentness surfaces:
  - `/Users/lijiabo/Documents/New project/docs/initiatives/NOW.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/DOC_INDEX.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/TIMELINE.md`
- current archive snapshot roots:
  - `archive/2026-03-19/`
  - `archive/2026-03-24/`
