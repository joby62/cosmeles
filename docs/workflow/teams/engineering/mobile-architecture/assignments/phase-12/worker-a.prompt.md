# Phase 12 Worker A Prompt

你是 Worker A，当前轮次是 phase-12 result decision closure。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-decision-closure-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/README.md`

当前目标：
- 作为 analytics owner，判断 compare / rationale 的 closure 是否需要新增专用事件。
- 保住 phase-10 的 result event family，不允许把 result 事件再拆出第二套词表。

写入范围：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`

建议起手：
- 先看 `mobile-result-decision-closure-rollout.md`
- 再看 `analytics_events.json`
- 再看 `backend/app/routes/products.py`
- 最后看 dashboard / analytics page

交付标准：
- phase-10 的 result 事件家族继续保留
- compare / rationale 只有在 closure 语义无法通过现有事件表达时，才新增专用事件
- dashboard / summary 能看懂“接受推荐”与“保留当前”两类 closure
- 若 scoped diff = 0，直接 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 需要给 result 页也新增第二套事件词表
- compare / rationale 的 closure 无法在现有 summary shape 上稳定表达
- spec 与 frozen rollout 在事件命名层面直接冲突
