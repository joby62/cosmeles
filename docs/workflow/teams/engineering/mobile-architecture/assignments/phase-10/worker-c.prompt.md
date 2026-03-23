# Phase 10 Worker C Prompt

You are Worker C on the mobile result-intent routing rollout.

Start Condition:
- Begin only after Worker B confirms the helper truth for `return_to`, `result_cta`, and result-to-utility route semantics.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`

Objective:
- Adopt the owner-frozen result intent model on the result page and the returning-user home workspace.
- Keep new-user clarity intact while upgrading the result page from explanation-first to intent-routing-first.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/AddToBagButton.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/flowReturn.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/resultCtaAttribution.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Deliverables:
- Result page exposes exactly one strong conversion CTA: `加入购物袋`.
- Doubt-resolution actions are ordered as:
  - `和我现在在用的比一下`
  - `看为什么推荐这款`
- Task-switch actions stay explicit:
  - `重测这类`
  - `测其他品类`
- `/m` remains single-narrative for new users but becomes a lightweight workspace for returning users using the owner-frozen priority order.

Self-review Checklist:
- `rg -n '查看推荐产品|和其他候选再对比|查看产品或成分百科|回到我的记录|开始测配|继续上次进度|查看上次结果' /Users/lijiabo/Documents/New\\ project/frontend/components/mobile /Users/lijiabo/Documents/New\\ project/frontend/app/m/'(decision)'`
- `rg -n '加入购物袋|和我现在在用的比一下|看为什么推荐这款|重测这类|测其他品类|home_workspace_quick_action_click' /Users/lijiabo/Documents/New\\ project/frontend/components/mobile /Users/lijiabo/Documents/New\\ project/frontend/app/m/'(decision)'`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- The UI cannot express the frozen intent model without changing helper-layer semantics owned by Worker B.
- Returning-user workspace requirements would visibly regress first-visit clarity on `/m`.
- A surface change would require new result event names instead of using the frozen analytics model.
