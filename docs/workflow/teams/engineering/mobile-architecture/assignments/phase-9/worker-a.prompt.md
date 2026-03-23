# Phase 9 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Recheck P0 analytics contract consumption against the refreshed owner freeze docs, with focus on live `question_dropoff` semantics and the actual first-screen summary keys.

Task Boundary:
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_dropoff.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_steps.v1.json`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- Any deploy / Docker files

Deliverables:
- Confirm the first-screen `question_dropoff` contract uses the real keys: `question_dropoff_top`, `question_dropoff_by_category`, and `question_dropoff_status`.
- If thin cleanup is needed, keep it strictly contract-alignment-only; do not invent new dashboard questions or summary shapes.
- Regression coverage must still prove `question_dropoff` becomes `live` only when valid stepful data exists.

Self-review Checklist:
- `rg -n 'question_dropoff_top|question_dropoff_by_category|question_dropoff_status|question_dropoff_by_step|blocked_until_stepful_questionnaire_view_exists' /Users/lijiabo/Documents/New\ project/backend /Users/lijiabo/Documents/New\ project/frontend /Users/lijiabo/Documents/New\ project/shared`
- `rg -n 'home_primary_cta_click_sessions|choose_start_click_sessions|result_view_sessions|result_primary_cta_click_sessions|utility_return_click_sessions' /Users/lijiabo/Documents/New\ project/frontend/app/analytics /Users/lijiabo/Documents/New\ project/frontend/components/analytics /Users/lijiabo/Documents/New\ project/backend/app/routes/products.py`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- If frontend analytics code changes: `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- If frontend analytics code changes: `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- Fixing drift would require changing frozen response keys or adding a second analytics summary shape.
- `question_dropoff` semantics appear to depend on page-local instrumentation rather than the shared question-step contract.
- You find any panel still treating compare or utility events as the primary definition of result success.
