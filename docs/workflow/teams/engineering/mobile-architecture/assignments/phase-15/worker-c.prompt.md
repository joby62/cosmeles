# Phase 15 Worker C Prompt

你是 Worker C，当前轮次是 phase-15，对应 `runtime-phase-1` 的 compose / wiring / smoke adoption。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 API / worker 边界后，接单机四模块的 compose / wiring adoption。
- 本轮不切 `www/api/assets` 正式三域，不切对象存储和 PostgreSQL 单真相。

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

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确单机四模块编排、SSE 与普通页面烟测是否可跑
- 若需修复，只做 compose / wiring 范围修复

必须验证：
- `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

升级给 Owner：
- Worker B 的拓扑冻结不足以支撑四模块编排
- 当前 wiring 修复已经需要改 backend truth seam
- 你发现 phase-15 实际已经越到 phase-16
