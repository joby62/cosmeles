# Phase 16 Worker C Prompt

你是 Worker C，当前轮次是 phase-16，对应 `runtime-phase-2` 的 compose / wiring / asset adoption。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 object storage / asset URL 语义后，接 `www / api / assets` 的 compose / wiring / smoke adoption。
- 本轮不切 selection result PostgreSQL 单真相，不切真实 job system，不切 Redis。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

等待条件：
- `waiting for Worker B green`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/frontend/Dockerfile.prod`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 `www / api / assets` wiring、上传/图片/public artifact smoke 是否可跑
- 若需修复，只做 compose / wiring 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

升级给 Owner：
- Worker B 的 storage freeze 不足以支撑 asset adoption
- 当前 wiring 修复已经需要改 backend truth seam 之外的真相层
- 你发现 phase-16 实际已经越到 phase-17
