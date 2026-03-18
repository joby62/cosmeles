# Mobile Branch Convergence Checklist

Frozen on: `2026-03-18`
Refreshed on: `2026-03-18`

## Purpose
- Converge the accepted mobile Phase 4-9 stack back into `codex/mobile-arch-v2`.
- Keep `main` coherent while the mobile refactor stack is still under owner-led integration.
- Prevent worker commits, owner freeze files, and unrelated user doc edits from being merged as one undifferentiated blob.
- Distinguish true missing deltas from equivalent fixes that already landed on the architecture branch under different hashes.

## Frozen Branch Facts
- Current feature integration branch: `codex/mobile-utility-route-state-loop` at `acd6c21`
- Authoritative mobile integration branch: `codex/mobile-arch-v2` at `d9a1d90`
- Local `main` at `f7e0007`
- `origin/main` at `f7e0007`
- Divergence on `2026-03-18`:
  - `codex/mobile-utility-route-state-loop` is `3` commits ahead and `4` commits behind `codex/mobile-arch-v2`
  - `codex/mobile-utility-route-state-loop` is `3` commits ahead and `5` commits behind local `main`
  - `codex/mobile-utility-route-state-loop` is `3` commits ahead and `5` commits behind `origin/main`
  - `codex/mobile-arch-v2` is `1` commit behind local `main`

## Delta Map
- Equivalent fixes already present on the authoritative branches under different hashes:
  - `beeba32` on `codex/mobile-utility-route-state-loop` is equivalent to `8eea4fe` on `codex/mobile-arch-v2`
  - `309281e` on `codex/mobile-utility-route-state-loop` is equivalent to `d9a1d90` on `codex/mobile-arch-v2`
- Accepted post-freeze product delta still missing on `codex/mobile-arch-v2`:
  - `acd6c21` on `codex/mobile-utility-route-state-loop`
  - equivalent `main` commit: `f7e0007`
  - scope: `frontend/components/mobile/SelectionPublishedResultFlow.tsx`
  - intent: respect generated result copy, `display_order`, `blocks`, and CTA semantics instead of re-summarizing in page-local logic

## Accepted Commit Stack
- Phase 4
  - `27009c1` `feat(mobile): unify utility route-state loop closure`
  - `f38c3ea` `refactor(mobile): unify utility route-state hops for wiki/compare`
  - `d92fea7` `feat(analytics): cut over dashboard to decision-result vocabulary`
  - `16a0e2b` `feat(mobile): unify me continuation across history and bag`
- Phase 5
  - `7c226e6` `refactor(mobile): prune utility legacy adapter writes`
  - `55cc2df` `refactor(mobile): thin me history and bag around shared continuation`
  - `f4f9ddb` `feat(analytics): align phase5 p0 first-screen contract`
- Phase 6
  - `0a028c5` `fix(analytics): use session dedupe for p0 *_sessions metrics`
  - `d9bfc50` `refactor(mobile): centralize utility return tracking payloads`
  - `5ce9e5d` `feat(mobile): centralize decision question-step analytics`
- Phase 7
  - `6516b11` `feat(analytics): make question_dropoff live on p0 first-screen`
  - `c6c2824` `refactor(mobile): centralize decision entry href and source`
  - `8827ffc` `refactor(mobile): propagate utility re-entry source via shared helper`
- Phase 8
  - `f896405` `refactor(mobile): centralize decision entry and continuation source vocabulary`
  - `60dced8` `feat(analytics): canonicalize question_dropoff metadata via shared config`
  - `8140f47` `refactor(mobile): adopt frozen continuation source helper in me panels`
- Phase 9 owner refresh
  - `d169486` `docs(mobile): freeze phase4-8 convergence artifacts`
  - pending owner refresh commit: bring branch facts, prompt files, and analytics freeze docs up to the post-Phase 8 baseline

## Owner Freeze Stack
- `shared/mobile/contracts/analytics_p0_funnel.v1.json`
- `shared/mobile/contracts/analytics_question_steps.v1.json`
- `shared/mobile/contracts/analytics_question_dropoff.v1.json`
- `shared/mobile/contracts/decision_entry_sources.v1.json`
- `shared/mobile/contracts/analytics_events.json`
- `shared/mobile/contracts/route_state.json`
- `docs/mobile-refactor-playbook.md`
- `docs/mobile-branch-convergence-checklist.md`
- `docs/prompts/mobile/phase4-worker-a.prompt.md`
- `docs/prompts/mobile/phase4-worker-b.prompt.md`
- `docs/prompts/mobile/phase4-worker-c.prompt.md`
- `docs/prompts/mobile/phase5-worker-a.prompt.md`
- `docs/prompts/mobile/phase5-worker-a-active-task.prompt.md`
- `docs/prompts/mobile/phase5-worker-b.prompt.md`
- `docs/prompts/mobile/phase5-worker-c.prompt.md`
- `docs/prompts/mobile/phase6-worker-a.prompt.md`
- `docs/prompts/mobile/phase6-worker-b.prompt.md`
- `docs/prompts/mobile/phase6-worker-c.prompt.md`
- `docs/prompts/mobile/phase7-worker-a.prompt.md`
- `docs/prompts/mobile/phase7-worker-b.prompt.md`
- `docs/prompts/mobile/phase7-worker-c.prompt.md`
- `docs/prompts/mobile/phase8-worker-a.prompt.md`
- `docs/prompts/mobile/phase8-worker-b.prompt.md`
- `docs/prompts/mobile/phase8-worker-c.prompt.md`
- `docs/prompts/mobile/phase9-worker-a.prompt.md`
- `docs/prompts/mobile/phase9-worker-b.prompt.md`
- `docs/prompts/mobile/phase9-worker-c.prompt.md`
- `docs/prompts/mobile/worker-a-cleanroom-handoff.prompt.md`
- `docs/prompts/mobile/owner-architecture-cleanroom-handoff.prompt.md`

## Orphan Audit
- No accepted worker commit is currently found only on the wrong published branch.
- `origin/codex/mobile-utility-route-state-loop` points at `309281e`, so only the result renderer fix commit `acd6c21` remains unpublished on the feature integration branch.
- Owner freeze files already exist in git history via `d169486`; this refresh is about accuracy, not first-time commit creation.
- There is still a prunable worktree record at `/private/tmp/cosmeles-wiki-verify`; this is hygiene debt, not a merge blocker.

## Active Blockers
- `codex/mobile-arch-v2` still lacks the result renderer fix that `main` already carries as `f7e0007`.
- Equivalent deploy/config fixes exist on feature and architecture branches under different hashes, so convergence must reason by diff instead of replaying by commit id.
- Unrelated user-owned docs remain dirty:
  - `README.md`
  - `frontend/README.md`
  - `docs/mobile-decision-prd-v1.md`
- `main` must not become the first place where the refreshed owner convergence review happens.

## Convergence Checklist

### 1. Owner Freeze Accuracy
- [ ] Keep `README.md`, `frontend/README.md`, and `docs/mobile-decision-prd-v1.md` out of the mobile convergence commit set unless explicitly approved.
- [ ] Keep the owner refresh commit reviewable:
  - analytics freeze contract corrections
  - playbook/checklist refresh
  - Phase 9 worker prompt files
- [ ] Treat `question_dropoff` as "live when valid stepful data exists"; blocked now means missing valid data in the selected time window, not undefined step semantics.

### 2. Worker Stack Acceptance Recheck
- [ ] Re-review the accepted worker stack against current contracts:
  - `shared/mobile/contracts/route_state.json`
  - `shared/mobile/contracts/selection_result.v3.json`
  - `shared/mobile/contracts/analytics_events.json`
  - `shared/mobile/contracts/analytics_p0_funnel.v1.json`
  - `shared/mobile/contracts/analytics_question_steps.v1.json`
  - `shared/mobile/contracts/analytics_question_dropoff.v1.json`
  - `shared/mobile/contracts/decision_entry_sources.v1.json`
- [ ] Confirm Worker B closure: no new decision-entry or continuation source strings exist outside shared helpers/constants.
- [ ] Confirm Worker C closure: utility and `me/history/bag` call sites no longer pass raw continuation source strings; the only intentional remaining exception is `m_me_use`, and it stays page-analytics-only.
- [ ] Confirm Worker A closure: `question_dropoff_top`, `question_dropoff_by_category`, and `question_dropoff_status` are the actual first-screen contract keys and metadata resolves from shared decision config when `category + step` are valid.
- [ ] Confirm no worker change reintroduces legacy query writes, page-local continuation truth, or hardcoded result-page paraphrase logic.

### 3. Integration Into `codex/mobile-arch-v2`
- [ ] If the primary worktree remains dirty with user-owned docs, use the clean worktree at `/private/tmp/mobile-arch-v2-converge` for replay into `codex/mobile-arch-v2`.
- [ ] Move only the accepted missing delta into `codex/mobile-arch-v2`:
  - `frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- [ ] Do not replay `beeba32` or `309281e`; `codex/mobile-arch-v2` already contains their equivalents as `8eea4fe` and `d9a1d90`.
- [ ] Re-run integration gates on the receiving branch:
  - `frontend`: `npm run sync:mobile-decision`
  - `frontend`: `npx next typegen`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint`
  - `frontend`: `npm run build`
  - `backend`: `PYTHONPATH='.../New project:.../New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- [ ] Verify `/m`, `/m/choose`, `profile`, `result`, `wiki`, `compare`, `me`, and `/analytics` still obey the frozen contracts.

### 4. Sync Against `origin/main`
- [ ] After `codex/mobile-arch-v2` carries the accepted result renderer fix, verify it matches the intent already live on `main` via `f7e0007`.
- [ ] Resolve conflicts on `codex/mobile-arch-v2`, not on `main`.
- [ ] Ensure no duplicate replay of already-converged deploy/config fixes is introduced during sync.
- [ ] Re-run the same gate suite after sync.

### 5. Mainline Decision Gate
- [ ] Confirm `codex/mobile-arch-v2` is the reviewed source of truth, not the worker feature branch.
- [ ] Confirm no unresolved dirty files remain in the intended merge set.
- [ ] Confirm the owner freeze files are committed and still accurate:
  - `shared/mobile/contracts/analytics_p0_funnel.v1.json`
  - `shared/mobile/contracts/analytics_question_steps.v1.json`
  - `shared/mobile/contracts/analytics_question_dropoff.v1.json`
  - `shared/mobile/contracts/decision_entry_sources.v1.json`
  - `docs/mobile-branch-convergence-checklist.md`
- [ ] Confirm the replay set is still narrow: result renderer fix only, not duplicated deploy/config cherry-picks.
- [ ] Only then merge the reviewed milestone into `main` and deploy via `docker-compose.prod.yml`.

## Owner Note
- Phase 8 worker work is accepted; the remaining work is owner convergence plus narrow acceptance recheck, not another round of broad feature implementation.
- The architecture branch already contains the accepted deploy/config fixes; the result renderer fix is the only missing accepted delta that still needs replay onto `codex/mobile-arch-v2`.
- Production deployment stays `main`-only; no direct deploy from `codex/mobile-utility-route-state-loop`.
