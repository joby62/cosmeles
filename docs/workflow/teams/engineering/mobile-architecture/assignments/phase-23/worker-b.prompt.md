# Phase 23 Worker B Prompt

你是 Worker B，当前轮次是 phase-23，对应 `postgresql-phase-2` 的 truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/deploy-dispatch.md`

当前目标：
- 第一阶段先落 phase-23 高并发表组的 PG-only online truth：
  - `products`
  - `ingredient_library_index`
  - `ingredient_library_alias_index`
  - `ingredient_library_redirects`
  - `ingredient_library_build_jobs`
  - `upload_ingest_jobs`
  - `product_workbench_jobs`
  - `ai_jobs`
  - `ai_runs`
  - `product_route_mapping_index`
  - `product_analysis_index`
  - `product_featured_slots`
- 收口对应 repository / service / route 的在线读写路径，不允许继续长期维持 SQLite 在线读写真相。
- 第二阶段给 A/C 一个 freeze-compatible 的最终真相边界。
- 本轮不提前切 `phase-24` 的 mobile state 表组。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 第一阶段明确 truth freeze 是否成立
- 给 Worker A / Worker C 一个清晰的第二阶段收束边界

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py app/db/session.py app/db/init_db.py app/db/models.py app/platform/runtime_profile.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests`
