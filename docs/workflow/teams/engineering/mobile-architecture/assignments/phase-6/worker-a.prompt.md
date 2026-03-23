# Phase 6 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Repair the P0 analytics first-screen counting bug so every `*_sessions` metric is truly session-level.

Scope:
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`

Constraints:
- Do not change the five P0 questions.
- Do not invent a second summary vocabulary to hide the bug.
- Any field ending in `_sessions` must be deduped by session.
- If you still need scenario-level counts for supporting context, give them distinct names and keep them out of the first-screen KPI headline.
- Do not touch route-state or utility adapter work in this task.

Deliverables:
- `result_view_sessions`, `result_primary_cta_click_sessions`, `result_secondary_loop_click_sessions`, and `utility_return_click_sessions` all use session-level keys.
- P0 funnel uses one counting unit end-to-end from `/m` through result reach.
- Regression coverage proves one session with multiple result scenarios does not inflate P0 completion metrics.
- Dashboard copy stays aligned with the owner-frozen P0 contract after the fix.

Self-review checklist:
- `rg -n "_sessions" backend/app/routes/products.py backend/app/schemas.py frontend/lib/api.ts frontend/components/analytics frontend/app/analytics` shows session-named fields only for session-deduped metrics.
- Add at least one analytics API regression test where the same session emits multiple `result_view` or `result_*` events with different `scenario_id` values.
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py` passes.
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

Escalate to architecture owner if:
- Fixing the unit mismatch would require changing the frozen P0 question set itself.
- The backend needs both session-level and scenario-level result metrics but the current contract has no safe place for the latter.
- You discover historical analytics rows without stable `session_id`, making session-level dedupe impossible for a required KPI.
