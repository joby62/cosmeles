---
doc_id: mobile-architecture-v2
title: Mobile Architecture V2
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
  - mobile-decision-prd-v1
  - mobile-refactor-playbook
  - mobile-runtime-infrastructure-upgrade-plan-v1
---

# Mobile Architecture V2

## Goal
- Keep the public `/m` path family stable while the product runs on a decision-first home and a contract-driven decision kernel.
- Make `/m` the active entry: landing for new users, workspace for returning users.
- Keep `compare`, `wiki`, and `me` as supporting loops reached from result or returning-user flows, not peer first-visit CTAs.
- Keep decision config, result shape, route state, and analytics semantics centrally owned.

## Product Operating Model
1. `/m`
   - Decision landing for new users.
   - Stateful workspace for returning users.
2. `/m/choose`
   - Category dispatch and resume recovery only.
3. `/m/[category]/profile`
   - Questionnaire flow driven by shared decision config.
4. `/m/[category]/result`
   - Intent-routing result page: convert, compare, understand, or switch task.
5. `/m/wiki/*`, `/m/compare/*`, `/m/me/*`
   - Utility loops that preserve continuity through shared route-state helpers.

## Non-Negotiables
- `/m/choose` is not the default first screen. It exists to dispatch category choice or recover progress after the home CTA or explicit re-entry.
- `compare`, `wiki`, and `me` remain important product modules, but they do not compete with the first-visit home CTA.
- The result page must preserve one strong conversion action plus secondary compare, rationale, and task-switch routes.
- Frontend and backend must not maintain separate sources of truth for questionnaire semantics.
- Route state and analytics semantics must be centrally owned; pages may not invent ad hoc query or event vocabulary.

## System Layers
- `shared/mobile/decision/*`
  - Canonical decision catalog, category metadata, question order, labels, durations, route titles, and guardrails.
- `shared/mobile/contracts/*`
  - Canonical route-state, analytics-event, and result-schema contracts.
- `frontend/features/mobile-decision/*`
  - Home, choose, questionnaire, result shell.
- `frontend/features/mobile-utility/*`
  - Wiki, compare, me shell.
- `frontend/domain/mobile/*`
  - Shared routing, progress, analytics, and decision adapters for frontend code.
- `backend/app/domain/mobile/*`
  - Decision resolution, result publishing/loading, and utility-side domain logic.

## Target Repo Layout
```text
shared/mobile/
  decision/
  contracts/

frontend/features/
  mobile-decision/
  mobile-utility/

frontend/domain/mobile/

backend/app/domain/mobile/

backend/tests/mobile/

frontend/legacy/mobile/
```

## Route Policy
- Public path family stays under `/m`.
- Route groups split experience shells into `decision` and `utility`.
- Decision shell owns:
  - `/m`
  - `/m/choose`
  - `/m/[category]/profile`
  - `/m/[category]/result`
- Utility shell owns:
  - `/m/wiki/*`
  - `/m/compare/*`
  - `/m/me/*`
- `/m` may adapt by user state, but it still belongs to the decision shell.
- Utility pages must preserve `source`, `return_to`, `scenario_id`, `result_cta`, `category`, and continuation semantics through shared helpers rather than page-local string assembly.

## Contract Policy
- `decision config`
  - One source of truth shared by frontend and backend.
- `selection_result.v3`
  - Fixed shape: one result, three reasons, one next step, secondary loop actions.
- `route_state.v1`
  - Centralized query semantics for `source`, `return_to`, `resume_token`, `scenario_id`, `category`, `result_cta`.
- `analytics_events.v1`
  - Whitelisted event names and required props only.

## Document Ownership
- Product intent and user-path behavior live in:
  - [`../product/mobile-decision-prd-v1.md`](../product/mobile-decision-prd-v1.md)
  - [`../product/mobile-result-intent-routing-prd-v1.md`](../product/mobile-result-intent-routing-prd-v1.md)
- Current architecture and migration rules live in:
  - this file
  - [`./mobile-refactor-playbook.md`](./mobile-refactor-playbook.md)
  - [`./mobile-first-run-and-compare-closure-rollout.md`](./mobile-first-run-and-compare-closure-rollout.md)
  - [`./mobile-runtime-infrastructure-upgrade-plan-v1.md`](./mobile-runtime-infrastructure-upgrade-plan-v1.md)
- Team-owned prompts and assignments live under:
  - [`../../../workflow/teams/engineering/mobile-architecture/`](../../../workflow/teams/engineering/mobile-architecture/)
- Historical snapshots live under:
  - [`../archive/`](../archive/)

## Exit Criteria
- New-user path is `/m` -> `/m/choose` -> `/m/[category]/profile` -> `/m/[category]/result`.
- Returning-user `/m` behaves as a workspace without regressing into a first-visit four-entry portal.
- Compare/wiki/me remain integrated through result and `me` flows.
- No page invents new route or analytics semantics ad hoc.

## Archived Snapshot
- Historical pre-cleanup snapshot:
  - [`../archive/2026-03-19/architecture/mobile-architecture-v2.md`](../archive/2026-03-19/architecture/mobile-architecture-v2.md)
