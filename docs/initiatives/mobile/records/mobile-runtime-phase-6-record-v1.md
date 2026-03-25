---
doc_id: mobile-runtime-phase-6-record-v1
title: Mobile Runtime Phase 6 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: runtime-phase-6 / phase-20
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/
---

# Mobile Runtime Phase 6 Record

## Scope

This record captures `runtime-phase-6 -> phase-20`.

The goal of this round was to freeze the multi-machine rollout contract, keep the migration order fixed as `worker -> db -> api -> web`, and close the runtime roadmap with profile wiring plus a real split-runtime deploy gate.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-20/`

## What Landed

### 1. Rollout contract freeze

- Rollout truth is now centralized in `runtime_rollout`.
- The migration order is explicitly frozen as:
  - `worker`
  - `db`
  - `api`
  - `web`
- The contract now carries:
  - non-parallel cutover requirement
  - rollback order
  - single-layer rollback rule
  - role ownership / must-not-own boundaries
  - consistency requirements for DB, Redis, and worker execution truth

### 2. Profile and deployment wiring closure

- Worker C aligned frontend profile wiring so `BACKEND_HOST/BACKEND_PORT` no longer hide a single-node fallback.
- The three env skeletons now explicitly encode:
  - rollout step and target step
  - rollback / consistency flags
  - profile-aware backend host and port
- `single_node`, `split_runtime`, and `multi_node` all expand to self-consistent compose/runtime contracts.

### 3. Owner-side deploy blocker fixes

- Real split-runtime `docker compose up` exposed two image-level missing dependencies:
  - `psycopg`
  - `redis`
- These were added to `backend/requirements.txt`, removing the gap between runtime contract and backend image contents.
- After the fix:
  - backend starts against `postgresql+psycopg`
  - Redis-backed lock/cache contracts build successfully
  - `readyz` returns green in split-runtime

### 4. Deploy-gate evidence

- Split-runtime stack now comes up successfully via real `docker compose up -d --build`.
- Runtime health and readiness expose the full phase-20 contract.
- Frontend serves correctly under the profile-aware internal origin.
- Worker runtime still reports:
  - `runtime_role=worker`
  - `worker_runtime_expected=true`
  - `api_routes_enabled=false`

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml up -d --build postgres backend worker frontend`
  - `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml ps`
  - `curl -sS -i http://127.0.0.1:8000/healthz`
  - `curl -sS -i http://127.0.0.1:8000/readyz`
  - `curl -sS -i http://127.0.0.1:5001`
  - `docker exec cosmeles-worker python -c ...`
- Result:
  - backend full suite: `173 passed`
  - frontend TypeScript: green
  - compose expansion: green across all three profiles
  - split-runtime runtime stack: green
  - `healthz`: `200`
  - `readyz`: `200`
  - frontend entry: `200`

## Residual Risks

- Target-environment gray rollout and rollback are still operational actions and should be rehearsed with real traffic controls.
- Those actions no longer block source-repo closure for this roadmap.

## Owner Conclusion

Treat `runtime-phase-6 / phase-20` as complete.

This closes the runtime-phase-0-to-6 roadmap in repository scope. Any further runtime evolution should open a new phase instead of reusing `phase-20`.
