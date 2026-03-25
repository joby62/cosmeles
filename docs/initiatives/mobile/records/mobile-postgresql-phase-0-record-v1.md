---
doc_id: mobile-postgresql-phase-0-record-v1
title: Mobile PostgreSQL Phase 0 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: postgresql-phase-0 / phase-21
related_docs:
  - mobile-postgresql-full-migration-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/
---

# Mobile PostgreSQL Phase 0 Record

## Scope

This record captures `postgresql-phase-0 / phase-21`.

The goal of this round was not to cut production over to PostgreSQL by default.
The goal was to freeze the remaining SQLite structured truth surface, freeze the migration groups, freeze the engine/session/init/default contract, and freeze the adoption impact inventory needed for the first real cutover round.

## Governing Inputs

- PostgreSQL migration truth:
  - `mobile-postgresql-full-migration-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-21/`

## What Landed

### 1. Remaining SQLite structured truth inventory

- Phase-21 froze the remaining structured tables still following the active default database path.
- The frozen surface excludes `mobile_selection_result_index`, which remains a PostgreSQL payload single-truth path.
- The frozen remaining structured surface is now explicitly grouped into:
  - product workbench / backend jobs
  - mobile session / history / bag / events / user assets

### 2. Engine / session / init / default contract

- `backend/app/db/session.py` now exposes the default-database contract separately from the active-engine contract.
- `backend/app/db/init_db.py` now exposes the init/bootstrap contract, including the current `create_all(bind=active_engine)` behavior and the fixed schema patcher scope.
- `backend/app/platform/runtime_profile.py` now exposes a single `postgresql_migration_contract` block for owner and worker review.

### 3. Acceptance freeze

- Tests now freeze:
  - profile parity between single-node SQLite and split/multi PostgreSQL defaults
  - clean-start rollout consistency
  - invalid rollout-step fallback
  - startup bootstrap boundary for `should_initialize_runtime_schema`

### 4. Adoption inventory

- Phase-21 also froze the deployment/profile/config/frontend adoption surface that phase-22 must touch when PostgreSQL becomes the production default.
- No production default was switched in this round.

## Verification

- Passed:
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
- Result:
  - targeted verification: `34 passed`
  - full backend suite: `177 passed`

## Residual Risks

- Production default is still not PostgreSQL in this round.
- `single_node` still requires an explicit owner decision in phase-22: whether it also moves to PostgreSQL production default or remains a special profile.
- SQLite downgrade semantics are still present; phase-22 must demote them to dev/emergency-only production behavior.

## Owner Conclusion

Treat `postgresql-phase-0 / phase-21` as inventory-and-freeze complete.

This phase successfully turned the PostgreSQL full-migration effort into a governed, executable route with frozen truth boundaries and acceptance.
The next execution step is `postgresql-phase-1 / phase-22`, which will perform the first real cutover of the production default database contract.
