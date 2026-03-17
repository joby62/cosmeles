# Phase 8 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Start condition:
- Begin after Worker B lands the frozen source constants/helper ownership.

Objective:
Retrofit utility and me/history/bag call sites onto the frozen decision-entry/continuation source helper.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/docs/mobile-utility-adapter-audit.md`

Constraints:
- Do not change public `/m` paths.
- Preserve existing `return_to`, `result_cta`, `scenario_id`, and `compare_id` semantics.
- Do not invent new source labels at call sites.
- Keep the task focused on call-site adoption, not helper redesign.

Deliverables:
- Utility and me/history/bag call sites stop passing raw source strings once the shared helper exists.
- Audit notes explicitly call out any intentional source exceptions that remain.
- Decision re-entry semantics stay behaviorally identical while source labels become centrally governed.

Self-review checklist:
- `rg -n 'sourceFallback:|m_me_|utility_.*reentry|bottom_nav_choose|category_rail_choose|choose_start' frontend/app/m/'(utility)' frontend/components/mobile docs/mobile-utility-adapter-audit.md`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`

Escalate to architecture owner if:
- A utility or me/history/bag surface still needs a source outside the frozen contract.
- Call-site adoption would drop an accepted continuation semantic.
