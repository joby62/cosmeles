# Phase 13 Deploy Dispatch

phase-13 当前进入补丁轮，只补 3 类阻塞：
- compare result 裁决化
- keep-current / hybrid closure
- phase-13 analytics canonical cleanup

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

额外规则：
- 停止继续沿用 phase-10 analytics 口径作为现行真相
- 若要保旧指标，只能做兼容桥接，不能让前端继续发 phase-10 旧事件家族作为新实现
- `/m` 与 `/m/choose` 本轮不再继续改
- rationale 页面视觉层本轮不再继续改

使用顺序：
1. 先读各自长期 handoff
2. 再读 phase-13 assignment
3. 再读 `mobile-first-run-and-compare-closure-rollout.md`
4. 再从建议起手文件进入代码

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-13 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-13/worker-a.prompt.md`

一句简评：
- 守 analytics 真相，只补 canonical cleanup，不再把旧 phase 叙事继续带进 dashboard。

起手建议：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-13 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-13/worker-b.prompt.md`

一句简评：
- 这轮是 closure truth owner，只收 keep-current / hybrid write-back 与 compare result completion，不再横向改首访 funnel。

起手建议：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/use/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/routeState.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/flowReturn.ts`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-13 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-13/worker-c.prompt.md`

一句简评：
- 把 compare result 真正改成裁决页；keep-current / hybrid completion 语义服从 Worker B，不再顺手扩 rationale 或别的页面。

起手建议：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/result/[compareId]/result-flow.tsx`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

## Owner 派工口径

给 Worker A：
- 你只补 analytics canonical cleanup。旧指标可以桥接，但 dashboard / summary / README 不能继续把旧 phase 当现行真相。

给 Worker B：
- 你只做 keep-current / hybrid closure truth，不再继续扩 `/m`、`/m/choose` 或 result 顶层入口。

给 Worker C：
- 你只按 compare result spec 压裁决页；涉及 completion 的地方服从 Worker B 的冻结语义，也不要再为了兼容旧事件保留长内容结构。
