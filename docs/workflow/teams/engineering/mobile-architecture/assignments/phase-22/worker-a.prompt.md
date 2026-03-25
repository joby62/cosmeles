# Phase 22 Worker A Prompt

你是 Worker A，当前轮次是 phase-22，对应 `postgresql-phase-1` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-22/deploy-dispatch.md`

当前目标：
- 第一阶段先冻结 PostgreSQL-default acceptance baseline：
  - startup / readiness
  - downgrade demotion
  - clean-start
  - profile parity
- 第二阶段在 Worker B `green` 后，把 acceptance 收束到 phase-22 truth。
- 本轮不抢 Worker B 的 production-default PostgreSQL 真相定义权。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确第一阶段 acceptance baseline 是否成立
- 若进入第二阶段，明确 phase-22 truth 下 acceptance 是否已收束

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
