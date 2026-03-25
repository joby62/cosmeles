# Phase 20 Worker C Prompt

你是 Worker C，当前轮次是 phase-20，对应 `runtime-phase-6` 的 deployment / rollout wiring owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 rollout 真相后，接 worker pool、DB/API/Web split wiring、compose/env/LB/profile adoption 与 smoke。
- 本轮不重开 selection-result / job truth，不重开 phase-19 的 PG / Redis capability semantics。
- 本轮必须遵守固定顺序：`worker -> db -> api -> web`。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

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

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确多机 deployment/profile wiring 是否已遵守固定顺序且不依赖单机假设
- 若需修复，只做 config / wiring / smoke 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`

升级给 Owner：
- Worker B 的 rollout truth 冻结不足以支撑 deployment / LB adoption
- 当前 wiring 修复已经超出 phase-20，必须新增路线图阶段
- 你发现 deployment profile 仍耦合单机假设或违反固定拆机顺序
