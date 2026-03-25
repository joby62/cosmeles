# Phase 18 Worker A Prompt

你是 Worker A，当前轮次是 phase-18，对应 `runtime-phase-4` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/deploy-dispatch.md`

当前目标：
- 作为 verification owner，补齐 phase-18 的 lag / fail / retry / recovery / acceptance 骨架。
- 本轮不抢 Worker B 的 job model / queue contract / worker execution truth 定义权。
- 本轮不越到 phase-19。
- 当前 yellow follow-up 的重点是把 `result build` 一并纳入 phase-18 acceptance，而不是只验证 compare / upload。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/workers/**`
- `/Users/lijiabo/Documents/New project/frontend/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 compare / upload / result build 的恢复 / 重试 / 状态追踪 acceptance 是否自洽
- 若需修复，只做 verification / acceptance 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

本轮优先检查：
- `selection_result_build` / product workbench 是否仍依赖 API executor/thread
- result-build job 的 queued/running/done/failed/retry/orphan reconciliation 是否有 acceptance 覆盖
- compare / upload / result build 三类长任务是否在同一套 phase-18 语义下自洽

升级给 Owner：
- Worker B 的 job truth / queue contract freeze 尚未形成，导致 acceptance 无法落地
- 当前修复已经越过 runtime-phase-4，必须提前进入 phase-19
- 你发现现有 seam 仍不足以支撑 job status / recovery acceptance
