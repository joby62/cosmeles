# Phase 15 Worker B Prompt

你是 Worker B，当前轮次是 phase-15，对应 `runtime-phase-1` 的 backend topology truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/deploy-dispatch.md`

当前目标：
- 先拆 API / worker 入口与职责边界，确保 worker 不再寄生 API 进程。
- 先收 DB 连接策略与单机 `postgres` 适配位，不提前切 phase-16 之后的云化真相。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/**`
- `/Users/lijiabo/Documents/New project/backend/tests/**`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 API / worker 入口、职责、DB 连接策略是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/main.py app/routes/mobile.py app/routes/mobile_selection.py app/routes/ingest.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- phase-15 若不先补 DB / process topology，worker 无法从 API 中拆出
- 当前修复已经越过单机模块化，必须提前进入 phase-16
- 你发现现有 seam 还不足以支撑 API / worker 入口拆分
