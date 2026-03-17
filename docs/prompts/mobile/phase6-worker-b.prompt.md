# Phase 6 Worker B Prompt

You are Worker B on the mobile architecture refactor.

Start condition:
- Do not begin implementation until the architecture owner freezes the stepful decision analytics semantics for `questionnaire_view(step)` and `question_answered(step)`.
- Read `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_question_steps.v1.json` before touching decision profile analytics.

Objective:
Move decision question-step analytics into shared flow infrastructure so `question_dropoff` can later become computable without per-page hacks.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/decision/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*/profile/*`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/*/start/*`
- Any shared analytics contract or fixtures explicitly referenced by the owner freeze

Constraints:
- Do not invent category-specific event names or step payloads.
- Category page wrappers must stay thin; shared flow infrastructure owns event emission.
- Do not change public `/m` paths.
- Do not mix this task with dashboard presentation work or utility route-state cleanup.
- If a result or resume flow needs analytics context, pass it through shared helpers rather than page-local query invention.

Deliverables:
- Shared decision profile/start flow emits stable `questionnaire_view(step)` and `question_answered(step)` semantics.
- Category wrappers stop owning question-step event details.
- The implementation is explicit about what counts as a step and when the event fires.
- Any necessary compatibility notes are localized and auditable.

Self-review checklist:
- `rg -n "questionnaire_view|question_answered" frontend/app/m/'(decision)' frontend/features/mobile-decision frontend/domain/mobile/decision` points to shared flow ownership, not five separate page implementations.
- No category page introduces bespoke `step` numbering logic.
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

Escalate to architecture owner if:
- Shared decision flow cannot express a stable step index across all five categories.
- The frozen analytics semantics need a new contract field.
- You find a category wrapper that still has to own private question-step behavior after shared helper extraction.
