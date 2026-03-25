---
doc_id: mobile-runtime-phase-4-record-v1
title: Mobile Runtime Phase 4 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: runtime-phase-4 / phase-18
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/
---

# Mobile Runtime Phase 4 Record

## Scope

This record captures `runtime-phase-4 -> phase-18`.

The goal of this round was to move compare, upload, and result-build/product-workbench execution onto a shared `job + worker` runtime truth, so API only creates jobs and worker/runtime queue owns execution.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-18/`

## What Landed

### 1. Shared job + worker execution truth

- Compare session execution now persists job payload / execution metadata in DB and exposes an SSE status read model.
- Upload ingest remains on job records and runtime worker polling in split/multi profiles.
- Product workbench / `selection_result_build` now uses runtime queue dispatch instead of API-process `ThreadPoolExecutor`.
- Runtime worker daemon now covers:
  - `upload_ingest`
  - `mobile_compare`
  - `product_workbench`

### 2. Queue and topology contract expansion

- Runtime task queue now supports `submit_product_workbench_job`.
- Runtime topology now exposes product-workbench dispatch mode alongside compare and upload.
- Runtime profile / health observability now describe the expanded queue/worker capabilities.

### 3. Product workbench worker integration

- `products.py` now gates inline dispatch through runtime topology instead of a dedicated executor.
- `run_product_workbench_worker_once()` allows worker runtime to pull queued workbench jobs from DB.
- `selection_result_build` no longer requires API-local executor threads to run.

### 4. Acceptance hardening

- Targeted job tests now cover:
  - compare job session / SSE lifecycle
  - upload retry / resume / orphan handling
  - product workbench / selection-result-build queued/running/failed/retry/orphan reconciliation
- Owner validation confirms backend, frontend, and compose surfaces remain green.

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_compare.py backend/tests/test_upload_jobs.py backend/tests/test_product_workbench_jobs.py backend/tests/test_ingredient_library_jobs.py`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
- Result:
  - backend full suite: `162 passed`
  - targeted job suites: `39 passed`
  - frontend TypeScript: green
  - frontend build: green
  - compose expansion: green across all three profiles

## Residual Risks

- This phase freezes the `job + worker` execution truth, but it does not yet externalize PostgreSQL or introduce Redis lock/cache boundaries.
- Single-node keeps local inline fallback modes by design; phase-19 is where external capability boundaries become the focus.
- Multi-machine rollout remains downstream from phase-19.

## Owner Conclusion

Treat `runtime-phase-4 / phase-18` as complete.

This round is sufficient to move the initiative into `runtime-phase-5 / phase-19`, where the next task is to freeze external PostgreSQL / Redis boundaries, lock/cache adapter semantics, and single-node compatibility.
