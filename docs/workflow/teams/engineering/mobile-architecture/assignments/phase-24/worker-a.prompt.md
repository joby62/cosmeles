# Phase 24 Worker A Prompt

你是 Worker A，当前轮次是 phase-24，对应 `postgresql-phase-3` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-24/deploy-dispatch.md`

当前目标：
- 第一阶段先冻结 phase-24 acceptance baseline：
  - state continuity
  - resume / history / bag parity
  - cleanup / empty-state
  - worker/api consistency for the mobile-state table group
- 第二阶段在 Worker B `green` 后，把 acceptance 收束到 phase-24 truth。
- 本轮不抢 Worker B 的移动端状态真相定义权。
- 本轮不提前扩到 `phase-25` 的 SQLite closure。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确第一阶段 acceptance baseline 是否成立
- 若进入第二阶段，明确 phase-24 truth 下 acceptance 是否已收束

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests`
