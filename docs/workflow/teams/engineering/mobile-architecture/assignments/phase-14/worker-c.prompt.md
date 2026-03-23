# Phase 14 Worker C Prompt

你是 Worker C，当前轮次是 phase-14，对应 `runtime-phase-0` 的 minimal caller / config / compose adoption。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 seam 之后，接最小 caller / config / compose adoption。
- 本轮不切产品行为，不切真正的 `assets/api/www` 分域，不切对象存储或 PostgreSQL 真后端。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

等待条件：
- `waiting for Worker B green`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/**`

建议起手：
- 先等 Worker B 给 `green`
- 再看 `frontend/lib/api.ts` 和 `frontend/next.config.ts`
- 最后做 compose / env wiring 的最小 adoption

交付标准：
- frontend/runtime caller 已具备 profile-aware origin / asset wiring 的最小骨架
- compose 已能承接下一 phase 的 `web/api/worker/postgres` 分离，不强行切行为
- 不去反向决定 backend seam，也不顺手改页面体验

必须验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

升级给 Owner：
- Worker B 的 seam 不足以支撑 frontend/runtime adoption
- compose/profile skeleton 必须连带 backend 启动方式一起调整，超出本轮 scope
- 当前 wiring 会导致产品页面行为变化或 mixed-content / proxy 行为回退
