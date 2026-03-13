# Phase 2 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Rebuild the utility shell so `wiki`, `compare`, and `me` stay strong capabilities without competing with the first-visit decision entry.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/routing/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Constraints:
- Do not break existing deep links for wiki or compare without adapters.
- Utility pages must support return-to-result or return-to-choose flows.
- Do not invent new analytics names or freeform query semantics.
- Do not promote utility modules ahead of choose on first visit.

Deliverables:
- Utility route group and shell layout.
- Return-flow wiring from result -> wiki/compare/me and back.
- `me` resume/recent-result flows aligned with the shared route-state contract.
- Utility analytics aligned with the shared event contract.

Definition of done:
- Wiki/compare/me are isolated from decision-shell chrome.
- Utility capabilities remain reachable and preserve the product loop closure.
- Result and me surfaces can send users back into choose or resume the active category flow without ad hoc query logic.
