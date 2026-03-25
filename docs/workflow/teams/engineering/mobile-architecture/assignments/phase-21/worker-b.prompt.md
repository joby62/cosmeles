# Phase 21 Worker B Prompt

你是 Worker B，当前轮次是 phase-21，对应 `postgresql-phase-0` 的 truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/deploy-dispatch.md`

当前目标：
- 盘清剩余 SQLite 结构化真相面。
- 冻结 PostgreSQL target boundary、迁移分组、engine/session/init/default contract。
- 明确哪些表应该先迁，哪些表必须留到后续 phase。
- 给 Worker C 一个清晰的 `go` 或 `hold`。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`
- `/Users/lijiabo/Documents/New project/backend/app/services/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile_selection.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确剩余 SQLite 真相面与 phase-22 目标边界是否已冻结
- 给 Worker C 一个清晰的 `go` 或 `hold`

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py app/db/session.py app/db/init_db.py app/db/models.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- 如果不新开更细的子路线，phase-22 的 cutover 会跨越过多 bounded context
- 当前 remaining SQLite surface 超出既有 runtime seam，必须先补 architecture truth
- 你发现 PostgreSQL 全迁移会强行牵出 storage/object/CDN scope
