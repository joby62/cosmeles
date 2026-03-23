# Phase 12 Deploy Dispatch

phase-12 是 result-intent routing 之后的下一轮，主题是 decision closure。
这一轮不是再改 result 顶层 IA，而是把 compare / rationale 收成“回到明确决定”的闭环。

使用顺序：
1. 先读各自长期 handoff
2. 再读 phase-12 assignment
3. 再读 `mobile-result-decision-closure-rollout.md`
4. 再从建议起手文件进入代码

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-12 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-12/worker-a.prompt.md`

一句简评：
- 守 analytics 口径；保住 phase-10 result event family，只在 compare / rationale closure 无法观测时再扩事件。

起手建议：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/MobileAnalyticsDashboard.tsx`

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-12 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-12/worker-b.prompt.md`

一句简评：
- 这轮是 truth owner。先把 compare / rationale 的 entry、return、completion 和 keep-current 落点冻结，再给 C 放行。

起手建议：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-decision-closure-rollout.md`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-12 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-12/worker-c.prompt.md`

一句简评：
- 等 B 绿灯后，把 compare 和 rationale 从“信息页”改成“裁决页 / 推荐依据页”，不重开 result 顶层设计。

起手建议：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/result/[compareId]/result-flow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`

## Owner 派工口径

给 Worker B：
- 你先做真相层，不先做页面美化。先确定 result -> compare / rationale 如何进入、如何返回、如何在 compare 完成后落到明确决定。

给 Worker C：
- 你等 B 的 `green`。拿到 go 之后，重点改 compare 第一屏和 rationale 第一屏，不要重开 result 顶层 IA。

给 Worker A：
- 你守 analytics，不让 result 事件再次裂变。只在 compare / rationale closure 无法观测时新增专用事件。
