# Phase 7 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Centralize decision-entry href and source construction for decision-shell and global navigation surfaces.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/MobileBottomNav.tsx`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/MobileCategoryRail.tsx`

Constraints:
- Do not change public routes.
- Do not invent page-local source strings once a shared helper exists.
- New decision-entry links may not point to `/m/[category]/profile?step=1` without an explicit source when the origin surface is known.
- Keep choose as the primary first-visit entry; do not let nav/rail retell the homepage story.
- Do not mix this task with analytics dashboard aggregation work.

Deliverables:
- One shared helper owns decision-entry href creation for fresh profile entry.
- Decision-shell and global navigation surfaces use explicit source values via the shared helper.
- Raw hardcoded `/m/[category]/profile?step=1` links disappear from decision-shell and global-nav surfaces where source is knowable.
- Existing return/result attribution query semantics remain intact.

Self-review checklist:
- `rg -n 'profile\\?step=1' frontend/app/m/'(decision)' frontend/components/mobile/MobileBottomNav.tsx frontend/components/mobile/MobileCategoryRail.tsx frontend/features/mobile-decision` only returns helper internals or explicitly justified cases.
- `rg -n 'source=' frontend/app/m/'(decision)' frontend/components/mobile/MobileBottomNav.tsx frontend/components/mobile/MobileCategoryRail.tsx frontend/features/mobile-decision` points to shared helper ownership rather than ad hoc string assembly.
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

Escalate to architecture owner if:
- A decision-entry surface needs a source vocabulary that should be contract, not helper-local.
- Shared helper adoption would change an accepted public route or attribution semantic.
- You find a navigation surface that must intentionally stay source-less for product reasons.
