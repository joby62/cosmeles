---
doc_id: mobile-phase-25-deploy-dispatch
title: Mobile Phase 25 Deploy Dispatch
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

# Phase 25 Deploy Dispatch

phase-25 对应 `postgresql-phase-4`，目标是完成 SQLite closure：把 SQLite 明确降为 `dev-only / emergency fallback`，并收口 docs / ops / tests / runtime observability。

本轮只做 4 类事：
- 冻结 final SQLite closure truth
- 收口 runtime / default / downgrade / fallback 语义
- 补 phase-25 acceptance：closure contract、profile parity、readiness/observability、emergency semantics
- 收口 env / compose / ops / smoke / docs 面

phase-25 不是新表组迁移：
- phase-23 高并发表组已完成 PG-only truth
- phase-24 移动端状态表组已完成 PG-only truth
- 本轮不重开 phase-22 到 phase-24 的任何表组 cutover

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-postgresql-full-migration-plan-v1.md`

额外规则：
- 本轮采用“阶段化并行”，不是串行派工
- 固定发送顺序只用于 relay，不等于执行串行
- A/B/C 第一阶段同时启动
- B 是 truth owner，先收口 phase-25 SQLite closure 的唯一真相边界
- A/C 在第一阶段做 acceptance / ops-deploy preflight，在 B `green` 后进入第二阶段收束
- 本轮不复活任何 SQLite 作为 production 在线结构化真相

当前 owner 结论：
- `completed`

当前已确认事实：
- `postgresql-phase-3 / phase-24` 已完成 `green`
- 所有剩余结构化真相表组都已完成 PostgreSQL online-truth 迁移
- phase-25 的范围固定为 SQLite closure，不是新的表组迁移

## 本轮排期（阶段化并行）

Owner
- [2026-03-25] 冻结 `postgresql-phase-4` 唯一真相、禁区、write scope，正式发 phase-25 assignment。
- [2026-03-25] 收 Worker A / B / C 第一阶段结果，判断 truth freeze、acceptance baseline、ops/deploy preflight 是否一致。
- [2026-03-25] 若 Worker B 已 `green`，放行 Worker A / Worker C 进入第二阶段收束。
- [2026-03-25] 收 Worker A / B / C 第二阶段结果，做 phase-25 integration gate。

Worker B
- [2026-03-25] 第一阶段开始：作为 `truth owner`，收口 SQLite closure truth、runtime/default/downgrade contract、剩余 backend fallback 语义。
- [2026-03-25] 回第一阶段 `green|yellow|red`，并明确告知 A/C 是否进入第二阶段收束。

Worker A
- [2026-03-25] 第一阶段开始：并行冻结 phase-25 acceptance baseline，范围是 closure contract、profile parity、readiness/observability、emergency semantics。
- [2026-03-25] 回第一阶段 `green|yellow|red`。
- [2026-03-25] 若 B = `green`，进入第二阶段，把 acceptance 收束到 phase-25 truth。

Worker C
- [2026-03-25] 第一阶段开始：并行做 env / compose / ops / runtime smoke preflight，不提前下最终 route closure 结论。
- [2026-03-25] 回第一阶段 `green|yellow|red`。
- [2026-03-25] 若 B = `green`，进入第二阶段，收束 deploy/docs/ops/smoke。

阶段规则：
- 第一阶段：A/B/C 同时启动
- 第二阶段：B `green` 后，A/C 收束
- owner gate：
  - 任一 `red`，不开 gate
  - B 未 `green` 时，A/C 只能停在 preflight，不得自创 SQLite closure 真相
  - 只有 A/B/C 第二阶段全部不为 `red`，Owner 才能进入 phase-25 integration gate

## First Owner Gate

- gate 时间：
  - `2026-03-25`
- Worker A stage-1：
  - `green`
  - acceptance baseline 成立
  - 新增 `backend/tests/test_postgresql_phase25_acceptance_baseline.py`
- Worker B stage-1：
  - `green`
  - phase-25 SQLite closure truth freeze 已落地到 backend/runtime/doc truth
- Worker C stage-1：
  - `green`
  - ops/deploy preflight 完整
  - scoped diff = `0`
  - 发现 `.env.*` 头注释仍有 phase-22 历史标注，但当前不构成 gate blocker
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `194 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-25 truth freeze 成立
  - Worker A / Worker C 可进入第二阶段收束
  - phase-25 仍处于 `in_execution`；未达到 integration gate `green`

## 第二阶段收束

Owner
- [2026-03-25] first owner gate = `green`，正式放行 Worker A / Worker C 进入第二阶段。
- [2026-03-25] 收 Worker A / B / C 第二阶段结果，并结合 Worker B truth freeze 做 phase-25 integration precheck。
- [2026-03-25] 若 A/B/C 全部不为 `red`，做 phase-25 integration gate；否则停在 `yellow/red`，不关闭 PostgreSQL full migration 路线。

Worker A
- [2026-03-25] 进入第二阶段：把 acceptance 收束到已冻结的 phase-25 truth，只覆盖 SQLite closure contract、profile parity、readiness/observability、emergency fallback semantics。
- [2026-03-25] 回第二阶段 `green|yellow|red`，明确 acceptance 是否已完全贴合 phase-25 truth。

Worker C
- [2026-03-25] 进入第二阶段：把 env / compose / ops / smoke / docs 收束到已冻结的 phase-25 truth，不提前扩到新路线。
- [2026-03-25] 回第二阶段 `green|yellow|red`，明确 deploy/docs/ops/smoke 是否已完全收束。

## Phase-25 Gate Result

owner 结论：`green`

owner 已复核通过的证据：
- Worker A stage-2：`green`
  - acceptance 已完全贴合 phase-25 truth
  - scoped diff = `0`
- Worker B stage-2：
  - `green`
  - 未收到 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：
  - `green`
  - 收束 `.env.*` 历史口径文案到 phase-25
  - compose / docs / ops / smoke 已贴合 phase-25 truth
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `194 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`

本轮收口项：
- SQLite closure truth 已冻结并落地到 settings / runtime / startup / readiness / acceptance / env-doc wording
- production profile 不再接受 SQLite 在线结构化真相或隐式 downgrade/fallback
- `single_node` 已明确收口为 `dev_or_emergency_fallback`

owner 下一步：
- `phase-25` 关闭
- 创建 `mobile-postgresql-phase-4-record-v1`
- 创建 `mobile-postgresql-phase-4-acceptance-review-v1`
- 完成 `NOW / DOC_INDEX / TIMELINE`
- 关闭 PostgreSQL full migration 路线

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-25 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-25/worker-a.prompt.md`

一句简评：
- 这轮先守 SQLite closure acceptance，不抢最终真相定义。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-25 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-25/worker-b.prompt.md`

一句简评：
- 这轮你是 final SQLite closure 的 truth owner。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-25 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-25/worker-c.prompt.md`

一句简评：
- 这轮先做 env / compose / ops / smoke preflight，B `green` 后再收束 docs 与 deploy 口径。
