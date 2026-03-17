# Mobile Branch Convergence Checklist

Frozen on: `2026-03-18`

## Purpose
- Converge the accepted mobile Phase 4-8 stack back into `codex/mobile-arch-v2`.
- Keep `main` coherent while the mobile refactor stack is still under owner-led integration.
- Prevent worker commits, owner freeze files, and unrelated user doc edits from being merged as one undifferentiated blob.

## Frozen Branch Facts
- Current feature integration branch: `codex/mobile-utility-route-state-loop` at `8140f47`
- Authoritative mobile integration branch: `codex/mobile-arch-v2` at `6192cf8`
- Local `main` at `4b4044c`
- `origin/main` at `56d328a`
- Divergence on `2026-03-18`:
  - `codex/mobile-utility-route-state-loop` is `17` commits ahead of `codex/mobile-arch-v2`
  - `codex/mobile-utility-route-state-loop` is `16` commits ahead of local `main`
  - `codex/mobile-utility-route-state-loop` is `16` commits ahead and `1` commit behind `origin/main`
  - local `main` is `1` commit behind `origin/main`

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
- `docs/prompts/mobile/worker-a-cleanroom-handoff.prompt.md`
- `docs/prompts/mobile/owner-architecture-cleanroom-handoff.prompt.md`

## Orphan Audit
- No accepted worker commit is currently found only on the wrong published branch.
- `origin/codex/mobile-utility-route-state-loop` points at `8140f47`, so the accepted worker stack is published on the intended feature integration branch.
- Current owner freeze files are working-tree artifacts, not orphan commits; they must be committed deliberately before convergence starts.
- There is still a prunable worktree record at `/private/tmp/cosmeles-wiki-verify`; this is hygiene debt, not a merge blocker.

## Active Blockers
- Owner freeze files are not yet committed, so the convergence stack is still split between git history and working tree state.
- Unrelated user-owned docs remain dirty:
  - `README.md`
  - `frontend/README.md`
  - `docs/mobile-decision-prd-v1.md`
- `main` must not become the first place where the Phase 4-8 stack is integrated.

## Convergence Checklist

### 1. Owner Working Tree Split
- [ ] Commit the owner freeze stack on `codex/mobile-utility-route-state-loop` without mixing unrelated user doc edits.
- [ ] Keep `README.md`, `frontend/README.md`, and `docs/mobile-decision-prd-v1.md` out of the mobile convergence commit set unless explicitly approved.
- [ ] Preserve reviewable separation where possible:
  - owner freeze contracts and shared contract updates
  - owner playbook/checklist/prompt files
  - any later owner integration fix

### 2. Worker Stack Acceptance Recheck
- [ ] Re-review the accepted worker stack against current contracts:
  - `shared/mobile/contracts/route_state.json`
  - `shared/mobile/contracts/selection_result.v3.json`
  - `shared/mobile/contracts/analytics_events.json`
  - `shared/mobile/contracts/analytics_p0_funnel.v1.json`
  - `shared/mobile/contracts/analytics_question_steps.v1.json`
  - `shared/mobile/contracts/analytics_question_dropoff.v1.json`
  - `shared/mobile/contracts/decision_entry_sources.v1.json`
- [ ] Confirm Phase 8 removed raw continuation source growth outside shared source helpers.
- [ ] Confirm `question_dropoff` metadata resolves to shared decision config truth when `category + step` are valid.
- [ ] Confirm no worker change reintroduces legacy query writes or page-local continuation truth.

### 3. Integration Into `codex/mobile-arch-v2`
- [ ] Move the accepted worker stack plus owner freeze commits back into `codex/mobile-arch-v2`.
- [ ] Re-run integration gates on the receiving branch:
  - `frontend`: `npm run sync:mobile-decision`
  - `frontend`: `npx next typegen`
  - `frontend`: `npx tsc --noEmit`
  - `frontend`: `npm run lint`
  - `frontend`: `npm run build`
  - `backend`: `PYTHONPATH='.../New project:.../New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- [ ] Verify `/m`, `/m/choose`, `profile`, `result`, `wiki`, `compare`, `me`, and `/analytics` still obey the frozen contracts.

### 4. Sync Against `origin/main`
- [ ] Fetch and review the one extra commit currently on `origin/main` from `codex/mobile-arch-v2`, not from `main`.
- [ ] Resolve conflicts on `codex/mobile-arch-v2`, not on `main`.
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
- [ ] Only then merge the reviewed milestone into `main` and deploy via `docker-compose.prod.yml`.

## Owner Note
- Phase 8 worker work is accepted; the remaining work is owner convergence, not another round of broad feature implementation.
- Until owner freeze files are committed, this branch remains a staging stack rather than the long-term architecture branch truth.
- Production deployment stays `main`-only; no direct deploy from `codex/mobile-utility-route-state-loop`.
