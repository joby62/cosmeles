# Phase 13 Worker B Prompt

你是 Worker B，当前轮次是 phase-13 keep-current / hybrid closure patch。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

当前目标：
- 作为 closure truth owner，收 keep-current / hybrid 的 write-back 与完成语义。
- 优先修正 `/m/me/use` 的完成真相，再让 compare result UI 收尾。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/use/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/result/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`

建议起手：
- 先看 `mobile-first-run-and-compare-closure-rollout.md`
- 再看 `/m/me/use`
- 再看 `frontend/features/mobile-utility/*`

交付标准：
- `history_product` 的 keep-current 能闭环，不再落成“还差一步”
- `hybrid` 要有独立于 keep-current 的 closure 语义
- `/m/me/use` 对 keep-current / hold-current 都有明确完成态
- compare result 到 `/m/me/use` 的 query / route-state 只保留完成闭环所需最小语义
- 不再为了旧页面文案妥协 closure truth

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- result -> compare 直达结果必须扩 backend compare contract
- 首轮 funnel 与老用户 workspace 规则在现有首页模型里不可兼容
- result canonical 事件切换会反向破坏 funnel 统计
