# Phase 9 Worker C Init Prompt

You are Worker C on the mobile architecture convergence round.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-branch-convergence-checklist.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/route_state.json`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/audits/mobile-utility-adapter-audit.md`

Start Condition:
- Begin only after Worker B reports `green` or explicitly hands off a bounded call-site cleanup.

Current operating truth:
- The live docs are current truth; archived Phase 0-9 notes are historical context only.
- Utility is important, but it remains loop closure and memory-layer support, not first-visit narrative.
- If call sites already obey the frozen helper semantics, report that clearly and stop.

Objective:
- Recheck utility and `me/history/bag` call sites against the frozen continuation and source semantics.
- Confirm utility surfaces preserve `source`, `return_to`, `scenario_id`, and `result_cta` through shared helpers without page-local query assembly drift.
- Keep the utility audit note honest about any intentional remaining exception.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/audits/mobile-utility-adapter-audit.md`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/useMobileUtilityContinuationLinks.ts`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- Unrelated doc-migration files that are currently dirty in the primary worktree

Deliverables:
- A concise audit result with `green`, `yellow`, or `red`
- Confirmation that utility and `me/history/bag` call sites consume shared continuation/source helpers instead of raw string growth
- Confirmation that any remaining exception is intentional and documented, especially `m_me_use` staying page-analytics-only
- Thin call-site cleanup only if Worker B has already frozen the helper truth and real drift still exists

Working Rules:
- Do not redesign shared helpers inside this task.
- Do not use utility cleanup as a pretext to alter first-screen product narrative.
- If the current call-site scope diff is zero against the frozen semantics, report that and stop.
- Treat audit docs as live notes; update them only when they are materially out of sync with current code.

Self-review Checklist:
- `rg -n 'sourceFallback:|m_me_|utility_.*reentry|bottom_nav_choose|category_rail_choose|choose_start' /Users/lijiabo/Documents/New\\ project/frontend/app/m/'(utility)' /Users/lijiabo/Documents/New\\ project/frontend/components/mobile /Users/lijiabo/Documents/New\\ project/docs/initiatives/mobile/architecture/audits/mobile-utility-adapter-audit.md`
- `rg -n 'return_to|scenario_id|result_cta|compare_id|resume_token|source' /Users/lijiabo/Documents/New\\ project/frontend/app/m/'(utility)' /Users/lijiabo/Documents/New\\ project/frontend/components/mobile`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- A utility or `me/history/bag` call site still needs a new source label outside the frozen vocabulary.
- Fixing a surface would require shared-helper redesign rather than thin call-site alignment.
- You find any utility surface trying to reclaim first-screen decision attention instead of acting as loop closure or memory-layer support.
