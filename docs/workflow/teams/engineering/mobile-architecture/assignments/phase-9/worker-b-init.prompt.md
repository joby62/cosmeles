# Phase 9 Worker B Init Prompt

You are Worker B on the mobile architecture convergence round.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-branch-convergence-checklist.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Current operating truth:
- The live docs are current truth; archived Phase 0-9 notes are historical context only.
- This round is acceptance recheck plus helper-local drift cleanup only when needed.
- You are the truth owner for decision-entry source vocabulary and route-state helper semantics in this round.

Objective:
- Recheck that shared helper ownership remains the single truth for decision-entry href construction, continuation source vocabulary, and route-state query semantics.
- Confirm current code obeys the live rule: compare branches by scoped diff and current contracts, not by archived replay maps.
- If drift exists, keep cleanup helper-local and behavior-preserving.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- Unrelated doc-migration files that are currently dirty in the primary worktree

Deliverables:
- A concise audit result with `green`, `yellow`, or `red`
- Confirmation that shared helpers remain the only place where approved decision-entry or continuation source values are defined
- Confirmation that no new route-state query key drift exists outside the frozen contract
- Thin helper-local cleanup only if real drift exists inside your boundary
- A clear handoff note to Worker C: `go` or `hold`, with the reason

Working Rules:
- Do not act on archived commit ids or archived replay notes as if they were current truth.
- If scoped helper behavior already matches the frozen contracts, report that and stop.
- Do not push page-level fallout into your scope just to make the task look bigger.
- Do not expand the frozen source vocabulary or route-state contract without owner approval.

Self-review Checklist:
- `rg -n 'sourceFallback:|m_me_|bottom_nav_choose|category_rail_choose|utility_.*reentry|decision_result_restart|choose_start|decision_start' /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-utility /Users/lijiabo/Documents/New\\ project/frontend/domain/mobile/progress`
- `rg -n 'return_to|scenario_id|result_cta|compare_id|resume_token|source' /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-decision /Users/lijiabo/Documents/New\\ project/frontend/features/mobile-utility /Users/lijiabo/Documents/New\\ project/frontend/domain/mobile/progress`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- A remaining issue would require expanding `decision_entry_sources.v1.json` or `route_state.json`.
- Fixing drift would change accepted route behavior instead of preserving it.
- You find any page or call site still inventing its own decision-entry href or continuation semantics outside shared helper ownership.
