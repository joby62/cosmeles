# Phase 16 Worker B Prompt

你是 Worker B，当前轮次是 phase-16，对应 `runtime-phase-2` 的 storage / asset truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/deploy-dispatch.md`

当前目标：
- 先冻结 object storage contract、asset public URL、object key 规则、signed URL 语义。
- 先收 backend storage adapter 与 asset URL generation 的边界，不提前切 phase-17 之后的 PostgreSQL/job 真相。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/storage.py`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 object storage / asset URL / signed URL contract 是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/main.py app/routes/mobile.py app/routes/mobile_selection.py app/routes/ingest.py app/services/storage.py app/platform/storage_backend.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- phase-16 若不先补 storage adapter / public URL 规则，frontend 无法安全 adoption
- 当前修复已经越过 object storage / CDN 语义，必须提前进入 phase-17
- 你发现现有 seam 还不足以支撑 asset truth 切换
