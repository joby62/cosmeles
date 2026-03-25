---
doc_id: mobile-phase-23-deploy-dispatch
title: Mobile Phase 23 Deploy Dispatch
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

# Phase 23 Deploy Dispatch

phase-23 对应 `postgresql-phase-2`，目标是把高并发后台 / 产品工作台 / job / AI / product index 表组迁到 PostgreSQL 单在线真相。

本轮只做 4 类事：
- 迁 phase-23 冻结表组到 PostgreSQL 单真相
- 收口对应 repository / service / route 的在线读写路径
- 补 phase-23 acceptance：PG-only truth、bootstrap/backfill、worker/api 并发一致性
- 收口管理台 / 工作台 / 产品后台相关 adoption / replay / smoke 面

phase-23 冻结表组：
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

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

额外规则：
- 本轮采用“阶段化并行”，不是串行派工
- 固定发送顺序只用于 relay，不等于执行串行
- A/B/C 第一阶段同时启动
- B 是 truth owner，先收口 phase-23 表组的 PG-only 在线真相边界
- A/C 在第一阶段做 acceptance / adoption preflight，在 B `green` 后进入第二阶段收束
- 本轮不提前执行 `phase-24` 的移动端状态表组迁移
- 本轮不把 `single_node` fallback 重新包装成 production 主语义

当前 owner 结论：
- `completed`

当前已确认事实：
- `postgresql-phase-1 / phase-22` 已完成 `green`
- PostgreSQL 已是 production-default structured-truth driver
- `split_runtime / multi_node` 已固定为 production-default PostgreSQL profile
- `single_node` 已固定为 `dev_or_emergency_fallback`
- phase-23 的范围固定为高并发后台/product/job/AI 表组，不是移动端状态表组

## First Owner Gate

- gate 时间：
  - `[2026-03-25 17:18 Asia/Shanghai]`
- Worker A stage-1：
  - `green`
  - phase-23 acceptance baseline 已成立
  - 新增 `backend/tests/test_postgresql_phase23_acceptance_baseline.py`
- Worker B stage-1：
  - `green`
  - phase-23 PG-only truth freeze 已落地到 session / main / runtime_profile / init_db / models / freeze 文档
- Worker C stage-1：
  - `green`
  - adoption / replay preflight 完整
  - 当前 scoped diff = `0`
- owner 抽检：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py app/main.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_postgresql_phase23_acceptance_baseline.py backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `37 passed, 2 warnings`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `180 passed, 2 warnings`
  - `cd frontend && npx tsc --noEmit` -> `green`
- owner 结论：
  - first owner gate = `green`
  - Worker B truth freeze 已成立
  - Worker A / Worker C 现在进入第二阶段收束
  - phase-23 仍未 green；未进入 integration gate，未开启 phase-24

## 本轮排期（阶段化并行）

Owner
- [2026-03-25 16:53 Asia/Shanghai] 冻结 `postgresql-phase-2` 唯一真相、禁区、write scope，正式发 phase-23 assignment。
- [2026-03-25 17:40 Asia/Shanghai] 收 Worker A / B / C 第一阶段结果，判断 truth freeze、acceptance baseline、adoption preflight 是否一致。
- [2026-03-25 17:50 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker A / Worker C 进入第二阶段收束。
- [2026-03-25 19:10 Asia/Shanghai] 收 Worker A / B / C 第二阶段结果，做 phase-23 integration gate。

Worker B
- [2026-03-25 16:58 Asia/Shanghai] 第一阶段开始：作为 `truth owner`，收口 phase-23 表组的 PG-only 在线读写边界、repository/service cutover、migration write path。
- [2026-03-25 17:40 Asia/Shanghai] 回第一阶段 `green|yellow|red`，并明确告知 A/C 是否进入第二阶段收束。

Worker A
- [2026-03-25 16:58 Asia/Shanghai] 第一阶段开始：并行冻结 phase-23 acceptance baseline，范围是 PG-only truth、bootstrap/backfill、worker/api parity、empty-state/consistency。
- [2026-03-25 17:40 Asia/Shanghai] 回第一阶段 `green|yellow|red`。
- [2026-03-25 17:50 Asia/Shanghai] 若 B = `green`，进入第二阶段，把 acceptance 收束到 phase-23 truth。

Worker C
- [2026-03-25 16:58 Asia/Shanghai] 第一阶段开始：并行做管理台 / 工作台 / 产品后台 / upload 相关 adoption preflight，不提前下最终 migration completion 结论。
- [2026-03-25 17:40 Asia/Shanghai] 回第一阶段 `green|yellow|red`。
- [2026-03-25 17:50 Asia/Shanghai] 若 B = `green`，进入第二阶段，收束 call-site adoption、replay/smoke、零 diff 说明。

阶段规则：
- 第一阶段：A/B/C 同时启动
- 第二阶段：B `green` 后，A/C 收束
- owner gate：
  - 任一 `red`，不开 gate
  - B 未 `green` 时，A/C 只能停在 preflight，不得自创 PG-only truth
  - 只有 A/B/C 第二阶段全部不为 `red`，Owner 才能进入 phase-23 integration gate

## 第二阶段收束

Owner
- [2026-03-25 17:18 Asia/Shanghai] first owner gate = `green`，正式放行 Worker A / Worker C 进入第二阶段。
- [2026-03-25 18:10 Asia/Shanghai] 收 Worker A / Worker C 第二阶段结果，并结合 Worker B truth freeze 做 phase-23 integration precheck。
- [2026-03-25 18:40 Asia/Shanghai] 若 A/B/C 全部不为 `red`，做 phase-23 integration gate；否则停在 `yellow/red`，不开 phase-24。

Worker A
- [2026-03-25 17:18 Asia/Shanghai] 进入第二阶段：把 acceptance 收束到已冻结的 phase-23 truth，只覆盖 PG-only truth、bootstrap/backfill、worker/api parity、clean-start。
- [2026-03-25 18:10 Asia/Shanghai] 回第二阶段 `green|yellow|red`，明确 acceptance 是否已完全贴合 phase-23 truth。

Worker C
- [2026-03-25 17:18 Asia/Shanghai] 进入第二阶段：把管理台 / 工作台 / 产品后台 / upload 相关 adoption / replay / smoke 收束到已冻结的 phase-23 truth，不提前给 phase-24 结论。
- [2026-03-25 18:10 Asia/Shanghai] 回第二阶段 `green|yellow|red`，明确 call-site adoption/replay/smoke 是否已完全收束。

## Phase-23 Gate Result

owner 结论：`green`

owner 已复核通过的证据：
- Worker A stage-2：`green`
  - acceptance 已完全贴合 phase-23 truth
  - scoped diff = `0`
- Worker B stage-2：`green`
  - 未收到 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：`green`
  - adoption/replay/smoke 已收束
  - scoped diff = `0`
- owner 验证：
  - first gate 实测代码与测试结果继续成立
  - 第二阶段无新增 diff，owner 复核当前代码真相与 worker 回报一致
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_postgresql_phase23_acceptance_baseline.py backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `37 passed, 2 warnings`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `180 passed, 2 warnings`
  - `cd frontend && npx tsc --noEmit` -> `green`

本轮收口项：
- phase-23 高并发表组 PG-only truth 已冻结并落地到 runtime/startup/readyz 可观测 contract
- 管理台 / 工作台 / 产品后台 / upload 相关 caller 没有发现 phase-23 scope 内的 page-local DB 假设漂移
- phase-23 不再承担 phase-24 的移动端状态表组迁移语义

owner 下一步：
- `phase-23` 关闭
- 创建 `mobile-postgresql-phase-2-record-v1`
- 创建 `mobile-postgresql-phase-2-acceptance-review-v1`
- 开启 `phase-24 / postgresql-phase-3`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-23 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/worker-a.prompt.md`

一句简评：
- 这轮先守 phase-23 acceptance，不抢表组真相定义。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-23 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/worker-b.prompt.md`

一句简评：
- 这轮你是 phase-23 高并发表组迁移的 truth owner。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-23 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-23/worker-c.prompt.md`

一句简评：
- 这轮先做 adoption/replay preflight，B `green` 后再收束后台与工作台相关 call-site 影响面。
