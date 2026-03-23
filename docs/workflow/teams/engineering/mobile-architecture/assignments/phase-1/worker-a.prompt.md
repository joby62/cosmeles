# Phase 1 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Extract and stabilize the shared decision kernel so frontend and backend stop maintaining duplicated questionnaire truth.

Scope:
- `/Users/lijiabo/Documents/New project/shared/mobile/decision/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/*`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/decision/*`
- `/Users/lijiabo/Documents/New project/backend/tests/mobile/*`

Constraints:
- Do not change public API paths.
- Do not rewrite page shells.
- Do not introduce a second source of truth for category labels, question counts, route titles, or question copy.
- Prefer fixtures, JSON contracts, and parity tests over prose comments.

Deliverables:
- Shared decision catalog expanded beyond category metadata into questionnaire truth.
- Backend loader and adapter code read from shared catalog.
- Parity tests prove current answer sets still resolve to the same routes.
- Any result-contract touches must update `selection_result.v3.json`.

Definition of done:
- The backend can resolve supported categories without hardcoded duplicated metadata.
- Tests fail if shared catalog and runtime constants drift.
- No new duplicated questionnaire definitions are introduced.
