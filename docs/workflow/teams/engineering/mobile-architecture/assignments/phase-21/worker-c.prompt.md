# Phase 21 Worker C Prompt

你是 Worker C，当前轮次是 phase-21，对应 `postgresql-phase-0` 的 adoption / deploy owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 PostgreSQL 真相后，盘清 env / compose / runtime / frontend 管理台与工作台的 adoption 影响面。
- 明确 phase-22 若把 PostgreSQL 提升为生产默认值，哪些 profile / config / browser-side assumption 需要同步变化。
- 本轮不抢 Worker B 的真相定义权，不提前大面积改 default。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

等待条件：
- `waiting for Worker B green`

写入范围：
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`
- `/Users/lijiabo/Documents/New project/frontend/Dockerfile.prod`
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 PostgreSQL 默认化后哪些 deployment/profile/config 需要改
- 若需修复，只做 adoption inventory / config / smoke 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`

升级给 Owner：
- Worker B 的 PostgreSQL truth 冻结不足以支撑 env / compose / runtime adoption
- 当前 adoption 影响面已经超出 phase-22，需要更细 phase 切分
- 你发现仍存在浏览器或 deploy profile 对 SQLite / `app.db` 的隐藏单机假设
