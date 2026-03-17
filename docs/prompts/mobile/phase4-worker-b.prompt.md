# Phase 4 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Audit and reduce utility route-state adapters so `wiki` and `compare` keep one contract while preserving old deep links safely.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*` when utility route-state is involved
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Constraints:
- Do not change public page paths under `/m`.
- Do not introduce new query keys outside `route_state.json`.
- Deep-link compatibility may read legacy keys through adapters, but new links may not write them.
- Utility pages must still degrade safely to `/m/choose` when route-state is missing or stale.
- Do not pull decision-flow ownership back into utility page files.

Deliverables:
- Every in-utility hop that should preserve result context uses the shared route-state helper.
- Legacy route-state reads are centralized and documented as adapters.
- Utility pages no longer carry page-local route semantics beyond thin view logic.
- Return targets across wiki/compare stay consistent with the shared contract.

Self-review checklist:
- `rg -n "from_compare_id|return_to=|scenario_id=|result_cta=" frontend/app/m/(utility) frontend/features/mobile-utility frontend/lib/mobile` shows only shared helper usage or explicit adapter reads.
- No page file writes legacy query keys directly.
- Missing-context flows land on `/m/choose` or another approved safe fallback.
- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`.

Escalate to architecture owner if:
- A required return path cannot be represented with the frozen route-state contract.
- Removing an adapter would break an active deep link and there is no contained compatibility layer.
- A utility page needs to own new flow semantics instead of consuming shared helpers.
