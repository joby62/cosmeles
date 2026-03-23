# Phase 11 Worker A Prompt

你是 Worker A，当前轮次是 phase-11 deploy hardening / acceptance，不是 phase-10 的主实现轮。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

当前目标：
- 作为 analytics acceptance owner，确认 phase-10 deploy candidate 的埋点、dashboard、API summary 和 contract 口径一致。
- 这轮默认只做 acceptance recheck 和 contract-alignment-only 薄修，不重写页面，不扩事件家族。

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`

建议起手：
- 先看 `analytics_events.json`
- 再看 `backend/app/routes/products.py`
- 再看 `frontend/components/analytics/MobileAnalyticsDashboard.tsx`
- 最后对照 `backend/tests/test_mobile_analytics_api.py`

交付标准：
- `result_primary_cta_click` / `result_secondary_loop_click` / `utility_return_click` 继续作为主结果事件族
- `result_cta` / `action` / `target_path` 在 API 和 dashboard 中可见且解释一致
- `home_workspace_quick_action_click` 只作为 returning-user workspace supporting context
- 若 scoped diff = 0，直接报告 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 需要新建第二套 result event vocabulary
- backend summary shape 需要扩大到超出当前 frozen rollout
- analytics 口径和 PRD 真相直接冲突
