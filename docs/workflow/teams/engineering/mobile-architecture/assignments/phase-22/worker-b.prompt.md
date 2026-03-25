# Phase 22 Worker B Prompt

你是 Worker B，当前轮次是 phase-22，对应 `postgresql-phase-1` 的 truth owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-22/deploy-dispatch.md`

当前目标：
- 第一阶段先落 production-default PostgreSQL contract：
  - `DATABASE_URL` 生产默认 driver
  - `DB_DOWNGRADE_TO_SQLITE_ON_ERROR` 生产 demotion
  - `SessionLocal` / active engine / init bootstrap contract
- 第二阶段给 A/C 一个 freeze-compatible 的最终真相。
- 本轮不提前切 `phase-23 / phase-24` 的具体表组 payload。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/db/**`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`
- `/Users/lijiabo/Documents/New project/backend/app/platform/runtime_profile.py`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 第一阶段明确 truth freeze 是否成立
- 给 Worker A / Worker C 一个清晰的第二阶段收束边界

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py app/db/session.py app/db/init_db.py app/db/models.py app/platform/runtime_profile.py`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
