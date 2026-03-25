# Mobile Initiative Docs

This folder contains the mobile initiative's live truth, milestone history, and dated archive snapshots.

## Subfolders

- `product/`
  - live PRDs, user-path definitions, and product-behavior decisions
- `architecture/`
  - live architecture baselines, runtime roadmaps, and audits
- `reviews/`
  - initiative-facing acceptance reviews and audit output
- `records/`
  - milestone records, closure notes, and phase history
- `archive/`
  - dated snapshots of superseded mobile docs

## Placement Rules

- If the doc defines current mobile product behavior, place it under `product/`.
- If the doc defines current mobile system structure or migration truth, place it under `architecture/`.
- If the doc records initiative-facing review output, place it under `reviews/`.
- If the doc records what shipped or closed, place it under `records/`.
- If a durable doc is replaced or materially rewritten, archive the prior version under `archive/YYYY-MM-DD/`.

## Current High-Value Entry Points

- current product PRD:
  - `product/mobile-decision-prd-v1.md`
- current product execution freeze:
  - `architecture/mobile-first-run-and-compare-closure-rollout.md`
- current architecture baseline:
  - `architecture/mobile-architecture-v2.md`
- completed PostgreSQL migration truth:
  - `architecture/mobile-postgresql-full-migration-plan-v1.md`
- completed runtime roadmap:
  - `architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- runtime roadmap final closure summary:
  - `records/mobile-runtime-roadmap-closure-summary-v1.md`
- per-phase runtime history:
  - `records/mobile-runtime-phase-0-record-v1.md`
  - `records/mobile-runtime-phase-1-record-v1.md`
  - `records/mobile-runtime-phase-2-record-v1.md`
  - `records/mobile-runtime-phase-3-record-v1.md`
  - `records/mobile-runtime-phase-4-record-v1.md`
  - `records/mobile-runtime-phase-5-record-v1.md`
  - `records/mobile-runtime-phase-6-record-v1.md`
- initiative currentness surfaces:
  - `/Users/lijiabo/Documents/New project/docs/initiatives/NOW.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/DOC_INDEX.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/TIMELINE.md`

## Current Interpretation

- `phase-14` through `phase-20` are complete historical runtime execution rounds.
- `postgresql-phase-0 / phase-21` is now completed historical preparation work.
- `postgresql-phase-1 / phase-22` is now completed historical production-default contract work.
- `postgresql-phase-2 / phase-23` is now completed historical high-concurrency table-group migration work.
- `postgresql-phase-3 / phase-24` is now completed historical mobile-state table-group migration work.
- `postgresql-phase-4 / phase-25` is now completed historical SQLite-closure work.
- There is no active PostgreSQL migration round at the moment.
- Runtime work remains closed as its own route; PostgreSQL full migration is governed by a new initiative truth and new dispatch bundle instead of reusing `phase-20`.

## Current Archive Roots

- `archive/2026-03-19/`
- `archive/2026-03-24/`
