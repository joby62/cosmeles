---
doc_id: mobile-runtime-phase-5-record-v1
title: Mobile Runtime Phase 5 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: runtime-phase-5 / phase-19
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/
---

# Mobile Runtime Phase 5 Record

## Scope

This record captures `runtime-phase-5 -> phase-19`.

The goal of this round was to freeze external PostgreSQL / Redis capability boundaries without reopening runtime truth: database remains the only structured truth, Redis is limited to lock/cache semantics, and profile switching must work by configuration.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-19/`

## What Landed

### 1. Database capability boundary

- Runtime settings now treat `selection_result_repository_backend=postgres_payload` as the live default.
- Database engine construction exposes:
  - configured driver
  - active driver
  - pool sizing / overflow / timeout / recycle / pre-ping
  - downgrade-to-sqlite behavior
- External PostgreSQL can now be activated by configuration rather than business-layer rewrites.

### 2. Redis lock/cache boundary

- Lock backend now supports `redis_contract` while preserving `local` fallback semantics.
- Cache backend now supports `redis_contract` while preserving `none` or local-memory downgrade semantics.
- Redis remains explicitly bounded to:
  - distributed locks
  - cache TTL behavior
- Redis is not accepted as structured truth storage.

### 3. Profile and compose alignment

- `.env.single-node.example` preserves low-cost local compatibility.
- `.env.split-runtime.example` and `.env.multi-node.example` now expand to:
  - `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`
  - `LOCK_BACKEND=redis_contract`
  - `CACHE_BACKEND=redis_contract`
  - PostgreSQL-backed `DATABASE_URL`
- dev/prod compose now surface the same capability contract for API and worker roles.

### 4. Observability and acceptance

- Runtime profile now exposes database, lock, and cache contracts together with pool and downgrade metadata.
- Acceptance coverage now treats:
  - lock behavior
  - cache behavior
  - pool semantics
  - downgrade behavior
  - single-node compatibility
  as part of the same phase-19 gate.
- Frontend/runtime profile wiring confirms config-switch behavior does not silently fall back to hardcoded single-node origins.

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py`
- Result:
  - backend full suite: `166 passed`
  - targeted runtime contract suites: `23 passed`
  - frontend TypeScript: green
  - frontend build: green
  - compose expansion: green across all three profiles

## Residual Risks

- This phase proves capability boundaries and config-switch semantics, not real external service connectivity under production traffic.
- Split-runtime and multi-node still need live environment rehearsal with actual external PostgreSQL / Redis availability.
- Multi-machine rollout ordering and rollback strategy remain phase-20 work.

## Owner Conclusion

Treat `runtime-phase-5 / phase-19` as complete.

This round is sufficient to move the initiative into `runtime-phase-6 / phase-20`, where the remaining roadmap task is to execute the multi-machine rollout plan in the fixed order `worker -> db -> api -> web`.
