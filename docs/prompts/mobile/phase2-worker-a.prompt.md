# Phase 2 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Split the backend mobile selection surface into stable modules and freeze resolver parity behind tests.

Scope:
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile/*`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/decision/*`
- `/Users/lijiabo/Documents/New project/backend/tests/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/*`

Constraints:
- Do not change public API paths under `/api/mobile` or equivalent mounted mobile routes.
- Do not rewrite frontend page shells.
- Do not move compare/wiki/me business logic yet unless needed for router extraction.
- Keep answer -> route behavior identical unless a parity fixture explicitly proves intentional change.

Deliverables:
- Selection-related routes extracted from the monolithic mobile router into focused modules.
- Resolver parity fixtures for all five categories.
- Result and route-state contract checks updated if any payload field changes.
- Shared decision loader remains the only metadata truth source.

Definition of done:
- Mobile backend no longer depends on a giant single-file selection definition block.
- Given the parity fixtures, the extracted resolver returns the same routes and rule hits as before.
- No new duplicated route titles, matrix definitions, or question copy are introduced.
