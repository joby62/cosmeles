---
doc_id: mobile-refactor-playbook
title: Mobile Refactor Playbook
doc_type: architecture
initiative: mobile
workstream: architecture
owner: architecture-owner
status: frozen
priority: p0
created_at: 2026-03-19
updated_at: 2026-03-24
frozen_at: 2026-03-19
related_docs:
  - mobile-architecture-v2
  - mobile-runtime-infrastructure-upgrade-plan-v1
---

# Mobile Refactor Playbook

## Purpose
- Keep the active mobile architecture docs focused on current operating rules instead of frozen phase-by-phase war notes.
- Point execution ownership to the team-owned prompt hierarchy under `docs/workflow/teams/engineering/mobile-architecture/`.
- Preserve replaced playbook snapshots under the mobile initiative archive.

## Current Status
- The historical Phase 0-9 playbook has been archived at [`../archive/2026-03-19/architecture/mobile-refactor-playbook.md`](../archive/2026-03-19/architecture/mobile-refactor-playbook.md).
- The live mobile shell now follows the decision-first product PRDs under [`../product/`](../product/).
- This document is the current operating playbook, not a replay log of every historical branch and worker phase.

## Live Workstreams

### 1. Decision shell
- `/m` is the entry home: new-user landing plus returning-user workspace.
- `/m/choose` only handles category dispatch and resume.
- Profile and result flows read shared config and shared result contracts.

### 2. Result and utility loop closure
- Result pages prioritize one strong conversion CTA.
- Compare is the first validation path, rationale/wiki is secondary, and task switching is explicit.
- Utility pages must preserve `source`, `return_to`, `scenario_id`, `result_cta`, and continuation semantics through shared helpers.

### 3. Shared contracts
- Decision config, route state, result shape, source vocabulary, and analytics vocabulary stay centrally owned.
- No page may add parallel truth for questionnaire text, result semantics, or continuation routing.
- Contract changes must land before UI surfaces start depending on them.

## Document Ownership
- Product behavior changes first update:
  - [`../product/mobile-decision-prd-v1.md`](../product/mobile-decision-prd-v1.md)
  - [`../product/mobile-result-intent-routing-prd-v1.md`](../product/mobile-result-intent-routing-prd-v1.md)
- Architecture and migration rule changes update:
  - [`./mobile-architecture-v2.md`](./mobile-architecture-v2.md)
  - this playbook
  - [`./mobile-branch-convergence-checklist.md`](./mobile-branch-convergence-checklist.md) when branch facts or convergence rules change
- Worker prompts, owner prompts, and assignments live only under:
  - [`../../../teams/engineering/mobile-architecture/`](../../../teams/engineering/mobile-architecture/)
- Historical prompt wording or historical phase choreography belongs in:
  - [`../archive/`](../archive/)

## Operating Rules
- Do not duplicate full worker prompts inside initiative docs.
- Archive the superseded version of any durable initiative doc before a material rewrite.
- Treat archived branch and phase notes as historical context only, never as current branch truth.
- If a change alters route semantics, analytics semantics, or result semantics, update the shared contracts and the relevant live doc in the same pass.

## Review Gates
- New-user path remains `/m` -> `/m/choose` -> `/m/[category]/profile` -> `/m/[category]/result`.
- Returning-user `/m` stays workspace-oriented and does not regress into a first-visit four-entry portal.
- Utility loops remain reachable from result and `me` flows without page-local query assembly drift.
- No active initiative doc points readers to stale branch hashes or duplicated prompt bodies.
- No archived snapshot is edited except to append archive metadata.

## Related Docs
- Current architecture baseline: [`./mobile-architecture-v2.md`](./mobile-architecture-v2.md)
- Current convergence note: [`./mobile-branch-convergence-checklist.md`](./mobile-branch-convergence-checklist.md)
- Current utility audit log: [`./audits/mobile-utility-adapter-audit.md`](./audits/mobile-utility-adapter-audit.md)
- Historical playbook snapshot: [`../archive/2026-03-19/architecture/mobile-refactor-playbook.md`](../archive/2026-03-19/architecture/mobile-refactor-playbook.md)
