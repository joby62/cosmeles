# Mobile Refactor Playbook

## Phase 0
- Freeze the old implementation in `codex/mobile-v1-baseline`.
- Run architecture work in `codex/mobile-arch-v2`.
- Do not add new mobile feature work to legacy modules.
- Build contracts before UI replacement.

## Phase 1 Deliverables
- Shared decision catalog scaffold.
- Shared result, route-state, and analytics contracts.
- Domain folder skeletons for frontend and backend.
- Review gates for worker branches.
- Worker assignments must be issued as prompt files under `docs/prompts/mobile/`.

## Phase 1 Exit Criteria
- Shared decision files exist for all five categories.
- Frontend questionnaire copy for all five categories reads from shared config.
- Backend selection matrices for all five categories read from shared config.
- Contract and loader tests cover the catalog plus per-category config loading.

## Phase 2 Deliverables
- Backend mobile selection routes split out of the monolithic router.
- Decision shell route group plus rebuilt `/m` and `/m/choose`.
- Utility shell route group plus loop-closure routing for wiki/compare/me.
- Event wiring aligned to the shared analytics contract.

## Phase 3 Deliverables
- Decision result flow hardened around the fixed result-page shape and contract boundary.
- Backend reporting and ingestion migrated to `result_*` decision-result events.
- Shared questionnaire/resolve/result helpers remove per-category page duplication.
- Utility pages consume `return_to`, `scenario_id`, `result_cta`, and `source` consistently.
- `me` becomes the shared memory layer for resume and recent-result continuation.

## Worker Prompt A
```text
You are responsible for the decision kernel and shared contracts.

Scope:
- shared/mobile/decision/*
- shared/mobile/contracts/*
- backend/app/domain/mobile/decision/*
- backend/tests/mobile/*

Rules:
- Do not change public API paths.
- Do not edit legacy page components.
- Do not add a second source of truth for question titles, labels, or route titles.
- Prefer machine-readable config and contract fixtures over prose comments.

Definition of done:
- Shared decision files exist for all five categories.
- Backend can load config from shared/mobile/decision.
- Parity tests prove current answers still resolve to the same route as before.
- selection_result.v3 contract test exists.
```

## Worker Prompt B
```text
You are responsible for the decision shell.

Scope:
- frontend/features/mobile-decision/*
- frontend/domain/mobile/*
- frontend/app/m decision-shell route groups when enabled

Rules:
- Choose is the primary first-visit entry.
- Do not surface compare/wiki/me as peer-level first-screen CTAs.
- Do not hardcode category questionnaire truth in page files.
- Use route_state contract instead of local ad hoc query params.

Definition of done:
- New /m shell is minimal and decision-first.
- New /m/choose only solves category selection and resume.
- Questionnaire flow reads shared config.
- Result page renderer follows selection_result.v3.
```

## Worker Prompt C
```text
You are responsible for the utility shell and loop closure.

Scope:
- frontend/features/mobile-utility/*
- compare/wiki/me route integration
- analytics and route-state wiring between result and utility modules

Rules:
- Compare/wiki/me stay important, but do not compete with choose on first visit.
- Utility pages must be reachable from result and me flows.
- Do not invent new analytics names outside shared/mobile/contracts/analytics_events.json.
- Do not break existing compare or wiki deep-linking semantics without adding adapters.

Definition of done:
- Utility shell is isolated from decision shell chrome.
- Compare/wiki/me all support return-to-result or return-to-choose flows.
- Event wiring uses contract names and required props only.
```

## Phase 2 Prompt Files
- `docs/prompts/mobile/phase2-worker-a.prompt.md`
- `docs/prompts/mobile/phase2-worker-b.prompt.md`
- `docs/prompts/mobile/phase2-worker-c.prompt.md`

## Phase 3 Prompt Files
- `docs/prompts/mobile/phase3-worker-a.prompt.md`
- `docs/prompts/mobile/phase3-worker-b.prompt.md`
- `docs/prompts/mobile/phase3-worker-c.prompt.md`

## Review Gates
- No duplicate questionnaire truth across frontend and backend.
- No worker branch edits legacy and new modules for the same concern unless explicitly approved.
- No public route break under `/m`.
- No new page-level freeform analytics events.
- No new result renderer escape hatches beyond `selection_result.v3`.
- Any change touching route semantics must update `shared/mobile/contracts/route_state.json`.
- Any change touching result semantics must update `shared/mobile/contracts/selection_result.v3.json`.
- No worker may add a second decision-result event vocabulary beside `result_*`.
- Utility pages must tolerate missing or stale route-state context and fall back safely.
- Category page wrappers should shrink over time; repeated flow logic in page files is a regression.

## Merge Order
1. Worker A contracts and parity tests.
2. Architecture owner review and contract freeze.
3. Worker B decision shell work.
4. Worker C utility shell and routing integration.
5. Architecture owner cutover review.
6. Legacy deletion only after contract and shell migration both pass.

## Phase 3 Merge Order
1. Worker A decision-result contract and analytics migration.
2. Architecture owner review and contract freeze.
3. Worker B shared questionnaire/resolve/result infrastructure.
4. Worker C utility return-flow and me memory-layer integration.
5. Architecture owner integration review across result -> utility -> return path.
6. Only after that: delete obsolete adapters and analytics aliases.

## Phase 4 Deliverables
- Analytics frontend and docs use the decision-result vocabulary as the primary lens.
- Utility route-state adapters are reduced to explicit compatibility shims instead of ambient query drift.
- `me` / history / bag continue the decision system through shared resume and recent-result semantics.
- Mainline merge choreography is documented around `codex/mobile-arch-v2` and `origin/main`.

## Phase 4 Prompt Files
- `docs/prompts/mobile/phase4-worker-a.prompt.md`
- `docs/prompts/mobile/phase4-worker-b.prompt.md`
- `docs/prompts/mobile/phase4-worker-c.prompt.md`

## Phase 4 Review Gates
- `/analytics` must answer the four weekly decision questions before any secondary charts.
- `result_view`, `result_primary_cta_click`, `result_secondary_loop_click`, and `utility_return_click` are the only approved decision-result loop vocabulary in frontend analytics surfaces.
- No frontend analytics panel may treat `compare_result_view` or `profile_result_view` as the primary definition of “decision result reached”.
- Utility compatibility adapters must be localized; no new page may write legacy query keys.
- `me`, `history`, and `bag` may consume shared resume/result helpers but may not recreate page-local storage truth.
- Any cleanup that deletes a compatibility alias must show a verified replacement path in code and tests.

## Phase 4 Merge Order
1. Worker A analytics frontend cutover and docs alignment.
2. Architecture owner review of analytics vocabulary freeze.
3. Worker B utility adapter cleanup and route-state propagation audit.
4. Worker C `me` / history / bag continuation cleanup.
5. Architecture owner integration review across analytics, utility return, and resume continuity.
6. Only after that: reconcile `codex/mobile-arch-v2` with `origin/main` and prepare the mainline merge.

## Phase 5 Deliverables
- Decision analytics moves from tail-stage result metrics to the full P0 funnel: `/m` -> `/m/choose` -> `profile` -> `result`.
- Utility compatibility adapters are reduced again, with explicit deletion candidates and no new legacy writes.
- `me` / history / bag page files shrink further around shared continuation helpers.
- Branch convergence is planned from the feature integration branch back into `codex/mobile-arch-v2` before any mainline attempt.

## Phase 5 Prompt Files
- `docs/prompts/mobile/phase5-worker-a.prompt.md`
- `docs/prompts/mobile/phase5-worker-b.prompt.md`
- `docs/prompts/mobile/phase5-worker-c.prompt.md`

## Phase 5 Owner Freeze Files
- `shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `docs/mobile-branch-convergence-checklist.md`

## Phase 5 Review Gates
- Worker A may not invent a new dashboard/API summary shape before the architecture owner freezes the P0 analytics contract.
- `/analytics` first-screen metrics must answer entry volume, choose-to-start, question drop-off, result reach, and result CTA engagement.
- No worker may delete a compatibility adapter unless the replacement path is already live and verified.
- No worker may add or keep page-local continuation parsing in `me`, history, or bag once a shared helper exists.
- No commit may be merged to `main` while the authoritative integration branch is still behind the worker branch stack.

## Phase 5 Merge Order
1. Architecture owner freezes the P0 analytics summary contract and branch convergence plan.
2. Worker B utility adapter deletion pass.
3. Worker C `me` / history / bag thin-adapter cleanup.
4. Worker A builds the P0 analytics panels and consumption layer on top of the frozen contract.
5. Architecture owner integration review across analytics, continuation, and branch convergence.
6. Only after that: move the accepted stack back into `codex/mobile-arch-v2` and prepare the mainline sync.

## Phase 6 Deliverables
- P0 analytics first-screen session metrics use one unit of measure end-to-end; result reach and result CTA engagement no longer mix session counts with scenario counts.
- Utility return tracking is routed through shared helpers instead of page-local payload assembly.
- Decision profile pages emit stable stepful analytics from shared infrastructure so `question_dropoff` can move from blocked to computable later.
- Branch convergence remains owner-led: accepted Phase 6 fixes fold back into `codex/mobile-arch-v2` before any mainline attempt.

## Phase 6 Prompt Files
- `docs/prompts/mobile/phase6-worker-a.prompt.md`
- `docs/prompts/mobile/phase6-worker-b.prompt.md`
- `docs/prompts/mobile/phase6-worker-c.prompt.md`

## Phase 6 Owner Freeze Files
- `shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `shared/mobile/contracts/analytics_question_steps.v1.json`
- `docs/mobile-branch-convergence-checklist.md`

## Phase 6 Review Gates
- Any analytics field or label ending in `_sessions` must be deduped by session, not by scenario or route.
- If scenario-level decision-result counts are still needed, they must use distinct names and may only appear as supporting context.
- Utility return events may not be hand-assembled differently across compare, wiki, library, and product surfaces once a shared helper exists.
- `questionnaire_view(step)` and `question_answered(step)` must come from shared decision flow infrastructure, not category page wrappers.
- No Phase 6 worker may modify `main`; accepted fixes must converge through `codex/mobile-arch-v2`.

## Phase 6 Merge Order
1. Worker A repairs the P0 analytics unit-of-measure bug and lands regression coverage.
2. Worker C normalizes utility return helper ownership and compare-provenance propagation.
3. Architecture owner reviews A/C together and freezes the stepful decision analytics contract.
4. Worker B lands shared question-step analytics instrumentation on top of that freeze.
5. Architecture owner re-reviews analytics, utility return, and decision-step semantics together.
6. Only after that: update the branch convergence checklist and begin moving the accepted stack back into `codex/mobile-arch-v2`.

## Phase 7 Deliverables
- `question_dropoff` moves from blocked to live using the frozen question-step semantics.
- Decision entry links stop leaking generic fallback source values when a concrete entry source is knowable.
- Shared helpers own decision entry href/source construction across decision and utility surfaces.
- Branch convergence remains owner-led; accepted Phase 7 fixes still fold back into `codex/mobile-arch-v2` before any mainline attempt.

## Phase 7 Prompt Files
- `docs/prompts/mobile/phase7-worker-a.prompt.md`
- `docs/prompts/mobile/phase7-worker-b.prompt.md`
- `docs/prompts/mobile/phase7-worker-c.prompt.md`

## Phase 7 Owner Freeze Files
- `shared/mobile/contracts/analytics_question_dropoff.v1.json`
- `shared/mobile/contracts/analytics_question_steps.v1.json`
- `shared/mobile/contracts/analytics_p0_funnel.v1.json`

## Phase 7 Review Gates
- `question_dropoff` may only use `questionnaire_view(step)` and `question_answered(step)` with session-level dedupe on `session_id + category + step`.
- Missing `step` or invalid category rows may not be silently backfilled into `question_dropoff`.
- New decision-entry links may not point to `/m/[category]/profile?step=1` without an explicit source when the entry surface is knowable.
- Shared helpers, not page-local string assembly, own decision-entry source propagation.
- No Phase 7 worker may modify `main`; accepted fixes still converge through `codex/mobile-arch-v2`.

## Phase 7 Merge Order
1. Architecture owner freezes the `question_dropoff` response contract.
2. Worker A lands backend aggregation plus first-screen dashboard cutover.
3. Worker B centralizes decision-entry href/source construction for decision-shell and global navigation surfaces.
4. Worker C retrofits utility-origin decision re-entry surfaces onto the shared helper after B lands.
5. Architecture owner reviews `question_dropoff`, source propagation, and branch readiness together.
6. Only after that: refresh the branch convergence checklist and start preparing the return path to `codex/mobile-arch-v2`.

## Phase 8 Deliverables
- `question_dropoff` question metadata resolves to shared decision-config truth rather than generic fallback labels wherever possible.
- Decision entry and continuation source vocabulary is frozen centrally instead of living as scattered string literals.
- Utility and me/history/bag continuation surfaces consume the frozen source vocabulary through shared helpers.
- Branch convergence can begin once owner freeze files are committed and raw source growth is gone.

## Phase 8 Prompt Files
- `docs/prompts/mobile/phase8-worker-a.prompt.md`
- `docs/prompts/mobile/phase8-worker-b.prompt.md`
- `docs/prompts/mobile/phase8-worker-c.prompt.md`

## Phase 8 Owner Freeze Files
- `shared/mobile/contracts/decision_entry_sources.v1.json`
- `shared/mobile/contracts/analytics_question_dropoff.v1.json`
- `shared/mobile/contracts/analytics_question_steps.v1.json`

## Phase 8 Review Gates
- `question_dropoff` may not trust free-text event props over shared decision config when category + step can be resolved.
- No new raw continuation or decision-entry source string may appear outside shared source helpers/constants.
- `me`, history, bag, wiki, and compare continuation surfaces must use the frozen source vocabulary.
- Owner freeze files must be committed before any branch-convergence work begins.

## Phase 8 Merge Order
1. Architecture owner freezes decision-entry and continuation source vocabulary.
2. Worker A canonicalizes question-dropoff question metadata from shared config.
3. Worker B centralizes frozen source constants/helper ownership for continuation flows.
4. Worker C retrofits utility and me/history/bag call sites onto the frozen source helper.
5. Architecture owner reviews source-vocabulary closure plus analytics metadata quality.
6. Only after that: refresh branch convergence checklist and begin preparing replay/cherry-pick onto `codex/mobile-arch-v2`.

## Phase 9 Deliverables
- Owner freeze docs reflect the post-Phase 8 reality: `question_dropoff` is live when valid stepful data exists, source vocabulary freeze is explicit, and branch facts match the real heads.
- Worker tasks shrink from broad module build-out to acceptance recheck plus thin contract-alignment cleanup.
- Equivalent deploy/config fixes already present on `codex/mobile-arch-v2` are recognized as converged even when the feature branch carries different hashes.
- The only accepted post-freeze product delta still missing on `codex/mobile-arch-v2` is the result renderer fix that keeps generated result copy authoritative.

## Phase 9 Prompt Files
- `docs/prompts/mobile/phase9-worker-a.prompt.md`
- `docs/prompts/mobile/phase9-worker-b.prompt.md`
- `docs/prompts/mobile/phase9-worker-c.prompt.md`

## Phase 9 Owner Freeze Files
- `shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `shared/mobile/contracts/analytics_question_steps.v1.json`
- `shared/mobile/contracts/decision_entry_sources.v1.json`
- `docs/mobile-branch-convergence-checklist.md`
- `docs/prompts/mobile/phase9-worker-a.prompt.md`
- `docs/prompts/mobile/phase9-worker-b.prompt.md`
- `docs/prompts/mobile/phase9-worker-c.prompt.md`

## Phase 9 Review Gates
- No Phase 9 worker may start new product-surface feature work; only acceptance recheck or thin contract-alignment cleanup is allowed.
- Equivalent fixes already present on `codex/mobile-arch-v2` or `main` may not be replayed again under new hashes.
- `question_dropoff` freeze docs must describe live-when-data-exists semantics, not a permanently blocked state.
- `SelectionPublishedResultFlow` must keep generated result fields such as `share_copy`, `display_order`, `blocks`, and `ctas` authoritative over page-local paraphrase logic.
- `m_me_use` may remain a utility-page analytics source only; it may not expand into decision-entry or continuation vocabulary without a new owner freeze.
- No Phase 9 worker may modify `main`; accepted fixes still converge through `codex/mobile-arch-v2`.

## Phase 9 Merge Order
1. Architecture owner refreshes freeze docs and the convergence delta map.
2. Worker B rechecks route-state and source-vocabulary closure against the frozen contracts.
3. Worker C rechecks utility and `me/history/bag` call sites against Worker B's shared helper truth.
4. Worker A rechecks P0 analytics contract consumption and live question-dropoff semantics on top of the refreshed freeze docs.
5. Architecture owner integrates the findings and decides the exact replay set for `codex/mobile-arch-v2`.
6. Only after that: move the accepted missing delta into `codex/mobile-arch-v2`, rerun the gate suite, and prepare the mainline sync.
