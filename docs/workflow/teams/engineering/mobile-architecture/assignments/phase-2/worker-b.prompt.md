# Phase 2 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Build the decision shell so first-visit users move from `/m` to `choose` to questionnaire with minimal branching.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Constraints:
- Public URLs under `/m` must stay stable.
- `choose` is the first-visit priority, but wiki/compare/me still exist and must remain reachable.
- Do not reintroduce category questionnaire truth inside page files.
- Do not add peer-level first-screen CTAs for compare/wiki/me on the new homepage.

Deliverables:
- Decision route group and shell layout.
- Rebuilt `/m` homepage using the decision-first IA.
- Rebuilt `/m/choose` with resume card plus five category cards only.
- Decision-shell event wiring aligned with the analytics contract.

Definition of done:
- The first screen has one dominant action: start the decision flow.
- `choose` only solves resume and category selection.
- Questionnaire and result entry points use shared config and route-state helpers.
- No legacy bottom-nav semantics leak into the decision shell.
