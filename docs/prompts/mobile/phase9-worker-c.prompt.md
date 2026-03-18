# Phase 9 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Start Condition:
- Begin after Worker B confirms the shared helper/source vocabulary remains the single truth.

Objective:
Recheck utility and `me/history/bag` call sites against the frozen continuation/source semantics, and keep audit notes honest about any intentional exceptions.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*`
- `/Users/lijiabo/Documents/New project/docs/mobile-utility-adapter-audit.md`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/useMobileUtilityContinuationLinks.ts`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`

Deliverables:
- Utility and `me/history/bag` call sites continue to consume shared continuation/source helpers instead of raw continuation source strings.
- `docs/mobile-utility-adapter-audit.md` accurately documents any intentional remaining source exceptions.
- If an exception remains, it must be explicitly justified as outside decision-entry / continuation propagation semantics.

Self-review Checklist:
- `rg -n 'sourceFallback:|m_me_|utility_.*reentry|bottom_nav_choose|category_rail_choose|choose_start' /Users/lijiabo/Documents/New\ project/frontend/app/m/'(utility)' /Users/lijiabo/Documents/New\ project/frontend/components/mobile /Users/lijiabo/Documents/New\ project/docs/mobile-utility-adapter-audit.md`
- `rg -n 'return_to|scenario_id|result_cta|compare_id|from_compare_id' /Users/lijiabo/Documents/New\ project/frontend/app/m/'(utility)' /Users/lijiabo/Documents/New\ project/frontend/components/mobile`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- A utility or `me/history/bag` surface still needs a new source label outside the frozen vocabulary.
- Fixing a call site would drop accepted continuation semantics or force shared-helper redesign.
- You find any utility surface trying to reclaim first-screen decision attention instead of acting as result-loop or memory-layer support.
