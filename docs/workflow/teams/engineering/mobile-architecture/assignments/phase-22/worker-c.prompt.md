# Phase 22 Worker C Prompt

你是 Worker C，当前轮次是 phase-22，对应 `postgresql-phase-1` 的 adoption / deploy owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-22/deploy-dispatch.md`

当前目标：
- 第一阶段先做 adoption preflight：
  - env / compose / runtime / frontend 管理台与工作台的 profile/config 影响面
  - browser-side API/request chain 是否依赖旧默认值
- 第二阶段在 Worker B `green` 后，把 config/profile adoption 收束到 phase-22 truth。
- 本轮不抢 Worker B 的 truth 定义权。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

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
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 第一阶段说明 adoption preflight 是否完整
- 若进入第二阶段，说明 phase-22 truth 下的 profile/config 是否已收束

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
