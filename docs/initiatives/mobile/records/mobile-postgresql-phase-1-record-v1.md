---
doc_id: mobile-postgresql-phase-1-record-v1
title: Mobile PostgreSQL Phase 1 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: postgresql-phase-1 / phase-22
related_docs:
  - mobile-postgresql-full-migration-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-22/
---

# Mobile PostgreSQL Phase 1 Record

## Scope

This record captures `postgresql-phase-1 / phase-22`.

The goal of this round was the first real PostgreSQL default cutover:
make PostgreSQL the production-default structured-truth driver,
demote SQLite downgrade semantics in production,
and close the engine/session/init/profile adoption contract without yet migrating the phase-23 or phase-24 table groups.

## Governing Inputs

- PostgreSQL migration truth:
  - `mobile-postgresql-full-migration-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-22/`

## What Landed

### 1. Production-default database contract

- `settings.database_url` is now allowed to stay empty and resolve by deploy profile instead of forcing `app.db` as the universal default.
- Production profiles are now explicitly:
  - `split_runtime`
  - `multi_node`
- Those profiles default to PostgreSQL DSNs and PostgreSQL pool semantics.
- `single_node` is now explicitly documented and enforced as:
  - `dev_or_emergency_fallback`

### 2. Downgrade demotion

- `DB_DOWNGRADE_TO_SQLITE_ON_ERROR` no longer defaults to enabled in production profiles.
- Production only re-enables SQLite downgrade when explicitly overridden by environment.
- Boot-time downgrade facts and runtime-effective downgrade policy are now both observable through runtime profile.

### 3. Session / active engine / init bootstrap contract

- `SessionLocal` remains bound to a single active engine.
- Active engine resolution is now explicit:
  1. explicit `DATABASE_URL`
  2. production profile default PostgreSQL DSN
  3. `single_node` SQLite fallback
- `init_db` remains bound to the active engine and now exposes the bootstrap contract through runtime profile instead of leaving it implicit in startup behavior.

### 4. Runtime/profile/frontend adoption

- `docker-compose.dev.yml` and `docker-compose.prod.yml` now default backend/worker to PostgreSQL-first semantics.
- Production compose defaults now align with `split_runtime`, not legacy single-node assumptions.
- `.env.split-runtime.example` and `.env.multi-node.example` stay PostgreSQL-first with downgrade disabled by default.
- `.env.single-node.example` stays SQLite-based and is clearly labeled as fallback-only.
- Frontend server-side API origin resolution no longer falls back to `http://nginx`; it now resolves from:
  - `INTERNAL_API_BASE`
  - `API_INTERNAL_ORIGIN`
  - `BACKEND_HOST/BACKEND_PORT`

## Verification

- Passed:
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
- Result:
  - targeted runtime verification: `34 passed, 2 warnings`
  - full backend suite: `177 passed, 2 warnings`

## Residual Risks

- Phase-23 high-concurrency backend/product/job/AI table groups are still not migrated off the default SQLite-backed path.
- Phase-24 mobile session/history/bag/events tables are still not migrated.
- `single_node` fallback remains available by design and must not be mistaken for a production-default profile.
- Local command examples should prefer `conda run -n cosmeles python -m pytest` over `python3 -m pytest` inside this environment, otherwise interpreter mapping may hide the intended env.

## Owner Conclusion

Treat `postgresql-phase-1 / phase-22` as production-default contract closure complete.

This phase successfully moved the repo from
"PostgreSQL is only a partial truth for selected flows"
to
"PostgreSQL is the production-default structured-truth driver for production profiles."

The next execution step is `postgresql-phase-2 / phase-23`,
which migrates the high-concurrency backend/product/job/AI table group to PostgreSQL single truth.
