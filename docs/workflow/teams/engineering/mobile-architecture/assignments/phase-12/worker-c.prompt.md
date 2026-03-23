# Phase 12 Worker C Prompt

你是 Worker C，当前轮次是 phase-12 result decision closure。

开始条件：
- 先等 Worker B 给出 helper / route semantics `green`

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-decision-closure-rollout.md`

当前目标：
- 把 compare 和 rationale 从“信息页”收成“决策闭环页”。
- 保持 phase-10 已上线的 result 顶层结构，不重开 result IA。

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/result/[compareId]/result-flow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`

建议起手：
- 先看 compare result `result-flow.tsx`
- 再看 compare entry `compare/page.tsx`
- 再看 `wiki/product/[productId]/page.tsx`

交付标准：
- compare 第一屏先给裁决结论，不先堆原因卡和信息卡
- compare 主 CTA 跟着 `switch / keep / hybrid` 变化
- 无在用品时，result 语境下的 compare 入口变成极短上传承接
- rationale 第一屏先讲“为什么适合你 / 解决什么 / 注意什么”
- rationale 页面持续保留 `先加入购物袋` + `和我现在在用的比一下`
- 若 scoped diff = 0，直接 green 并停止

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

升级给 Owner：
- compare verdict-first UI 成立不了，除非先改 backend compare 输出 contract
- rationale mode 无法在现有 wiki product detail 上加出来，只能新起壳层
- 页面要成立必须把 `我的` 再放回 result 顶层动作
