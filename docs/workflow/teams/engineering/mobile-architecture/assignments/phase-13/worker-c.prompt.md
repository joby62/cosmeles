# Phase 13 Worker C Prompt

你是 Worker C，当前轮次是 phase-13 compare result verdict-page patch。

开始条件：
- 可以先做 compare result / rationale UI 收口
- 但涉及 result -> compare 进入方式时，要服从 Worker B 的 flow truth freeze

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

当前目标：
- 把 compare result 真正收成裁决页
- 不重开 result 顶层 IA
- 不再继续改 rationale 页面视觉层

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/result/[compareId]/result-flow.tsx`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/compare/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/wiki/product/[productId]/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/use/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/*`

建议起手：
- 先看 compare result `result-flow.tsx`
- 再看 `mobile-compare-result-page-spec-v1.md`
- 最后回看 `mobile-first-run-and-compare-closure-rollout.md`

交付标准：
- compare result 首屏只保留 verdict-first 结构
- 删除：
  - `置信度`
  - `历史基线`
  - `route 标题`
  - 长滚动建议卡
  - `全部内容` 弹层
- `switch / keep / hybrid` 的主 CTA 表达都要成立，但 completion 语义服从 Worker B
- compare 的其他动作顺序改成：
  1. `看为什么推荐这款`
  2. `换一个当前产品再比`
  3. `回到这次结果`
  4. `测其他品类`
- 不再为了兼容 phase-10 analytics 旧词表保留不该存在的页面结构

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

升级给 Owner：
- compare result verdict-first 页面成立不了，除非先改 compare backend 输出 contract
- `hybrid` 必须拆成新的 backend verdict 才能做对
- rationale mode 现有壳层装不下，必须新起页
