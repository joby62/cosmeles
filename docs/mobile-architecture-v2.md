# Mobile Architecture V2

## Goal
- Keep all four capability loops: `choose`, `compare`, `wiki`, `me`.
- Make `choose` the first-priority entry for first-visit users.
- Keep public URL semantics under `/m`.
- Rebuild internal boundaries so the experience shell can change without rewriting the decision kernel.

## Non-Negotiables
- `choose` is primary entry, not the only important capability.
- `compare`, `wiki`, and `me` remain first-class modules in the product loop.
- Frontend and backend must not maintain separate sources of truth for questionnaire semantics.
- Result output must be contract-driven, not renderer-driven.
- Route state and analytics semantics must be centrally owned.

## Product Loop
1. `choose`: capture current intent.
2. `result`: return one answer, three reasons, one next step.
3. `compare`: validate or challenge the answer when the user has candidates.
4. `wiki`: explain ingredients or products when the user needs confidence.
5. `me`: preserve continuity, history, bag, and resume state.

## System Layers
- `shared/mobile/decision/*`
  - Canonical decision catalog, category metadata, question order, labels, durations, route titles, and guardrails.
- `shared/mobile/contracts/*`
  - Canonical route-state, analytics-event, and result-schema contracts.
- `frontend/features/mobile-decision/*`
  - Home, choose, questionnaire, result shell.
- `frontend/features/mobile-utility/*`
  - Wiki, compare, me shell.
- `frontend/domain/mobile/*`
  - Shared routing, progress, analytics, and decision adapters for frontend code.
- `backend/app/domain/mobile/*`
  - Decision resolution, result publishing/loading, and utility-side domain logic.

## Target Repo Layout
```text
shared/mobile/
  decision/
  contracts/

frontend/features/
  mobile-decision/
  mobile-utility/

frontend/domain/mobile/

backend/app/domain/mobile/

backend/tests/mobile/

frontend/legacy/mobile/
```

## Route Policy
- Public path family stays under `/m`.
- Route groups split experience shells into `decision` and `utility`.
- Decision shell owns:
  - `/m`
  - `/m/choose`
  - `/m/[category]/profile`
  - `/m/[category]/result`
- Utility shell owns:
  - `/m/wiki/*`
  - `/m/compare/*`
  - `/m/me/*`

## Contract Policy
- `decision config`
  - One source of truth shared by frontend and backend.
- `selection_result.v3`
  - Fixed shape: one result, three reasons, one next step, secondary loop actions.
- `route_state.v1`
  - Centralized query semantics for `source`, `return_to`, `resume_token`, `scenario_id`, `category`, `result_cta`.
- `analytics_events.v1`
  - Whitelisted event names and required props only.

## Ownership Model
- Architecture owner:
  - Defines contracts, boundaries, migration order, and review gates.
- Worker A:
  - Decision kernel, shared config, contract tests.
- Worker B:
  - Decision shell pages and generic questionnaire flow.
- Worker C:
  - Utility shell, compare/wiki/me routing, and analytics wiring.

## Exit Criteria
- Public `/m` path family preserved.
- Legacy shell can be deleted without breaking the decision kernel.
- Compare/wiki/me remain integrated through result and me flows.
- No page invents new route or analytics semantics ad hoc.
