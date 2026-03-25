---
doc_id: mobile-runtime-phase-3-record-v1
title: Mobile Runtime Phase 3 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
phase: runtime-phase-3 / phase-17
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/
---

# Mobile Runtime Phase 3 Record

## Scope

This record captures `runtime-phase-3 -> phase-17`.

The goal of this round was to cut selection-result online truth over from `DB index -> local file` to PostgreSQL payload, align deploy/health observability to that truth, and keep artifact files only as publish/archive copies.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-17/`

## What Landed

### 1. PostgreSQL payload single truth

- Selection-result online reads now come from PostgreSQL payload columns on `mobile_selection_result_index`.
- The phase-17 payload model is now explicit:
  - `published_payload_json`
  - `fixed_contract_json`
  - `artifact_manifest_json`
  - `payload_backend`
- `SELECTION_RESULT_PAYLOAD_MISSING` is now the strict failure when the row exists but online payload truth is absent.

### 2. Artifact-copy-only contract

- Artifact files still get written for publish/archive purposes.
- Artifact files are no longer accepted as online read fallback.
- The repository/runtime contract now explicitly reports:
  - `online_truth=postgres_payload`
  - `artifact_copy_only=true`
  - `online_read_from_artifact=false`

### 3. Profile and observability alignment

- Env examples now freeze `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`.
- Dev and prod compose now expand the same phase-17 live contract.
- Runtime profile / healthz / readyz now expose:
  - selection-result payload model
  - selection-result contract
  - payload backend truth

### 4. Acceptance hardening

- Targeted acceptance now covers:
  - PG payload online reads even when artifact files are removed
  - strict `SELECTION_RESULT_PAYLOAD_MISSING`
  - repository refusal to perform online artifact read fallback
- Owner validation confirms backend, frontend, and compose surfaces are all green against the new contract.

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
- Result:
  - backend full suite: `159 passed`
  - frontend TypeScript: green
  - frontend build: green
  - compose expansion: green across all three profiles

## Residual Risks

- This phase freezes selection-result PostgreSQL single truth; it does not yet convert compare / upload / result build to durable job execution.
- API-thread execution still exists for long-running work until `runtime-phase-4 / phase-18`.
- Redis, external cache, and multi-machine rollout remain downstream phases.

## Owner Conclusion

Treat `runtime-phase-3 / phase-17` as complete.

This round is sufficient to move the initiative into `runtime-phase-4 / phase-18`, where the next task is to freeze the job model, worker execution truth, and SSE status read model for compare / upload / result build.
