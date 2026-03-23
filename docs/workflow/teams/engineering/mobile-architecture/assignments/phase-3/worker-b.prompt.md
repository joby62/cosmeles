# Phase 3 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Remove duplicated decision-flow page logic by turning questionnaire, resolve, and result entry into shared decision-shell infrastructure.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*` when created
- `/Users/lijiabo/Documents/New project/shared/mobile/decision/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Constraints:
- Public URLs under `/m/<category>/profile|resolve|result` must remain stable.
- Do not put questionnaire truth back into page files.
- Do not fork five slightly different versions of the same flow helpers.
- Preserve current answer validation semantics unless a shared contract explicitly changes them.
- Result entry must keep the new fixed renderer shape: one result, three reasons, one next step.

Deliverables:
- Generic questionnaire renderer driven by shared category config.
- Shared decision resolve helper for answer normalization and result redirect.
- Shared result-page loader/helper so category pages stop duplicating fetch/redirect/error boilerplate.
- Category page files become thin adapters, not flow owners.

Definition of done:
- Category-specific pages are mostly declarative wrappers around shared decision-shell infrastructure.
- Questionnaire/resume/result semantics are owned centrally.
- No new ad hoc query parsing or analytics wiring appears in category page files.
