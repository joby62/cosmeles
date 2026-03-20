# Phase 13 Worker A Prompt

你是 Worker A，当前轮次是 phase-13 analytics canonical cleanup patch。

先读：
- `/Users/lijiabo/Documents/New project/docs/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

当前目标：
- 作为 analytics owner，只补 phase-13 canonical cleanup。
- 停止让 README / dashboard / summary 继续把 phase-10 / phase-12 当现行真相。
- 在 backend / dashboard 侧提供必要兼容桥接，但不保留双真相前端叙事。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

写入范围：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/use/*`

建议起手：
- 先看 `mobile-first-run-and-compare-closure-rollout.md`
- 再看 `analytics_events.json`
- 再看 `analytics_p0_funnel.v1.json`
- 再看 `backend/app/routes/products.py`

交付标准：
- README / dashboard / summary 不再出现“Phase 10 意图观测 / Phase 12 Decision Closure”作为现行真相
- result canonical 事件以 phase-13 词表为主叙事
- compare canonical 事件以 phase-13 词表为主叙事，并补齐：
  - `compare_result_hold_current`
  - `compare_result_view_key_differences`
  - `compare_result_open_rationale`
  - `compare_result_accept_recommendation_land`
  - `compare_result_keep_current_land`
- legacy bridge 可以保留，但只能作为兼容层
- 测试能覆盖 canonical summary，而不是只靠 legacy event bridge

必须验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 3 份产品文档在事件命名上仍无法统一
- backend summary shape 需要 breaking change
- 必须保留旧事件作为前端真相才不会丢数
