# Phase 19 Worker B Prompt

你是 Worker B，当前轮次是 phase-19，对应 `runtime-phase-5` 的 capability truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/deploy-dispatch.md`

当前目标：
- 先冻结 external PG / Redis adapter、lock/cache contract、pool config、downgrade 语义。
- 数据库继续是唯一真相；Redis 只做锁和缓存。
- 本轮不切多机拆分，不提前进入 phase-20。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/**`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 external PG / Redis 的边界、adapter 语义、开关与 downgrade 是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- phase-19 若不先冻结 capability boundary，deployment profile adoption 无法安全继续
- 当前修复已经越过 runtime-phase-5，必须提前进入 phase-20
- 你发现现有 adapter seam 仍不足以支撑 external PG / Redis
