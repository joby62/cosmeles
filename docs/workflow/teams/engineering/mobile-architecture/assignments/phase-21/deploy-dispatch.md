---
doc_id: mobile-phase-21-deploy-dispatch
title: Mobile Phase 21 Deploy Dispatch
doc_type: assignment
initiative: mobile
workstream: workflow
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
related_docs:
  - mobile-postgresql-full-migration-plan-v1
  - mobile-architecture-v2
---

# Phase 21 Deploy Dispatch

phase-21 对应 `postgresql-phase-0`，目标不是直接改完所有代码，而是把“剩余 SQLite 结构化真相如何完整迁入 PostgreSQL”先冻结成唯一可执行真相。

本轮只做 4 类事：
- 盘清当前仍由默认数据库承载的结构化表、读写路径、启动 contract
- 冻结 PostgreSQL 全迁移边界、迁移分组、cutover 顺序
- 冻结 acceptance：bootstrap、parity、downgrade、empty-state、consistency
- 为 phase-22 的第一刀真实 cutover 建立 dispatch 前提

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

额外规则：
- 不复用 `phase-20`
- 不重开 runtime-phase-0 到 runtime-phase-6
- 不混入对象存储/CDN、产品 IA、analytics 语义变更
- 不允许长期保留“PostgreSQL + SQLite 双在线真相”作为目标状态
- 本轮以 inventory / freeze / acceptance 为主，不做大面积 cutover

当前 owner 结论：
- `completed`

当前已确认事实：
- runtime 7-phase 路线已经 `completed`
- `selection result` 在线真相已经是 PostgreSQL payload
- `backend/app/settings.py` 里的生产默认 `database_url` 仍是 `sqlite:///{storage_dir}/app.db`
- `backend/app/db/init_db.py` 仍会针对当前 active engine 建表与补 schema
- `backend/app/db/models.py` 里仍有大量产品后台、工作台、移动端 session / history / bag / events 表跟随默认数据库
- 后续若继续保留主业务表在 SQLite，会继续保留双数据库心智负担与并发风险

## 本轮排期

Owner
- [2026-03-25 15:10 Asia/Shanghai] 冻结 `postgresql-phase-0` 唯一真相、禁区、write scope，正式发 phase-21 assignment。
- [2026-03-25 16:00 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断 SQLite 剩余真相面与 PG target boundary 是否冻结。
- [2026-03-25 16:10 Asia/Shanghai] 收 Worker A 首轮 `green|yellow|red`，判断 acceptance 是否可用于 phase-22。
- [2026-03-25 16:20 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 env / compose / runtime / admin adoption inventory。
- [2026-03-25 18:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-21 integration gate。
- [2026-03-25 19:00 Asia/Shanghai] 若 integration gate 通过，冻结 phase-21 closeout，并决定是否开启 phase-22。

Worker B
- [2026-03-25 15:15 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结剩余 SQLite 真相面、PG target boundary、迁移分组、engine/session/init contract。
- [2026-03-25 16:00 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 15:15 Asia/Shanghai] 与 Worker B 并行，先补 bootstrap / downgrade / parity / empty-state / consistency acceptance。
- [2026-03-25 16:10 Asia/Shanghai] 回 `green|yellow|red`，说明 acceptance 是否已经足够支撑 phase-22。

Worker C
- [2026-03-25 15:15 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 16:20 Asia/Shanghai] 若 Worker B = `green`，开始做 env / compose / runtime / frontend adoption inventory 与 smoke 入口梳理。
- [2026-03-25 18:30 Asia/Shanghai] 回 `green|yellow|red`，说明后续切 PostgreSQL 默认值时哪些 deployment/profile/config 需要同步变化。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成真相冻结，C 才能进入大面积 adoption inventory
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-21 integration gate
  - 只有 phase-21 冻结成功，Owner 才能开 phase-22 的真实 cutover

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-21 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/worker-a.prompt.md`

一句简评：
- 这轮只守 acceptance，不抢 PostgreSQL 真相边界定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-21 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/worker-b.prompt.md`

一句简评：
- 这轮你是 PostgreSQL 全迁移的 truth owner，先把剩余 SQLite 真相面和 phase 序列冻住。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-21 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-21/worker-c.prompt.md`

一句简评：
- 这轮只做 adoption inventory 与 deployment/profile 影响面梳理，前提是 Worker B 已冻结真相。

## Phase-21 Gate Result

owner 结论：`green`

owner 已复核通过的证据：
- Worker A：`green`
- Worker B：`green`
- Worker C：`green`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `34 passed`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `177 passed`

本轮收口项：
- 剩余 SQLite 结构化真相面、迁移分组、engine/session/init/default contract 已冻结
- adoption inventory 已补齐 phase-22 所需 deployment/profile/config/frontend 影响面
- phase-22 的第一刀 scope 已经可由 owner 新开执行轮，不必继续停在 inventory

owner 下一步：
- `phase-21` 关闭
- 开启 `phase-22 / postgresql-phase-1`
