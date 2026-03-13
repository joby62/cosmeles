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

## Review Gates
- No duplicate questionnaire truth across frontend and backend.
- No worker branch edits legacy and new modules for the same concern unless explicitly approved.
- No public route break under `/m`.
- No new page-level freeform analytics events.
- No new result renderer escape hatches beyond `selection_result.v3`.
- Any change touching route semantics must update `shared/mobile/contracts/route_state.json`.
- Any change touching result semantics must update `shared/mobile/contracts/selection_result.v3.json`.

## Merge Order
1. Worker A contracts and parity tests.
2. Architecture owner review and contract freeze.
3. Worker B decision shell work.
4. Worker C utility shell and routing integration.
5. Architecture owner cutover review.
6. Legacy deletion only after contract and shell migration both pass.
