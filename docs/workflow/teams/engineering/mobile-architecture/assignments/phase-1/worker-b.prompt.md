# Phase 1 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Objective:
Build the new decision-first shell for `/m`, `/m/choose`, questionnaire, and result without reintroducing product-map thinking.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/*` for decision-shell route-group wiring only when approved

Constraints:
- `choose` is the primary entry for first-visit users.
- `compare`, `wiki`, and `me` remain important but cannot be peer-level first-screen CTAs.
- Do not hardcode category truth in page files.
- Use shared route-state semantics instead of bespoke query handling.
- Result must follow `selection_result.v3`.

Deliverables:
- Minimal decision-first `/m` homepage.
- Minimal `/m/choose` focused on category selection and resume.
- Generic questionnaire flow that can read shared config.
- Result renderer aligned to one result, three reasons, one next step.

Definition of done:
- First-visit users see one obvious primary action.
- Choose page only solves category selection and resume.
- No new page invents its own route or analytics semantics.
