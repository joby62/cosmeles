# Phase 1 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Preserve the product loop closure across `wiki`, `compare`, and `me` while isolating them from the decision shell chrome.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/wiki/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/compare/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/me/*`
- Utility-side route-state and analytics integration

Constraints:
- `wiki`, `compare`, and `me` remain first-class capabilities.
- They should support the decision loop, not compete with choose on first visit.
- Do not invent event names outside `analytics_events.json`.
- Do not break compare/wiki deep links without an adapter path.
- Utility pages must support return-to-result or return-to-choose flows where appropriate.

Deliverables:
- Utility shell boundaries and routing integration.
- Return-flow adapters from result to wiki/compare/me and back.
- Analytics wiring using the shared event contract.

Definition of done:
- Utility flows stay reachable and useful without polluting decision-first entry surfaces.
- Compare/wiki/me can participate in loop closure from result and me history.
- No utility module depends on decision-shell-only chrome.
