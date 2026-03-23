# Phase 10 Deploy Dispatch

部署、验收、收口时，owner 必须附带下面这组 prompt 路径，避免 worker 只拿到一句任务名却不知道从哪里开始。

使用顺序：
1. 先读各自长期 handoff prompt
2. 再读本轮 phase-10 assignment prompt
3. 再从“建议起手文件”进入代码

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

本轮 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-10/worker-a.prompt.md`

一句简评：
- 负责 analytics 口径收口和 dashboard/API 消费对齐，不碰结果页和 helper 真相层。

建议起手文件：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/MobileAnalyticsDashboard.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/page.tsx`

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

本轮 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-10/worker-b.prompt.md`

一句简评：
- 负责 result-to-utility route semantics 真相层，先把 `return_to`、`result_cta`、`scenario_id`、`compare_id` 的 helper 行为冻结，再交给 C 接页面。

建议起手文件：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/DecisionResultShellPage.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/routeState.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/flowReturn.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/resultCtaAttribution.ts`

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

本轮 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-10/worker-c.prompt.md`

一句简评：
- 等 B 冻结 helper 真相后，再把结果页和 `/m` returning-user workspace 改成 phase-10 的意图分流 UI。

建议起手文件：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/AddToBagButton.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`

## Owner 派工口径

给 Worker B：
- 先读 handoff，再读 phase-10 assignment；你是这轮 helper truth owner。先看 `route_state.json`、`DecisionResultShellPage.tsx`、`routeState.ts`，优先解决 `return_to` / `result_cta` 传播，不要先动页面。

给 Worker C：
- 先读 handoff，再读 phase-10 assignment；这轮先等 Worker B 给 helper freeze。拿到 `go` 之后，从 `SelectionPublishedResultFlow.tsx` 和 `/m` 首页开始，把主 CTA、疑虑路径、任务切换和 returning-user workspace 调成 PRD 语义。

给 Worker A：
- 先读 handoff，再读 phase-10 assignment；这轮守 analytics 口径，不发明第二套结果事件词。先看 contract、backend summary、dashboard 消费，再看文档。
