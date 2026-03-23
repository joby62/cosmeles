# Phase 11 Worker B Prompt

你是 Worker B，当前轮次是 phase-11 deploy hardening / acceptance，不是 phase-10 的主实现轮。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

当前目标：
- 作为 helper truth owner，验收并守住 result-to-utility route semantics。
- 这轮优先做 smoke、acceptance recheck、thin cleanup；不要再把页面层改动带回 helper 层。

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/flowReturn.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/resultCtaAttribution.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/resultCta.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`

建议起手：
- 先看 `route_state.json`
- 再看 `DecisionResultShellPage.tsx`
- 再看 `routeState.ts`
- 再看 `flowReturn.ts` 与 `resultCtaAttribution.ts`

交付标准：
- 结果页不能再因 `return_to` 自动跳走
- `source` / `return_to` / `scenario_id` / `result_cta` / `compare_id` 在结果到 utility 的链路上保持单一真相
- 若发现 drift，只做 helper-local 薄修
- 若 scoped diff = 0，直接报告 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 需要新增 query key 或扩大 route-state contract
- helper 层已经收不住，需要改 product semantics 才能继续
- 发现两套 competing route truth 仍同时存在
