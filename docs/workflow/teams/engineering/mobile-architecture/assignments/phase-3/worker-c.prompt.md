# Phase 3 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Finish loop closure across `wiki`, `compare`, and `me` so utility surfaces understand result context and can send users back into the right next step.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*` when created
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Constraints:
- `wiki`, `compare`, and `me` remain first-class capabilities, but they do not get promoted ahead of choose on first visit.
- Do not break existing wiki or compare deep links; add adapters where needed.
- Utility pages must consume `return_to`, `scenario_id`, `result_cta`, and `source` consistently.
- Do not invent free-form query keys or event names outside the shared contracts.
- If a utility page cannot honor a return target, it must degrade safely back to `/m/choose`, not dead-end.

Deliverables:
- Utility pages expose clear return actions back to result or choose when context is present.
- `me` aligns with shared resume/recent-result helpers instead of bespoke storage logic.
- Compare/wiki/me preserve deep linking while participating in the decision loop.
- Utility-side analytics wiring uses contract-approved event names and props only.

Definition of done:
- A user can enter wiki/compare/me from a result page and return without losing context.
- `me` acts as memory layer for the decision system, not a disconnected utility island.
- Utility modules no longer carry their own private route semantics.
