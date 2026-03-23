# Phase 10 Worker B Prompt

You are Worker B on the mobile result-intent routing rollout.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Objective:
- Act as the truth owner for result-intent route semantics, `result_cta` propagation, and result-to-utility return behavior.
- Freeze helper behavior before any result-page or home-surface adoption work begins.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/flowReturn.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/resultCtaAttribution.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`

Deliverables:
- Remove the current behavior that treats `return_to` on the decision result page as an automatic redirect away from the result view.
- Freeze helper semantics for `result_cta` with the owner-approved vocabulary:
  - `bag_add`
  - `compare`
  - `rationale`
  - `retry_same_category`
  - `switch_category`
- Preserve `source`, `return_to`, `scenario_id`, and `compare_id` semantics across result-to-utility hops without page-local query assembly drift.
- Hand Worker C a stable helper truth to adopt.

Self-review Checklist:
- `rg -n 'return_to|result_cta|compare_id|scenario_id|from_compare_id' /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-utility /Users/lijiabo/Documents/New\\ project/frontend/domain/mobile/progress /Users/lijiabo/Documents/New\\ project/frontend/lib/mobile`
- `rg -n 'redirect\\(returnTo\\)|decision_result_restart|utility_compare_reentry|utility_wiki_reentry' /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\\ project/frontend/lib/mobile`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- Fixing the route semantics would require expanding query keys beyond the frozen route-state contract.
- The PRD implies a return behavior that conflicts with the decision-first home and choose policy.
- A helper-layer fix would still leave two competing route-state truths alive.
