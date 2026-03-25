---
doc_id: mobile-phase-24-deploy-dispatch
title: Mobile Phase 24 Deploy Dispatch
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

# Phase 24 Deploy Dispatch

phase-24 对应 `postgresql-phase-3`，目标是把移动端状态表组迁到 PostgreSQL 单在线真相。

本轮只做 4 类事：
- 迁 phase-24 冻结表组到 PostgreSQL 单真相
- 收口对应 mobile session/history/bag/events/user asset 读写路径
- 补 phase-24 acceptance：state continuity、resume/history/bag parity、cleanup/empty-state
- 收口移动端 call-site adoption / replay / smoke 面

phase-24 冻结表组：
- `mobile_selection_sessions`
- `mobile_compare_session_index`
- `mobile_compare_usage_stats`
- `mobile_bag_items`
- `mobile_client_events`
- `user_upload_assets`
- `user_products`

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

额外规则：
- 本轮采用“阶段化并行”，不是串行派工
- 固定发送顺序只用于 relay，不等于执行串行
- A/B/C 第一阶段同时启动
- B 是 truth owner，先收口 phase-24 移动端状态表组的 PG-only 在线真相边界
- A/C 在第一阶段做 acceptance / adoption preflight，在 B `green` 后进入第二阶段收束
- 本轮不提前执行 `phase-25` 的 SQLite closure
- 不把产品后台 / workbench/job/AI 表组重新混回 phase-24

当前 owner 结论：
- `completed`

当前已确认事实：
- `postgresql-phase-2 / phase-23` 已完成 `green`
- 高并发后台/product/workbench/job/AI/index 表组已冻结为 PG-only online truth
- phase-24 的范围固定为移动端状态表组，不是 SQLite closure

## 本轮排期（阶段化并行）

Owner
- [2026-03-25 17:24 Asia/Shanghai] 冻结 `postgresql-phase-3` 唯一真相、禁区、write scope，正式发 phase-24 assignment。
- [2026-03-25 18:10 Asia/Shanghai] 收 Worker A / B / C 第一阶段结果，判断 truth freeze、acceptance baseline、adoption preflight 是否一致。
- [2026-03-25 18:20 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker A / Worker C 进入第二阶段收束。
- [2026-03-25 19:40 Asia/Shanghai] 收 Worker A / B / C 第二阶段结果，做 phase-24 integration gate。

Worker B
- [2026-03-25 17:28 Asia/Shanghai] 第一阶段开始：作为 `truth owner`，收口 phase-24 移动端状态表组的 PG-only 在线读写边界、repository/service cutover、continuity truth。
- [2026-03-25 18:10 Asia/Shanghai] 回第一阶段 `green|yellow|red`，并明确告知 A/C 是否进入第二阶段收束。

Worker A
- [2026-03-25 17:28 Asia/Shanghai] 第一阶段开始：并行冻结 phase-24 acceptance baseline，范围是 state continuity、resume/history/bag parity、cleanup/empty-state、worker/api consistency。
- [2026-03-25 18:10 Asia/Shanghai] 回第一阶段 `green|yellow|red`。
- [2026-03-25 18:20 Asia/Shanghai] 若 B = `green`，进入第二阶段，把 acceptance 收束到 phase-24 truth。

Worker C
- [2026-03-25 17:28 Asia/Shanghai] 第一阶段开始：并行做 `/m/me`、history、bag、compare/upload user-state 相关 call-site adoption preflight，不提前下最终 migration completion 结论。
- [2026-03-25 18:10 Asia/Shanghai] 回第一阶段 `green|yellow|red`。
- [2026-03-25 18:20 Asia/Shanghai] 若 B = `green`，进入第二阶段，收束移动端 state adoption / replay / smoke。

阶段规则：
- 第一阶段：A/B/C 同时启动
- 第二阶段：B `green` 后，A/C 收束
- owner gate：
  - 任一 `red`，不开 gate
  - B 未 `green` 时，A/C 只能停在 preflight，不得自创移动端状态 PG-only truth
  - 只有 A/B/C 第二阶段全部不为 `red`，Owner 才能进入 phase-24 integration gate

## First Owner Gate

- gate 时间：
  - `2026-03-25`
- Worker A stage-1：
  - `green`
  - acceptance baseline 成立
  - scoped diff = `0`
- Worker B stage-1：
  - `green`
  - phase-24 移动端状态表组 PG-only truth freeze 已落地到 backend/runtime/doc truth
- Worker C stage-1：
  - `green`
  - adoption/replay preflight 完整
  - scoped diff = `0`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `180 passed, 2 warnings`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-24 truth freeze 成立
  - Worker A / Worker C 可进入第二阶段收束
  - phase-24 仍处于 `in_execution`；未达到 integration gate `green`

## 第二阶段收束

Owner
- [2026-03-25] first owner gate = `green`，正式放行 Worker A / Worker C 进入第二阶段。
- [2026-03-25] 收 Worker A / B / C 第二阶段结果，并结合 Worker B truth freeze 做 phase-24 integration precheck。
- [2026-03-25] 若 A/B/C 全部不为 `red`，做 phase-24 integration gate；否则停在 `yellow/red`，不开 phase-25。

Worker A
- [2026-03-25] 进入第二阶段：把 acceptance 收束到已冻结的 phase-24 truth，只覆盖 state continuity、resume/history/bag parity、cleanup/empty-state、worker/api consistency。
- [2026-03-25] 回第二阶段 `green|yellow|red`，明确 acceptance 是否已完全贴合 phase-24 truth。

Worker C
- [2026-03-25] 进入第二阶段：把 `/m/me`、history、bag、compare/upload user-state 相关 adoption / replay / smoke 收束到已冻结的 phase-24 truth，不提前给 phase-25 结论。
- [2026-03-25] 回第二阶段 `green|yellow|red`，明确 mobile call-site adoption/replay/smoke 是否已完全收束。

## Phase-24 Gate Result

owner 结论：`green`

owner 已复核通过的证据：
- Worker A stage-2：`green`
  - acceptance 已完全贴合 phase-24 truth
  - 新增 `backend/tests/test_postgresql_phase24_acceptance_baseline.py`
- Worker B stage-2：`green`
  - 未收到 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：`green`
  - adoption/replay/smoke 已收束
  - scoped diff = `0`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `188 passed, 2 warnings`
  - `cd frontend && npx tsc --noEmit` -> `green`
  - `cd frontend && npm run build` -> `green`

本轮收口项：
- phase-24 移动端状态 / user-state 7 表 PG-only truth 已冻结并落地到 runtime/startup/readyz/mobile route contract
- production profile 不再接受 SQLite / artifact / file truth 作为 phase-24 在线主语义
- `/m/me`、history、bag、compare/upload user-state 相关 call-site 已确认贴合 phase-24 truth

owner 下一步：
- `phase-24` 关闭
- 创建 `mobile-postgresql-phase-3-record-v1`
- 创建 `mobile-postgresql-phase-3-acceptance-review-v1`
- 开启 `phase-25 / postgresql-phase-4`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-24 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-24/worker-a.prompt.md`

一句简评：
- 这轮先守移动端状态 acceptance，不抢表组真相定义。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-24 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-24/worker-b.prompt.md`

一句简评：
- 这轮你是 phase-24 移动端状态表组迁移的 truth owner。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-24 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-24/worker-c.prompt.md`

一句简评：
- 这轮先做移动端 state adoption/replay preflight，B `green` 后再收束 mobile call-site 影响面。
