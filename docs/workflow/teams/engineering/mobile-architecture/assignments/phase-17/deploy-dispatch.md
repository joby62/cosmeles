---
doc_id: mobile-phase-17-deploy-dispatch
title: Mobile Phase 17 Deploy Dispatch
doc_type: assignment
initiative: mobile
workstream: workflow
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-24
updated_at: 2026-03-25
completed_at: 2026-03-25
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-architecture-v2
---

# Phase 17 Deploy Dispatch

phase-17 对应 `runtime-phase-3`，目标是把 selection result 的在线真相从 `DB index -> local file` 切到 `PostgreSQL payload` 直读，并建立 completeness gate，彻底收掉“第一次没有、稍后又好了”的双真相窗口。

本轮只做 4 类事：
- 冻结 selection-result PostgreSQL payload model、repository 和 cutover 顺序
- 做 schema / backfill / completeness / consistency 验证骨架
- 做 selection-result caller adoption 与历史链路 smoke
- 保留 object-storage artifact 作为发布/归档副本，不再让在线读路径依赖本地文件

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切 compare / upload / result build 的真实 job system
- 本轮不切 Redis 锁/缓存能力
- 本轮不切多机拆分
- 本轮不重开产品层语义，不改 route / analytics 真相

当前 owner 结论：
- `green`

当前已确认事实：
- selection result 在线读取已经切到 PostgreSQL payload 单真相：
  - `published_payload_json`
  - `fixed_contract_json`
  - `artifact_manifest_json`
  - `payload_backend`
- env example 与 dev/prod compose 已统一使用 `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`
- runtime profile / readyz / adapter contract 现在会显式暴露：
  - selection-result payload model
  - `online_truth=postgres_payload`
  - `artifact_copy_only=true`
  - `online_read_from_artifact=false`
- phase-17 targeted acceptance 已补齐：
  - PG payload 在线读路径
  - `SELECTION_RESULT_PAYLOAD_MISSING`
  - postgres repository 禁止 artifact 在线回退
- owner 复核通过：
  - backend 全量 `pytest backend/tests` = `159 passed`
  - frontend `npx tsc --noEmit` = green
  - frontend `npm run build` = green
  - `docker compose config` 在 `single_node / split_runtime / multi_node` 三套 env 下均为 green
- phase-17 已达到 integration gate，可正式开启 `runtime-phase-4 -> phase-18`

## 本轮排期

Owner
- [2026-03-26 09:30 Asia/Shanghai] 冻结 `runtime-phase-3` 唯一真相、禁区、write scope，正式发 phase-17 assignment。
- [2026-03-26 10:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断 PG payload model、repository、cutover 顺序是否冻结。
- [2026-03-26 10:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 schema / backfill / completeness 骨架是否可继续。
- [2026-03-26 11:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 result caller adoption 与 smoke。
- [2026-03-26 15:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-17 integration gate。
- [2026-03-26 17:30 Asia/Shanghai] 若 integration gate 通过，冻结 phase-17 deploy-prep scope。

Worker B
- [2026-03-26 09:35 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 selection-result PG payload model、repository backend、读写 cutover 顺序和 artifact 副本策略。
- [2026-03-26 10:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-26 09:35 Asia/Shanghai] 与 Worker B 并行，先补 schema / backfill / completeness / consistency 骨架。
- [2026-03-26 10:30 Asia/Shanghai] 回 `green|yellow|red`，说明验证入口是否齐备。

Worker C
- [2026-03-26 09:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-26 11:00 Asia/Shanghai] 若 Worker B = `green`，开始做 result caller、历史链路、compare bootstrap adoption smoke。
- [2026-03-26 15:30 Asia/Shanghai] 回 `green|yellow|red`，说明 selection-result caller 是否已脱离旧在线文件读路径。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成 selection-result PG 真相冻结，C 才能进入大面积 adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-17 integration gate
  - 只有 integration gate 通过，才允许进入 `runtime-phase-4`

## First Owner Gate - 2026-03-25

owner 复核结论：`yellow`

owner 已复核通过的证据：
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `152 passed`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
- `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- selection-result publish/load 主路径代码已经切到 PostgreSQL payload 直读；artifact 保留为发布/归档副本

当前 yellow blocker：
- env skeleton 仍把 `SELECTION_RESULT_REPOSITORY_BACKEND` 固定为 `local_fs`，没有把 phase-17 的在线真相切换反映到 live profile contract
- `docker-compose.dev.yml` / `docker-compose.prod.yml` 仍把 `SELECTION_RESULT_REPOSITORY_BACKEND` 默认展开为 `local_fs`
- `backend/tests/test_runtime_health_contract.py` 与 `backend/tests/test_runtime_platform_adapters.py` 仍把 selection-result runtime backend 视为 `local_fs`，导致 health/profile 观测面与 phase-17 真相不一致
- phase-17 缺少针对 `SELECTION_RESULT_PAYLOAD_MISSING`、PG payload 读路径和 artifact-copy-only 语义的定向 acceptance 覆盖

owner 判断：
- phase-17 的核心代码路径已经向 PostgreSQL payload 推进
- 但 deploy surface、health observability、profile contract、acceptance 证据还没有同步到同一套真相
- 所以 phase-17 现在不能进 `green`，也不能打开 `runtime-phase-4 / phase-18`

## Follow-Up Gate Result - 2026-03-25

owner follow-up 复核结论：`green`

follow-up 已收口项：
- `.env.single-node.example`、`.env.split-runtime.example`、`.env.multi-node.example` 已统一切到 `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`
- `docker-compose.dev.yml` 与 `docker-compose.prod.yml` 已统一把 selection-result live contract 展开为 `postgres_payload`
- `backend/app/platform/runtime_profile.py` 已补 selection-result payload model / contract 观测面
- `backend/tests/test_runtime_health_contract.py` 与 `backend/tests/test_runtime_platform_adapters.py` 已更新为 phase-17 真相
- `backend/tests/test_selection_result_payload_acceptance.py` 已补 PG payload 在线真相 acceptance

owner follow-up 验证：
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `159 passed`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
- `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
- `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`

## Follow-Up Schedule

Owner
- [2026-03-25 09:30 Asia/Shanghai] 冻结 phase-17 yellow follow-up，维持当前唯一 freeze，不新开 phase-18。
- [2026-03-25 10:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，确认 live profile contract、runtime profile observability、artifact 策略是否已对齐 PG 单真相。
- [2026-03-25 10:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 PG payload acceptance、payload-missing、artifact-copy-only 覆盖是否落盘。
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 result caller / history / compare bootstrap 再烟测。
- [2026-03-25 13:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-17 follow-up integration gate。
- [2026-03-25 14:00 Asia/Shanghai] 只有 follow-up gate 通过，才允许准备 `runtime-phase-4 / phase-18` dispatch。

Worker B
- [2026-03-25 09:35 Asia/Shanghai] 先做，作为 truth owner，先把 phase-17 live profile contract、runtime profile observability、artifact-copy-only 语义统一到 PostgreSQL payload 单真相。
- [2026-03-25 10:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 09:35 Asia/Shanghai] 与 Worker B 并行，补 phase-17 定向 acceptance：payload-missing、PG payload 直读、artifact-copy-only、profile self-consistency。
- [2026-03-25 10:30 Asia/Shanghai] 回 `green|yellow|red`，说明 phase-17 acceptance 是否已达到 owner gate 要求。

Worker C
- [2026-03-25 09:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B = `green`，重跑 result caller / history / compare bootstrap smoke，确认调用链不再依赖旧本地文件在线读路径。
- [2026-03-25 13:30 Asia/Shanghai] 回 `green|yellow|red`，说明 caller / history adoption 是否仍有旧真相残留。

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-17 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/worker-a.prompt.md`

一句简评：
- 这轮守 schema、backfill、completeness、consistency 和 acceptance，不抢 selection-result 真相定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-17 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-3 truth owner，先把 selection-result 在线真相切到 PostgreSQL payload，并收口旧读路径。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-17 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/worker-c.prompt.md`

一句简评：
- 这轮只做 result caller / compare bootstrap / history 链路 adoption，前提是 Worker B 已经把 PG 单真相冻结出来。
