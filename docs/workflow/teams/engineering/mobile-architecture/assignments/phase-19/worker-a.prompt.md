# Phase 19 Worker A Prompt

你是 Worker A，当前轮次是 phase-19，对应 `runtime-phase-5` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/deploy-dispatch.md`

当前目标：
- 作为 verification owner，补齐 phase-19 的 lock / cache / pool / downgrade / single-node compatibility acceptance。
- 本轮不抢 Worker B 的 external PG / Redis truth 定义权。
- 本轮不越到 phase-20。

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
- 明确 lock / cache / pool / downgrade / single-node compatibility acceptance 是否自洽
- 若需修复，只做 verification / acceptance 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- Worker B 的 capability boundary freeze 尚未形成，导致 acceptance 无法落地
- 当前修复已经越过 runtime-phase-5，必须提前进入 phase-20
- 你发现现有 seam 仍不足以支撑 lock/cache/downgrade acceptance
