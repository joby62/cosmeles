---
doc_id: mobile-runtime-phase-2-record-v1
title: Mobile Runtime Phase 2 Record v1
doc_type: record
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-24
updated_at: 2026-03-24
completed_at: 2026-03-24
phase: runtime-phase-2 / phase-16
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
related_assignments:
  - /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/
---

# Mobile Runtime Phase 2 Record

## Scope

This record captures `runtime-phase-2 -> phase-16`.

The goal of this round was to freeze object-storage/CDN semantics and the `www / api / assets` wiring surface without prematurely moving into PostgreSQL single truth or the durable job-system phase.

## Governing Inputs

- Runtime freeze:
  - `mobile-runtime-infrastructure-upgrade-plan-v1`
- Architecture baseline:
  - `mobile-architecture-v2`
- Workflow execution:
  - `phase-16/`

## What Landed

### 1. Object-storage contract

- Runtime storage now supports an explicit `object_storage_contract` backend.
- The storage seam now exposes:
  - `public_url`
  - `signed_url`
  - `object_key`
  - private asset prefix classification
  - contract metadata
- Private asset access can now be expressed through a signed-URL contract instead of page-local string assembly.

### 2. Profile-ready env and compose surface

- Split-runtime and multi-node env examples now promote:
  - `STORAGE_BACKEND=object_storage_contract`
  - `ASSET_OBJECT_KEY_PREFIX`
  - `ASSET_SIGNED_URL_TTL_SECONDS`
  - `ASSET_SIGNED_URL_ENFORCED`
  - `ASSET_SIGNING_SECRET`
- Dev and prod compose now carry the same asset-contract variables for both `backend` and `worker`.

### 3. Frontend asset-domain wiring

- Frontend asset resolution now honors:
  - `ASSET_PUBLIC_ORIGIN`
  - `NEXT_PUBLIC_ASSET_BASE`
- `next.config.ts` now keeps two explicit modes:
  - asset-domain mode:
    - only `/api` rewrite stays
    - `/images` and `/user-images` are not proxied through Next
  - fallback mode:
    - local image rewrites stay available when no asset origin exists
- `NEXT_COMPRESS` is now explicitly profile-aware in env examples and build/runtime wiring.

### 4. Verification hardening

- Env/contract tests now assert that split/multi profiles no longer remain on `local_fs`.
- Runtime adapter tests cover object-key and signed-URL behavior.
- Owner validation now confirms:
  - backend full suite green
  - frontend build green
  - frontend TypeScript green
  - single/split/multi compose expansion green

## Verification

- Passed:
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
- Result:
  - backend full suite: `152 passed`
  - frontend TypeScript: green
  - frontend build: green
  - compose expansion: green across all three profiles

## Residual Risks

- This phase froze object-storage semantics and asset-domain wiring, but it did not migrate selection-result online truth yet.
- Single-node still keeps a local fallback profile by design; that is not a phase-16 failure.
- Real cloud-provider rollout remains downstream from the contract and profile work landed here.

## Owner Conclusion

Treat `runtime-phase-2 / phase-16` as complete.

This round is sufficient to move the initiative into `runtime-phase-3 / phase-17`, where the next task is to cut selection-result online truth over to PostgreSQL and remove the remaining dual-source read path.
