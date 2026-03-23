# Phase 9 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Start Condition:
- Read `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json`
- Read `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Objective:
Recheck route-state and source-vocabulary closure after Phase 8, and land only thin cleanup if raw source growth or query drift remains in shared helper ownership.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`

Deliverables:
- Shared helper ownership remains the only place where decision-entry or continuation source values are defined.
- No new page or helper writes route-state query keys outside the frozen contract.
- If cleanup is needed, keep it helper-local and behavior-preserving; hand call-site fallout to Worker C or owner.

Self-review Checklist:
- `rg -n 'sourceFallback:|m_me_|bottom_nav_choose|category_rail_choose|utility_.*reentry|decision_result_restart|choose_start|decision_start' /Users/lijiabo/Documents/New\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\ project/frontend/features/mobile-utility /Users/lijiabo/Documents/New\ project/frontend/domain/mobile/progress`
- `rg -n 'return_to|scenario_id|result_cta|compare_id|from_compare_id' /Users/lijiabo/Documents/New\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\ project/frontend/features/mobile-utility /Users/lijiabo/Documents/New\ project/frontend/domain/mobile/progress`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- A remaining source string or query semantic would require expanding the frozen contracts.
- Eliminating drift would force a route-behavior change instead of a pure semantic cleanup.
- You find evidence that a page is still inventing its own decision-entry href or continuation semantics outside shared helper ownership.
