# Phase 8 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Canonicalize `question_dropoff` question metadata from shared decision config instead of trusting generic event-prop fallbacks.

Scope:
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/shared/mobile/decision/*`
- Any backend helper that loads shared decision config for analytics-safe lookup

Constraints:
- Do not create a second question-title truth.
- Prefer shared decision config for `question_key` / `question_title` whenever `category + step` resolves.
- Event props may only remain as fallback when shared config cannot resolve the step.
- Do not change the already accepted `question_dropoff_top / question_dropoff_by_category` field names.

Deliverables:
- `question_dropoff` items resolve canonical `question_key` and `question_title` from shared config where possible.
- Regression coverage proves events without title/key still return meaningful canonical metadata.
- Invalid category/step rows remain ignored.

Self-review checklist:
- `rg -n "question_dropoff_question_key|question_dropoff_question_title|question_dropoff_top|question_dropoff_by_category" backend/app/routes/products.py backend/tests/test_mobile_analytics_api.py`
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`

Escalate to architecture owner if:
- Shared decision config cannot safely map `category + step` to canonical question metadata.
- Fixing metadata truth would require changing the frozen response shape.
