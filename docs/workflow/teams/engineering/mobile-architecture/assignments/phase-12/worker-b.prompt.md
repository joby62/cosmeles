# Phase 12 Worker B Prompt

你是 Worker B，当前轮次是 phase-12 result decision closure。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-decision-closure-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

当前目标：
- 作为 truth owner，冻结 result -> compare / rationale 的 closure route semantics。
- 不先追页面视觉；先把 compare entry、return、completion、keep-current 语义收口。

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`

建议起手：
- 先看 `mobile-result-decision-closure-rollout.md`
- 再看 `route_state.json`
- 再看 `frontend/app/m/(utility)/compare/page.tsx`
- 再看 `frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`

交付标准：
- result -> compare / rationale 继续只走一套路由真相
- 没有当前在用品时，compare 从 result 进入后必须走极短上传承接，而不是泛工具教育
- compare 完成后进入明确决定动作，而不是回 compare 首页
- `keep current` 闭环有清晰落点，不是口头结论
- 若 scoped diff = 0，直接 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 需要扩大 route-state contract 才能完成 closure
- compare / rationale completion 会反向改变 result 页主层语义
- “继续用现在这款”没有安全的最短落点
