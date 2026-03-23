# Phase 11 Deploy Dispatch

phase-11 是 phase-10 的下一轮：部署、验收、薄修、收口。
它不覆盖 phase-10 的实现任务卡；phase-10 保留为主实现历史，phase-11 只承接当前 deploy hardening。

使用顺序：
1. 先读各自长期 handoff prompt
2. 再读本轮 phase-11 assignment prompt
3. 再从“建议起手文件”进入代码

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-11 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-11/worker-a.prompt.md`

一句简评：
- 守 analytics 口径和 deploy acceptance，不碰 helper 真相层和结果页 UI。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-11 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-11/worker-b.prompt.md`

一句简评：
- 先做 helper truth smoke，确认 route-state 链路稳定，再给 C 放行。

起手建议：
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/DecisionResultShellPage.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/routeState.ts`

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-11 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-11/worker-c.prompt.md`

一句简评：
- 等 B 绿灯后，再做结果页和 `/m` 首页的 smoke / thin cleanup。

起手建议：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/AddToBagButton.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`

## Owner 派工口径

给 Worker B：
- 你是 phase-11 的 truth owner。先做 helper smoke，确认 `return_to` / `result_cta` / `scenario_id` / `compare_id` 传播稳定，再回 `go` 或 `hold` 给 C。

给 Worker C：
- 你是 phase-11 的 UI smoke / thin cleanup owner。先等 B；拿到 `go` 后，只验收结果页 CTA 层级和 `/m` 的 returning-user workspace，不做新设计。

给 Worker A：
- 你是 phase-11 的 analytics acceptance owner。等 B/C 首轮绿灯后，对齐 API / dashboard / contract，确认没有第二套事件词长出来。
