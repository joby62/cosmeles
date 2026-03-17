# Phase 5 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Finish the utility adapter deletion pass now that route-state semantics are frozen.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Constraints:
- Do not change public paths under `/m`.
- New links may not write legacy query keys.
- Compatibility reads must stay centralized and auditable.
- Missing-context fallback must remain safe and explicit.
- Do not touch analytics summary work; stay inside utility semantics and adapters.

Deliverables:
- A deletion candidate list for remaining legacy adapters.
- Shared helper ownership for all result-context utility hops.
- No page file writes `from_compare_id` or any other contract-external query key.
- Utility return flows remain compatible with compare-origin and result-origin entry.

Self-review checklist:
- `rg -n "from_compare_id" frontend/app/m/(utility) frontend/features/mobile-utility frontend/lib/mobile` only returns explicit adapter reads that still need to exist.
- `rg -n "compare_id" frontend/app/m/(utility)` shows new writes going through shared helpers or structured analytics props.
- Pages degrade safely to `/m/choose` when state is missing.
- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`.

Escalate to architecture owner if:
- You find a live deep link that still needs a route-state field outside the frozen contract.
- Deleting a compatibility read would break an accepted external/shareable URL.
- A page still needs to own private route semantics after helper cleanup.
