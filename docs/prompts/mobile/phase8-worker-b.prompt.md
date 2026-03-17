# Phase 8 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Start condition:
- Read `/Users/lijiabo/Documents/New project/shared/mobile/contracts/decision_entry_sources.v1.json` before implementation.

Objective:
Centralize the frozen decision-entry and continuation source vocabulary into shared helper ownership.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`

Constraints:
- Do not invent new source strings.
- No raw continuation `sourceFallback` string may remain once a shared constant/helper exists.
- Preserve current route behavior and query semantics.
- Do not mix this task with dashboard presentation work.

Deliverables:
- Shared source constants/helpers cover both fresh decision entry and continuation sources.
- `useMobileUtilityContinuationLinks`, `MeDecisionResumeCard`, and related helpers consume frozen source constants instead of raw strings.
- Helper ownership becomes the only place where new source values could theoretically be added.

Self-review checklist:
- `rg -n 'sourceFallback:|m_me_|bottom_nav_choose|category_rail_choose|utility_.*reentry|decision_result_restart' frontend/features/mobile-decision frontend/features/mobile-utility frontend/domain/mobile/progress`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`

Escalate to architecture owner if:
- A continuation surface needs a source label outside the frozen vocabulary.
- Shared helper adoption would force a route-behavior change instead of a pure semantic cleanup.
