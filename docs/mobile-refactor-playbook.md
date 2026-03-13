# Mobile Refactor Playbook

## Phase 0
- Freeze the old implementation in `codex/mobile-v1-baseline`.
- Run architecture work in `codex/mobile-arch-v2`.
- Do not add new mobile feature work to legacy modules.
- Build contracts before UI replacement.

## Phase 1 Deliverables
- Shared decision catalog scaffold.
- Shared result, route-state, and analytics contracts.
- Domain folder skeletons for frontend and backend.
- Review gates for worker branches.
- Worker assignments must be issued as prompt files under `docs/prompts/mobile/`.

## Phase 1 Exit Criteria
- Shared decision files exist for all five categories.
- Frontend questionnaire copy for all five categories reads from shared config.
- Backend selection matrices for all five categories read from shared config.
- Contract and loader tests cover the catalog plus per-category config loading.

## Phase 2 Deliverables
- Backend mobile selection routes split out of the monolithic router.
- Decision shell route group plus rebuilt `/m` and `/m/choose`.
- Utility shell route group plus loop-closure routing for wiki/compare/me.
- Event wiring aligned to the shared analytics contract.

## Phase 3 Deliverables
- Decision result flow hardened around the fixed result-page shape and contract boundary.
- Backend reporting and ingestion migrated to `result_*` decision-result events.
- Shared questionnaire/resolve/result helpers remove per-category page duplication.
- Utility pages consume `return_to`, `scenario_id`, `result_cta`, and `source` consistently.
- `me` becomes the shared memory layer for resume and recent-result continuation.

## Worker Prompt A
```text
You are responsible for the decision kernel and shared contracts.

Scope:
- shared/mobile/decision/*
- shared/mobile/contracts/*
- backend/app/domain/mobile/decision/*
- backend/tests/mobile/*

Rules:
- Do not change public API paths.
- Do not edit legacy page components.
- Do not add a second source of truth for question titles, labels, or route titles.
- Prefer machine-readable config and contract fixtures over prose comments.

Definition of done:
- Shared decision files exist for all five categories.
- Backend can load config from shared/mobile/decision.
- Parity tests prove current answers still resolve to the same route as before.
- selection_result.v3 contract test exists.
```

## Worker Prompt B
```text
You are responsible for the decision shell.

Scope:
- frontend/features/mobile-decision/*
- frontend/domain/mobile/*
- frontend/app/m decision-shell route groups when enabled

Rules:
- Choose is the primary first-visit entry.
- Do not surface compare/wiki/me as peer-level first-screen CTAs.
- Do not hardcode category questionnaire truth in page files.
- Use route_state contract instead of local ad hoc query params.

Definition of done:
- New /m shell is minimal and decision-first.
- New /m/choose only solves category selection and resume.
- Questionnaire flow reads shared config.
- Result page renderer follows selection_result.v3.
```

## Worker Prompt C
```text
You are responsible for the utility shell and loop closure.

Scope:
- frontend/features/mobile-utility/*
- compare/wiki/me route integration
- analytics and route-state wiring between result and utility modules

Rules:
- Compare/wiki/me stay important, but do not compete with choose on first visit.
- Utility pages must be reachable from result and me flows.
- Do not invent new analytics names outside shared/mobile/contracts/analytics_events.json.
- Do not break existing compare or wiki deep-linking semantics without adding adapters.

Definition of done:
- Utility shell is isolated from decision shell chrome.
- Compare/wiki/me all support return-to-result or return-to-choose flows.
- Event wiring uses contract names and required props only.
```

## Phase 2 Prompt Files
- `docs/prompts/mobile/phase2-worker-a.prompt.md`
- `docs/prompts/mobile/phase2-worker-b.prompt.md`
- `docs/prompts/mobile/phase2-worker-c.prompt.md`

## Phase 3 Prompt Files
- `docs/prompts/mobile/phase3-worker-a.prompt.md`
- `docs/prompts/mobile/phase3-worker-b.prompt.md`
- `docs/prompts/mobile/phase3-worker-c.prompt.md`

## Review Gates
- No duplicate questionnaire truth across frontend and backend.
- No worker branch edits legacy and new modules for the same concern unless explicitly approved.
- No public route break under `/m`.
- No new page-level freeform analytics events.
- No new result renderer escape hatches beyond `selection_result.v3`.
- Any change touching route semantics must update `shared/mobile/contracts/route_state.json`.
- Any change touching result semantics must update `shared/mobile/contracts/selection_result.v3.json`.
- No worker may add a second decision-result event vocabulary beside `result_*`.
- Utility pages must tolerate missing or stale route-state context and fall back safely.
- Category page wrappers should shrink over time; repeated flow logic in page files is a regression.

## Merge Order
1. Worker A contracts and parity tests.
2. Architecture owner review and contract freeze.
3. Worker B decision shell work.
4. Worker C utility shell and routing integration.
5. Architecture owner cutover review.
6. Legacy deletion only after contract and shell migration both pass.

## Phase 3 Merge Order
1. Worker A decision-result contract and analytics migration.
2. Architecture owner review and contract freeze.
3. Worker B shared questionnaire/resolve/result infrastructure.
4. Worker C utility return-flow and me memory-layer integration.
5. Architecture owner integration review across result -> utility -> return path.
6. Only after that: delete obsolete adapters and analytics aliases.
