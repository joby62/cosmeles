# Phase 5 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Start condition:
- Do not begin implementation until the architecture owner lands the Phase 5 P0 analytics contract freeze.

Objective:
Build the first-screen P0 analytics panels for the decision funnel after the contract is frozen.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/analyticsNav.ts`
- Any analytics-focused frontend tests or fixtures coupled to the dashboard contract

Constraints:
- Do not invent new API response fields or summary keys before the owner freeze lands.
- `/analytics` first screen must answer the five P0 questions before any compare or environment detail.
- Keep compare and utility charts as supporting context, not the main headline.
- Do not reintroduce `profile_result_view` or `compare_result_view` as the primary decision-result KPI lens.

Deliverables:
- Overview and funnel panels for `/m`, `/m/choose`, `profile`, and `result`.
- Question drop-off view that makes the highest-loss question obvious by category.
- Result CTA view that separates primary CTA clicks from utility loop actions.
- Dashboard copy and docs align to the product north-star wording.

Self-review checklist:
- `rg -n "profile_result_view|compare_result_view" frontend/app/analytics frontend/components/analytics frontend/lib/api.ts` only returns compatibility context.
- The first screen answers entry volume, choose-to-start, question drop-off, result reach, and result CTA engagement.
- No new frontend-only summary shape appears without a matching contract freeze.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass in `frontend/`.

Escalate to architecture owner if:
- The frozen analytics contract cannot express one of the P0 questions.
- You need backend aggregation changes rather than frontend consumption work.
- A required panel would force compare/utility detail back into the first-screen headline.
