# Phase 17 Worker B Prompt

你是 Worker B，当前轮次是 phase-17，对应 `runtime-phase-3` 的 selection-result truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/deploy-dispatch.md`

当前目标：
- 先完成 phase-17 yellow follow-up 的真相收口。
- 把 selection-result PG payload model、live profile contract、runtime observability、artifact-copy-only 语义统一到一套 freeze。
- 保留对象存储 artifact 作为发布/归档副本，但不允许在线读路径继续依赖本地文件，也不允许 deploy surface 继续冒充 `local_fs` 在线真相。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_results.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile_selection.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 selection-result PG 真相、live profile contract、runtime observability、artifact 副本策略是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/db/models.py app/db/init_db.py app/routes/mobile.py app/routes/mobile_selection.py app/services/mobile_selection_results.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

本轮优先检查：
- `.env.single-node.example`、`.env.split-runtime.example`、`.env.multi-node.example` 是否仍错误冻结 `SELECTION_RESULT_REPOSITORY_BACKEND=local_fs`
- `docker-compose.dev.yml` 与 `docker-compose.prod.yml` 是否仍把 phase-17 live contract 展开成 `local_fs`
- `runtime_profile` / `healthz` / adapter 测试是否仍把 selection-result backend 暴露成 `local_fs`
- 若 phase-17 语义实际已经从 “repository backend” 变成 “PG online truth + artifact copy policy”，需要把 deploy/health contract 一起说清楚

升级给 Owner：
- phase-17 若不先冻结 PG payload model 与 cutover 顺序，caller adoption 无法安全继续
- 当前修复已经越过 selection-result 单真相，必须提前进入 phase-18
- 你发现现有 seam 仍不足以支撑 selection-result PG 直读
