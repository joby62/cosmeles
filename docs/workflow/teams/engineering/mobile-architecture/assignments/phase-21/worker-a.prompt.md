# Phase 21 Worker A Prompt

你是 Worker A，当前轮次是 phase-21，对应 `postgresql-phase-0` 的 verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/deploy-dispatch.md`

当前目标：
- 作为 verification owner，冻结 PostgreSQL 全迁移需要的 bootstrap / downgrade / parity / empty-state / consistency acceptance。
- 盘清当前 tests 中哪些仍默认依赖 SQLite，哪些必须在 phase-22 之后转成 PostgreSQL-first acceptance。
- 本轮不抢 Worker B 的 PostgreSQL truth 定义权。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/**`
- `/Users/lijiabo/Documents/New project/frontend/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 phase-22 前必须补齐的 acceptance 列表
- 明确 clean-start、downgrade、parity、consistency 是否已可执行

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- Worker B 的 PG 真相冻结尚未形成，导致 acceptance 无法落地
- 当前 acceptance 需要新增路线图阶段，而不是 phase-22 即可解决
- 你发现 SQLite 与 PostgreSQL 会在 phase-22 形成不可接受的长期双在线真相
