---
doc_id: mobile-runtime-phase-0-record-v1
title: Mobile Runtime Phase 0 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-24
updated_at: 2026-03-24
completed_at: 2026-03-24
phase: runtime-phase-0 / phase-14
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/
---

# Mobile Runtime Phase 0 Record

## Scope

This record captures the first runtime-infrastructure execution round mapped as `runtime-phase-0 -> phase-14`.

The goal of this round was not to cut over PostgreSQL, object storage, or real worker infrastructure.
The goal was to extract seams so later phases can switch implementations without rewriting business paths.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-14/`

## What Landed

### 1. Backend runtime seam

- Added `backend/app/platform/` as the runtime seam layer for:
  - storage backend
  - selection-result repository
  - task queue
  - lock backend
  - runtime profile reporting
- Moved `selection result` publish/load to the repository seam instead of writing and reading the file layer directly inside the domain flow.
- Moved mobile compare stream dispatch and upload job dispatch behind the queue seam instead of letting the routes decide the execution primitive directly.
- Moved mobile / ingest file JSON and byte reads to the storage seam where phase-14 scope touched them directly.

### 2. Env and profile skeleton

- Added:
  - `.env.single-node.example`
  - `.env.split-runtime.example`
  - `.env.multi-node.example`
- Extended backend and compose env surface so later phases can switch:
  - `DEPLOY_PROFILE`
  - `RUNTIME_ROLE`
  - `STORAGE_BACKEND`
  - `SELECTION_RESULT_REPOSITORY_BACKEND`
  - `QUEUE_BACKEND`
  - `LOCK_BACKEND`
  - `API_PUBLIC_ORIGIN`
  - `API_INTERNAL_ORIGIN`
  - `ASSET_PUBLIC_ORIGIN`
  - `COOKIE_DOMAIN`

### 3. Health and acceptance skeleton

- Extended `healthz / readyz` so they expose current runtime profile and active backend seams.
- Added runtime adapter contract tests covering:
  - storage round-trip
  - selection-result repository persistence
  - local queue execution
  - runtime profile reporting
  - `healthz / readyz` contract consistency and env skeleton self-checks

### 4. Frontend/runtime wiring

- Made frontend API origin and asset origin profile-aware.
- Kept current same-origin / rewrite behavior as the default fallback when no asset origin is configured.
- Prepared Next build/runtime env handling so later phases can move `api` and `assets` without reworking every caller.
- Fixed `prod compose` frontend runtime `INTERNAL_API_BASE` so it follows the active profile at runtime instead of only at build time.

## Verification

- Passed:
  - `python3 -m py_compile ...` on touched backend files
  - `cd frontend && npx tsc --noEmit`
  - `cd frontend && npm run build`
  - `docker compose config` for default env and all three runtime env skeletons
  - application-level smoke for `healthz / readyz`
  - targeted backend runtime/mobile regression set:
    - `test_mobile_compare.py`
    - `test_upload_jobs.py`
    - `test_upload_pipeline.py`
    - `test_mobile_selection.py`
    - `test_runtime_health_contract.py`
    - `mobile/test_selection_result_contracts.py`
    - `test_runtime_platform_adapters.py`
- Result:
  - targeted regression set: `61 passed`
  - full backend suite: `147 passed`

## Residual Risks

- Real deploy gate is no longer pending for phase-14:
  - owner completed `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`
  - owner completed host-level `healthz / readyz / frontend` smoke
  - no real `web/api/worker/postgres` split has been exercised yet; this now moves to phase-15 scope
- Asset delivery is only profile-aware at the wiring layer in phase-0:
  - actual object storage / CDN cutover remains phase-2 work

## Owner Conclusion

Treat `runtime-phase-0 / phase-14` as branch-integration complete, code-verification complete, and deploy-gate complete.

This phase successfully extracted the first runtime seams and verification skeleton without prematurely cutting over storage, database, queue, or product behavior.
The next execution step is `runtime-phase-1 / phase-15`.
That next step is the single-node modularization of `web / api / worker / postgres`.
