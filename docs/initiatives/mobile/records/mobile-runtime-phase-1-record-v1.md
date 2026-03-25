---
doc_id: mobile-runtime-phase-1-record-v1
title: Mobile Runtime Phase 1 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-24
updated_at: 2026-03-24
completed_at: 2026-03-24
phase: runtime-phase-1 / phase-15
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/
---

# Mobile Runtime Phase 1 Record

## Scope

This record captures the `runtime-phase-1 -> phase-15` execution round.

The goal of this round was to turn the single-node runtime into an explicit `web / api / worker / postgres` topology.
It was not the round for object storage, CDN, PostgreSQL single truth for selection result, or a full job-system cutover.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-15/`

## What Landed

### 1. Single-node four-module topology

- `docker-compose.dev.yml` and `docker-compose.prod.yml` now expose:
  - `frontend` / `frontend-dev`
  - `backend` / `backend-dev`
  - `worker` / `worker-dev`
  - `postgres` / `postgres-dev`
- The runtime now has an explicit process role split instead of treating one backend container as the carrier for every responsibility.

### 2. API / worker process split

- Added runtime-topology helpers so the backend process can tell whether it is running as:
  - `api`
  - `worker`
- API routes and static mounts now only load in `api` role.
- Worker startup now launches a dedicated poller daemon for upload-ingest work instead of piggybacking on the API-serving role.

### 3. Health, env, and profile adaptation

- The compose stacks now pass:
  - `DEPLOY_PROFILE`
  - `RUNTIME_ROLE`
  - `DATABASE_URL`
  - related runtime env required for modular single-node boot
- `healthz / readyz` continue to expose the runtime profile and are now exercised against the split single-node topology.
- The runtime examples remain expandable for:
  - `single_node`
  - `split_runtime`
  - `multi_node`

### 4. Smoke path closure

- Real prod-compose smoke now covers:
  - container boot for `postgres / backend / worker / frontend`
  - backend `healthz`
  - backend `readyz`
  - frontend entry page
  - compare SSE stream path
- Worker role verification confirmed that the worker container reports:
  - `runtime_role=worker`
  - `worker_runtime_expected=true`
  - `api_routes_enabled=false`

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml config`
  - real single-node modular smoke with `postgres backend worker frontend`
- Result:
  - backend full suite: `150 passed`
  - frontend build: green
  - frontend TypeScript: green
  - compose expansion: green
  - runtime smoke: green

## Residual Risks

- Images, user uploads, and public artifacts still use local file truth:
  - this is phase-16 scope, not a phase-15 failure
- `selection result` online truth is still not PostgreSQL payload direct-read:
  - this remains phase-17 scope
- compare / upload / result build are not yet fully on a durable job system:
  - phase-15 only split runtime roles and process boundaries

## Owner Conclusion

Treat `runtime-phase-1 / phase-15` as complete.

This round delivered the first true single-node modular runtime:
`web / api / worker / postgres`.
That is enough to move the initiative into `runtime-phase-2 / phase-16`, where the next task is object storage, CDN, and `www / api / assets` flow separation.
