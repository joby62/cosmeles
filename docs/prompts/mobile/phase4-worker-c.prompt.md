# Phase 4 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Finish the `me` / history / bag continuation layer so returning users resume or re-open decision outcomes through one shared memory model.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/bag/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*` only when consuming shared resume/result helpers

Constraints:
- `me` is the memory layer for the decision system, not a disconnected utility home.
- Do not create a second localStorage truth for resume or recent-result state.
- Keep public URLs stable.
- `bag` and history may support the decision loop, but they must not replace choose/result as first-visit narrative.
- If old state must be read, do it through a compatibility adapter, not a page-local parser.

Deliverables:
- Shared resume and recent-result helpers are the only source for `me` continuation behavior.
- History and bag cards can take the user back to the right next step without bespoke branching.
- Page components get thinner; storage parsing and continuation semantics move to shared helpers.
- UI copy reinforces continuation, not a separate utility storyline.

Self-review checklist:
- `rg -n "localStorage|sessionStorage" frontend/app/m/(utility)/me frontend/app/m/(utility)/bag frontend/domain/mobile frontend/features/mobile-utility` points to shared helpers rather than scattered page code.
- Returning-user actions resolve to one of: resume profile, reopen result, or go back to choose.
- No page introduces a private result or resume payload shape.
- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`.

Escalate to architecture owner if:
- You need a new shared continuation payload shape.
- Existing resume/result helpers cannot express a real returning-user case.
- A page needs to special-case one category's continuation semantics.
