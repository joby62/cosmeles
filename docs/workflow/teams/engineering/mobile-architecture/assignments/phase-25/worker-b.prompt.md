# Phase 25 Worker B Prompt

你是 Worker B，当前轮次是 phase-25，对应 `postgresql-phase-4` 的 truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-25/deploy-dispatch.md`

当前目标：
- 第一阶段先落 phase-25 final SQLite closure truth：
  - production profile 不再存在剩余 SQLite 在线结构化真相
  - single_node 明确为 `dev_or_emergency_fallback`
  - SQLite downgrade / fallback 必须是显式 closure 语义，而不是隐式 production 默认
  - runtime / startup / settings / observability 对上述事实可验证
- 第二阶段给 A/C 一个 freeze-compatible 的最终真相边界。
- 本轮不重开 phase-22 到 phase-24 表组迁移。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`
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
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py app/db/session.py app/db/init_db.py app/db/models.py app/platform/runtime_profile.py app/main.py app/routes/mobile.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests`
