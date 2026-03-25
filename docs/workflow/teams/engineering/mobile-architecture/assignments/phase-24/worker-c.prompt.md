# Phase 24 Worker C Prompt

你是 Worker C，当前轮次是 phase-24，对应 `postgresql-phase-3` 的 adoption / replay owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-24/deploy-dispatch.md`

当前目标：
- 第一阶段先做移动端 state adoption / replay preflight：
  - `/m/me`
  - `/m/me/history`
  - `/m/me/bag`
  - compare / upload user-state 相关入口
  - mobile state 恢复、继续、回放、清理面
- 第二阶段在 Worker B `green` 后，把 mobile call-site adoption / replay / smoke 收束到 phase-24 truth。
- 本轮不抢 Worker B 的移动端状态真相定义权。
- 本轮不提前进入 `phase-25`。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/m/**`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/**`
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 第一阶段说明 adoption/replay preflight 是否完整
- 若进入第二阶段，说明 phase-24 truth 下的 mobile call-site adoption 是否已收束

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
