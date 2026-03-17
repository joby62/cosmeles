# Phase 6 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Normalize utility return tracking through shared helpers so compare/wiki/library/product surfaces stop assembling `utility_return_click` payloads by hand.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/app/product/[id]/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Constraints:
- Do not change public routes.
- Do not add new analytics event names.
- Compare-origin return flows must preserve `compare_id` where it exists.
- Shared helper ownership is the goal; do not just move duplication between page files.
- Missing-context fallback must remain explicit and safe.

Deliverables:
- A shared helper or component owns utility return action href + event payload assembly.
- Compare result, compare library, wiki list, wiki detail, wiki product detail, and product landing surfaces consume the shared helper where applicable.
- No page invents different `utility_return_click` payload keys for the same semantic action.
- Compare-origin return flows continue to carry `compare_id` through analytics props and route-state where required.

Self-review checklist:
- `rg -n "utility_return_click" frontend/app/m/'(utility)' frontend/app/product/'[id]'/page.tsx frontend/features/mobile-utility frontend/lib/mobile` only shows shared helper ownership plus truly exceptional cases.
- `rg -n "compare_id" frontend/app/m/'(utility)' frontend/app/product/'[id]'/page.tsx frontend/features/mobile-utility` shows compare provenance preserved on compare-origin return surfaces.
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`

Escalate to architecture owner if:
- A surface needs a route-state field outside the frozen contract to preserve return semantics.
- Product landing analytics needs different semantics from other utility return surfaces.
- A shared helper would change an already-frozen return action contract.
