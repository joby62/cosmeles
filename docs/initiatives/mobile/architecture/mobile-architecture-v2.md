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
updated_at: 2026-03-25
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

## Runtime Baseline Reference
- As of `2026-03-24`, the live runtime baseline from `runtime-phase-1 / phase-15` is a single-node modular topology:
  - `web`
  - `api`
  - `worker`
  - `postgres`
- `api` owns HTTP / SSE serving.
- `worker` owns background polling / execution and must not mount API routes.
- As of `runtime-phase-2 / phase-16`, split-runtime and multi-node profiles now promote asset delivery through the object-storage contract plus asset-domain wiring; `single_node` keeps a low-cost local fallback profile.
- As of `runtime-phase-3 / phase-17`, selection-result online truth is frozen as PostgreSQL payload; artifact files remain publish/archive copies only and are no longer valid online read fallback.
- As of `runtime-phase-4 / phase-18`, compare / upload / result-build execution truth is frozen behind job records plus worker execution; runtime profile and queue contract now expose product-workbench dispatch alongside compare and upload.
- As of `runtime-phase-5 / phase-19`, external PostgreSQL / Redis capability boundaries are frozen: database remains the only structured truth, Redis is limited to lock/cache semantics, and profile switching now keeps `single_node` fallback while allowing `split_runtime / multi_node` to switch by config only.
- As of `runtime-phase-6 / phase-20`, rollout order is frozen as `worker -> db -> api -> web`; split-runtime deploy gate is green with healthy backend/worker/postgres plus `healthz/readyz`, and frontend profile wiring no longer hides single-node host assumptions.
- Object storage, CDN, and `www / api / assets` separation remain governed by `mobile-runtime-infrastructure-upgrade-plan-v1`, not by page-local rewrites.

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
