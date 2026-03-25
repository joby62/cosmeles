# Phase 23 Worker C Prompt

你是 Worker C，当前轮次是 phase-23，对应 `postgresql-phase-2` 的 adoption / replay owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/deploy-dispatch.md`

当前目标：
- 第一阶段先做 adoption / replay preflight：
  - 管理台 / 工作台 / 产品后台 / upload 相关 caller 与后台接口影响面
  - 如果上游表组从 SQLite 切到 PostgreSQL，哪些 call-site / replay / smoke / maintenance 需要同步
  - 允许 scoped diff = 0，但要明确说明
- 第二阶段在 Worker B `green` 后，把 call-site adoption / replay / smoke 结论收束到 phase-23 truth。
- 本轮不抢 Worker B 的表组真相定义权。
- 本轮不提前进入 `phase-24`。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/app/product/**`
- `/Users/lijiabo/Documents/New project/frontend/app/upload/**`
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 第一阶段说明 adoption/replay preflight 是否完整
- 若进入第二阶段，说明 phase-23 truth 下的 call-site adoption 是否已收束

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
