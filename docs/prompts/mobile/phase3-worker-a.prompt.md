# Phase 3 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Freeze the backend decision-result contract and migrate decision-result analytics off legacy event semantics.

Scope:
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_results.py`
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_result_builder.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile_selection.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/mobile/*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/selection_result.v3.json`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`

Constraints:
- Do not change public route paths under `/api/mobile`.
- Do not break current frontend consumption while hardening the contract.
- If the backend cannot emit pure `selection_result.v3` yet, add an explicit adapter boundary and tests; do not leave the contract implied.
- Do not leave decision-result analytics dependent on `profile_result_view`.
- Any field rename or event rename must be reflected in contract files and tests in the same change.

Deliverables:
- Backend result publishing path clearly documents and enforces the fixed result contract.
- Decision-result analytics accept and report `result_view`, `result_primary_cta_click`, and `result_secondary_loop_click`.
- Tests cover contract validity, event ingestion, and any compatibility adapter that remains.
- Reporting code no longer treats decision-result completion as a legacy compare/profile event.

Definition of done:
- A reviewer can point to one stable backend boundary for decision-result payloads.
- Decision-result events are queryable without relying on legacy aliases.
- Tests fail if result contract shape or required event props drift.
