# Phase 11 Worker C Prompt

你是 Worker C，当前轮次是 phase-11 deploy hardening / acceptance，不是 phase-10 的主实现轮。

开始条件：
- 先等 Worker B 确认 helper truth 为 green，或 owner 明确给你 `go`

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`

当前目标：
- 作为 UI adoption / smoke owner，验收结果页和 `/m` returning-user workspace 是否真按 phase-10 语义落地。
- 这轮优先做 acceptance recheck 和 thin cleanup，不重开结构性设计。

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/AddToBagButton.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/*`

建议起手：
- 先看 `SelectionPublishedResultFlow.tsx`
- 再看 `AddToBagButton.tsx`
- 再看 `/m` 首页 `page.tsx`

交付标准：
- 结果页只有一个强 CTA：`加入购物袋`
- 疑虑路径顺序固定为：`和我现在在用的比一下` -> `看为什么推荐这款`
- 任务切换固定为：`重测这类` -> `测其他品类`
- `/m` 对新用户仍保持 decision-first，对 returning user 才表现 workspace
- 若 scoped diff = 0，直接报告 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

升级给 Owner：
- 页面要成立必须反向改 helper truth
- returning-user workspace 已经影响新用户首访叙事
- 页面要成立必须新增第二套 analytics 事件名
