# Phase 20 Worker A Prompt

你是 Worker A，当前轮次是 phase-20，对应 `runtime-phase-6` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/deploy-dispatch.md`

当前目标：
- 作为 verification owner，补齐 phase-20 的 dark-start / readiness / rollback / alertability / consistency acceptance。
- 本轮不抢 Worker B 的多机 rollout truth 定义权。
- 本轮不重开 phase-19 的 PG / Redis capability semantics。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 dark-start / readiness / rollback / alertability / consistency acceptance 是否自洽
- 若需修复，只做 verification / acceptance 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- Worker B 的 rollout truth freeze 尚未形成，导致 acceptance 无法落地
- 当前修复超出 phase-20，必须新增路线图阶段
- 你发现现有 seam 仍不足以支撑多机 rollout / rollback acceptance
