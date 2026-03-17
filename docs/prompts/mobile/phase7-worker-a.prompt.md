# Phase 7 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Start condition:
- Read `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_dropoff.v1.json` before implementation.

Objective:
Move `question_dropoff` from blocked to live in backend aggregation and `/analytics` first-screen consumption.

Scope:
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_dropoff.v1.json` only if the implementation reveals a contract bug that must be escalated

Constraints:
- Count only from `questionnaire_view(step)` and `question_answered(step)`.
- Dedupe only by `session_id + category + step`.
- Ignore invalid rows; do not backfill missing `step` from route/query.
- Keep compare and utility events out of question-dropoff math.
- Do not break the already-fixed P0 session metrics.

Deliverables:
- Overview response exposes `question_dropoff_top` and `question_dropoff_by_category` with status `live` when valid data exists.
- `/analytics` first screen uses the live dropoff data instead of the blocked placeholder.
- Regression tests cover repeated rows in one session and invalid rows missing `step`.
- Dashboard wording still answers the five P0 questions before any secondary panel.

Self-review checklist:
- `rg -n "question_dropoff" backend/app/routes/products.py backend/app/schemas.py backend/tests/test_mobile_analytics_api.py frontend/lib/api.ts frontend/components/analytics frontend/app/analytics` shows the same frozen field names.
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

Escalate to architecture owner if:
- The frozen dropoff response contract is insufficient for the first-screen panel.
- Shared question-step events arrive with inconsistent category/step semantics that cannot be safely filtered.
- Fixing question-dropoff would require changing the already accepted P0 session-metric fields.
