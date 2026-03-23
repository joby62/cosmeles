# Phase 9 Worker A Init Prompt

You are Worker A on the mobile architecture convergence round.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-branch-convergence-checklist.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_steps.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_dropoff.v1.json`

Current operating truth:
- The live docs are current truth; archived Phase 0-9 notes are historical context only.
- This round is acceptance recheck against live contracts, not another broad feature build.
- If your scoped diff is effectively zero, report that clearly and stop. Do not manufacture cleanup work.

Objective:
- Recheck P0 analytics contract consumption against the live PRD and live convergence note.
- Confirm `/analytics` still answers the decision-first P0 questions before any supporting context.
- Confirm `question_dropoff` remains live only when valid stepful data exists.

Task Boundary:
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_steps.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_dropoff.v1.json`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- Unrelated doc-migration files that are currently dirty in the primary worktree

Deliverables:
- A concise audit result with `green`, `yellow`, or `red`
- File references for any confirmed drift
- Thin contract-alignment cleanup only if real drift exists inside your boundary
- Explicit confirmation that the first-screen keys remain:
  - `home_primary_cta_click_sessions`
  - `choose_start_click_sessions`
  - `question_dropoff_top`
  - `question_dropoff_by_category`
  - `question_dropoff_status`
  - `result_view_sessions`
  - `result_primary_cta_click_sessions`
  - `result_secondary_loop_click_sessions`
  - `utility_return_click_sessions`

Working Rules:
- Judge current code against live docs, not against archived commit ids.
- Do not invent a new summary shape or a sixth first-screen question.
- Do not let compare, wiki, or utility metrics retake the primary P0 story.
- If no code drift exists, report that and stop instead of "cleaning up" wording or structure.

Self-review Checklist:
- `rg -n 'question_dropoff_top|question_dropoff_by_category|question_dropoff_status|blocked_until_stepful_questionnaire_view_exists' /Users/lijiabo/Documents/New\\ project/backend /Users/lijiabo/Documents/New\\ project/frontend /Users/lijiabo/Documents/New\\ project/shared`
- `rg -n 'home_primary_cta_click_sessions|choose_start_click_sessions|result_view_sessions|result_primary_cta_click_sessions|result_secondary_loop_click_sessions|utility_return_click_sessions' /Users/lijiabo/Documents/New\\ project/frontend/app/analytics /Users/lijiabo/Documents/New\\ project/frontend/components/analytics /Users/lijiabo/Documents/New\\ project/backend/app/routes/products.py`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- If frontend analytics code changes: `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- If frontend analytics code changes: `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- Fixing drift would require changing frozen response keys or adding a new dashboard summary shape.
- You find any live panel treating compare or utility events as the primary definition of result success.
- The issue is actually missing shared instrumentation rather than contract consumption drift.
