# Phase 18 Worker B Prompt

你是 Worker B，当前轮次是 phase-18，对应 `runtime-phase-4` 的 long-task truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/deploy-dispatch.md`

当前目标：
- 先冻结 compare / upload / result build 的 job model、queue contract、worker execution truth、SSE status read model。
- API 只创建 job，worker 执行；不允许继续把真实执行线程绑在 API 进程里。
- 本轮不切 Redis，不切 phase-19。
- 当前 yellow follow-up 的重点是 product workbench / `selection_result_build` 必须纳入 phase-18 同一套 worker truth。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/workers/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/services/**`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`
- `/Users/lijiabo/Documents/New project/backend/app/db/**`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 job truth、queue contract、worker execution truth、SSE status read model 是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/routes/mobile.py app/routes/ingest.py app/routes/products.py app/services/mobile_selection_results.py app/settings.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

本轮优先检查：
- `backend/app/routes/products.py` 中的 `PRODUCT_WORKBENCH_EXECUTOR` 与 `_submit_product_workbench_job`
- `selection_result_build` 是否仍由 API 进程直接执行
- runtime worker daemon capabilities 是否覆盖 product workbench / result build
- compare / upload / result build 是否已经统一到同一套 queue / worker execution truth

升级给 Owner：
- phase-18 若不先冻结 job model 与 execution truth，caller adoption 无法安全继续
- 当前修复已经越过 runtime-phase-4，必须提前进入 phase-19
- 你发现现有 queue seam 仍不足以支撑 durable job + worker 执行
