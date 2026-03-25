---
doc_id: mobile-postgresql-phase-2-record-v1
title: Mobile PostgreSQL Phase 2 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: postgresql-phase-2 / phase-23
related_docs:
  - mobile-postgresql-full-migration-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/
---

# Mobile PostgreSQL Phase 2 Record

## Scope

This record captures `postgresql-phase-2 / phase-23`.

The goal of this round was the first real high-concurrency table-group migration:
freeze and enforce PostgreSQL-only online truth for the product/workbench/backend-job/AI/index table group,
make the boundary observable in runtime contracts,
and close acceptance plus call-site adoption without yet moving the phase-24 mobile state tables.

## Governing Inputs

- PostgreSQL migration truth:
  - `mobile-postgresql-full-migration-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-23/`

## What Landed

### 1. Phase-23 PG-only truth boundary

- The phase-23 table group is now frozen as the PostgreSQL-only online truth boundary:
  - `products`
  - `ingredient_library_index`
  - `ingredient_library_alias_index`
  - `ingredient_library_redirects`
  - `ingredient_library_build_jobs`
  - `upload_ingest_jobs`
  - `product_workbench_jobs`
  - `ai_jobs`
  - `ai_runs`
  - `product_route_mapping_index`
  - `product_analysis_index`
  - `product_featured_slots`
- `backend/app/db/session.py` now exposes:
  - `describe_phase_23_pg_only_truth_contract()`
  - `assert_phase_23_pg_only_truth_contract()`

### 2. Runtime and startup enforcement

- `backend/app/main.py` now enforces the phase-23 PG-only truth contract during startup and `readyz` for production profiles.
- `backend/app/platform/runtime_profile.py` now exposes:
  - `postgresql_migration_contract.phase = postgresql-phase-2`
  - `phase_23_pg_only_truth_contract`
  - `next_phase_locked = postgresql-phase-3`
- `backend/app/db/init_db.py` and `backend/app/db/models.py` now expose the phase-23 boundary and keep phase-24 mobile-state tables explicitly locked for the next round.

### 3. Acceptance closure

- `backend/tests/test_postgresql_phase23_acceptance_baseline.py` freezes:
  - phase-23/phase-24 table-group separation
  - PG-only truth boundary
  - runtime profile visibility for the phase-23 gate
- Existing backend tests continue to cover:
  - startup/readiness
  - bootstrap/backfill/replay idempotence
  - worker/api parity and consistency
  - empty-state / clean-start behavior

### 4. Adoption closure

- Frontend/admin/workbench/upload call sites remain routed through shared `/api/*` callers.
- No phase-23-scope page-local database assumption or `sqlite/app.db` hardcoding was found in the allowed adoption scope.
- This round closed adoption by confirming zero-diff consistency rather than inventing cleanup for appearance.

## Verification

- Passed:
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_postgresql_phase23_acceptance_baseline.py backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- Result:
  - targeted phase-23 + runtime verification: `37 passed, 2 warnings`
  - full backend suite: `180 passed, 2 warnings`

## Residual Risks

- Phase-24 mobile state tables still remain on the next migration leg:
  - `mobile_selection_sessions`
  - `mobile_compare_session_index`
  - `mobile_compare_usage_stats`
  - `mobile_bag_items`
  - `mobile_client_events`
  - `user_upload_assets`
  - `user_products`
- SQLite fallback still exists by design for `single_node`; phase-25 will close the final dev/emergency-only semantics and docs/tests/ops cleanup.

## Owner Conclusion

Treat `postgresql-phase-2 / phase-23` as high-concurrency table-group migration closure complete.

This phase successfully moved the repo from
"PostgreSQL is production-default, but key backend/product/workbench/job tables still sit on the next unresolved leg"
to
"the first backend/product/workbench/job/AI/index table group is now frozen behind PostgreSQL-only online truth."

The next execution step is `postgresql-phase-3 / phase-24`,
which migrates the mobile state table group.
