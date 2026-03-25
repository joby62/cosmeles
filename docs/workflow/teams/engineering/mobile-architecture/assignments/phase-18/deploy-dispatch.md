---
doc_id: mobile-phase-18-deploy-dispatch
title: Mobile Phase 18 Deploy Dispatch
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
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
---

# Phase 18 Deploy Dispatch

phase-18 对应 `runtime-phase-4`，目标是把 compare / upload / result build 从 API 进程内线程执行切到 `job + worker`，让 API 只创建 job，worker 执行，SSE 只读状态。

本轮只做 4 类事：
- 冻结 job model、queue contract、worker execution truth、SSE status read model
- 做 lag / fail / retry / recovery / acceptance 骨架
- 做 compare / upload / result build caller adoption 与状态流 smoke
- 保持 selection-result PostgreSQL 单真相不回退，不混入 Redis / phase-19 范围

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切 Redis 锁/缓存能力
- 本轮不切多机拆分
- 本轮不重开 selection-result 真相
- 本轮不改产品层 route / analytics 真相

当前 owner 结论：
- `green`

当前已确认事实：
- `runtime-phase-3 / phase-17` 已达到 integration gate `green`
- selection-result 在线真相已冻结为 PostgreSQL payload
- env / compose / runtime observability 已与 phase-17 真相对齐
- compare / upload 的 job + worker 主路径与验证已经推进到可集成状态
- `result build` / product workbench 现已进入 phase-18 同一套 queue / worker execution truth
- runtime worker capabilities 现已覆盖：
  - `upload_ingest`
  - `mobile_compare`
  - `product_workbench`
- phase-18 已达到 integration gate，可正式开启 `runtime-phase-5 -> phase-19`

## 本轮排期

Owner
- [2026-03-25 09:30 Asia/Shanghai] 冻结 `runtime-phase-4` 唯一真相、禁区、write scope，正式发 phase-18 assignment。
- [2026-03-25 10:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断 job model、queue contract、worker execution truth 是否冻结。
- [2026-03-25 10:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 lag / fail / retry / recovery acceptance 骨架是否可继续。
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 compare / upload / result build adoption 与 SSE smoke。
- [2026-03-25 15:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-18 integration gate。
- [2026-03-25 17:30 Asia/Shanghai] 若 integration gate 通过，冻结 phase-18 deploy-prep scope。

Worker B
- [2026-03-25 09:35 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 job schema、queue contract、worker runner 和 execution truth。
- [2026-03-25 10:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 09:35 Asia/Shanghai] 与 Worker B 并行，先补 lag / fail / retry / recovery / acceptance 骨架。
- [2026-03-25 10:30 Asia/Shanghai] 回 `green|yellow|red`，说明验证入口是否齐备。

Worker C
- [2026-03-25 09:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B = `green`，开始做 compare / upload / result build caller adoption、状态页 / SSE smoke。
- [2026-03-25 15:30 Asia/Shanghai] 回 `green|yellow|red`，说明 caller 是否已脱离 API 内线程执行。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成 job truth 冻结，C 才能进入大面积 adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-18 integration gate
  - 只有 integration gate 通过，才允许进入 `runtime-phase-5`

## Owner Gate - 2026-03-25

owner 复核结论：`yellow`

owner 已复核通过的证据：
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `162 passed`
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_compare.py backend/tests/test_upload_jobs.py backend/tests/test_product_workbench_jobs.py backend/tests/test_ingredient_library_jobs.py` -> `39 passed`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
- `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- mobile compare 已落成 job session / worker poller / SSE status read model
- upload ingest 仍能在 runtime worker 模式下通过 job/poller 跑通

当前 yellow blocker：
- `result build` 所在的 product workbench 仍使用 API 进程内 `ThreadPoolExecutor`，没有进入 phase-18 的 runtime worker truth：
  - `backend/app/routes/products.py`
- runtime worker daemon 当前只轮询：
  - `upload_ingest`
  - `mobile_compare`
  没有覆盖 product workbench / `selection_result_build`
- phase-18 Worker B 的原始 write scope 没有包含 `backend/app/routes/products.py`，无法触达 `result build` 的真实执行面
- phase-18 Worker C 的原始 write scope 没有包含 product workbench 前端状态面，无法完整覆盖 `result build caller / status` adoption

owner 判断：
- compare / upload 两条长任务链路已经基本对齐 phase-18 目标
- 但 phase-18 明确包含 `result build`
- 只要 `result build` 还停留在 API 进程内 executor/thread，就不能把 phase-18 判成 `green`
- 当前不打开 `runtime-phase-5 / phase-19`

## Follow-Up Schedule

Owner
- [2026-03-25 18:10 Asia/Shanghai] 冻结 phase-18 yellow follow-up，维持当前唯一 freeze，不新开 phase-19。
- [2026-03-25 18:40 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，确认 product workbench / selection-result-build 是否已纳入 runtime worker truth。
- [2026-03-25 19:00 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 result-build job acceptance、retry/recovery、worker-poller 验证是否落盘。
- [2026-03-25 19:20 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 product pipeline / workbench status adoption 与 smoke。
- [2026-03-25 21:00 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-18 follow-up integration gate。
- [2026-03-25 21:30 Asia/Shanghai] 只有 follow-up gate 通过，才允许准备 `runtime-phase-5 / phase-19` dispatch。

Worker B
- [2026-03-25 18:15 Asia/Shanghai] 先做，作为 truth owner，先把 product workbench / `selection_result_build` 从 API executor/thread 收口到同一套 queue / worker execution truth。
- [2026-03-25 18:40 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 18:15 Asia/Shanghai] 与 Worker B 并行，补 result-build job acceptance、retry/recovery、worker-poller、orphan reconciliation 骨架。
- [2026-03-25 19:00 Asia/Shanghai] 回 `green|yellow|red`，说明 phase-18 acceptance 是否达到 owner gate 要求。

Worker C
- [2026-03-25 18:15 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 19:20 Asia/Shanghai] 若 Worker B = `green`，重跑 compare / upload / result-build caller 与 product pipeline / workbench status smoke。
- [2026-03-25 21:00 Asia/Shanghai] 回 `green|yellow|red`，说明前端状态面是否仍残留 API 内线程执行假设。

## Follow-Up Gate Result - 2026-03-25

owner follow-up 复核结论：`green`

follow-up 已收口项：
- `backend/app/routes/products.py` 已移除 `PRODUCT_WORKBENCH_EXECUTOR`，并改走 runtime task queue / dispatch mode
- `run_product_workbench_worker_once()` 已接入 runtime worker poller
- runtime worker daemon capabilities 已扩展为：
  - `upload_ingest`
  - `mobile_compare`
  - `product_workbench`
- runtime topology / runtime profile 已补 product-workbench dispatch mode 与 queue contract
- product workbench / selection-result-build 的 orphan / retry / queued acceptance 已补齐

owner follow-up 验证：
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `162 passed`
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_compare.py backend/tests/test_upload_jobs.py backend/tests/test_product_workbench_jobs.py backend/tests/test_ingredient_library_jobs.py` -> `39 passed`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
- `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-18 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/worker-a.prompt.md`

一句简评：
- 这轮守 job acceptance、lag/fail/retry/recovery 和 verification，不抢 worker truth 定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-18 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-4 truth owner，先把 job model、worker execution truth、queue contract 冻住。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-18 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/worker-c.prompt.md`

一句简评：
- 这轮只做 compare / upload / result build caller adoption 与状态流 smoke，前提是 Worker B 已冻结 job 真相。
