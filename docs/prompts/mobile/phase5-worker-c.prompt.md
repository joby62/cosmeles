# Phase 5 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Objective:
Thin down `me` / history / bag around the shared continuation layer without changing user-facing semantics.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/me/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/bag/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*` for history or bag continuation surfaces
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`

Constraints:
- Do not create or keep a second continuation payload shape.
- Do not spread localStorage parsing back into page components.
- Keep public URLs stable.
- Preserve the current continuation actions: resume profile, reopen result, or go back to choose.
- Do not mix this task with analytics dashboard work.

Deliverables:
- `me`, history, and bag pages consume shared continuation helpers only.
- Page files lose bespoke branching and storage decisions.
- Any continuation copy differences move to shared copy helpers instead of inline duplication.
- Returning-user flows remain semantically identical after cleanup.

Self-review checklist:
- `rg -n "localStorage|sessionStorage" frontend/app/m/(utility)/me frontend/app/m/(utility)/bag frontend/components/mobile frontend/domain/mobile/progress frontend/features/mobile-utility` points to shared helper ownership rather than scattered page logic.
- All continuation entry points resolve to one of the approved three actions.
- No category-specific continuation branch leaks back into page code.
- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`.

Escalate to architecture owner if:
- You need a new continuation action beyond the current three.
- A page cannot be thinned without changing route or storage semantics.
- You find category-specific continuation logic that should become contract, not page behavior.
