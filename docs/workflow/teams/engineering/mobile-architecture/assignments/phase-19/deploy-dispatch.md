---
doc_id: mobile-phase-19-deploy-dispatch
title: Mobile Phase 19 Deploy Dispatch
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

# Phase 19 Deploy Dispatch

phase-19 对应 `runtime-phase-5`，目标是引入外置 PostgreSQL / Redis 的使用边界：数据库继续是唯一真相，Redis 只做锁和缓存，不抢数据库真相。

本轮只做 4 类事：
- 冻结外置 PG / Redis 的使用边界、连接配置和开关语义
- 做 lock / cache / pool / downgrade / single-node compatibility acceptance
- 做 deployment profile、compose/env、config switch 与 smoke
- 保持 phase-18 的 job + worker execution truth 不回退，不混入 multi-node phase-20

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切多机拆分
- 本轮不重开 selection-result / product-workbench 真相
- Redis 只做缓存与锁，不做结构化真相
- 本轮不改产品层 route / analytics 真相

当前 owner 结论：
- `green`

当前已确认事实：
- `runtime-phase-4 / phase-18` 已达到 integration gate `green`
- compare / upload / result-build 已进入 shared `job + worker` truth
- phase-19 的目标现在是 capability boundary，不是再改 job semantics
- Worker B 已完成 external PG / Redis adapter、lock/cache contract、pool config、downgrade 语义的 first-pass freeze，并给出 Worker C = `go`
- Worker A 已确认 phase-19 的 lock / cache / pool / downgrade / single-node compatibility acceptance 现有验证集可自洽
- owner 抽检通过：
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `23 passed`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`

## 本轮排期

Owner
- [2026-03-26 09:30 Asia/Shanghai] 冻结 `runtime-phase-5` 唯一真相、禁区、write scope，正式发 phase-19 assignment。
- [2026-03-26 10:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断外置 PG / Redis adapter、边界和连接配置是否冻结。
- [2026-03-26 10:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 lock / cache / pool / downgrade acceptance 是否可继续。
- [2026-03-26 11:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 deployment profile / compose/env / config switch adoption。
- [2026-03-26 15:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-19 integration gate。
- [2026-03-26 17:30 Asia/Shanghai] 若 integration gate 通过，冻结 phase-19 deploy-prep scope。

Worker B
- [2026-03-26 09:35 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 external PG / Redis adapter、lock/cache contract、pool config 和 downgrade 语义。
- [2026-03-26 10:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-26 09:35 Asia/Shanghai] 与 Worker B 并行，先补 lock / cache / pool / downgrade / single-node compatibility acceptance。
- [2026-03-26 10:30 Asia/Shanghai] 回 `green|yellow|red`，说明验证入口是否齐备。

Worker C
- [2026-03-26 09:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-26 11:00 Asia/Shanghai] 若 Worker B = `green`，开始做 deployment profile、compose/env、config switch 与 smoke。
- [2026-03-26 15:30 Asia/Shanghai] 回 `green|yellow|red`，说明 profile/config switch 是否已脱离硬编码单机假设。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
- 只有 B 完成 capability boundary 冻结，C 才能进入大面积 adoption
- 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-19 integration gate
- 只有 integration gate 通过，才允许进入 `runtime-phase-6`

## First Owner Gate - 2026-03-25

owner 复核结论：`yellow`

owner 已复核通过的证据：
- Worker A：`green`
- Worker B：`green`，并已明确给 Worker C = `go`
- Worker C preflight：
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 抽检：
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `23 passed`
  - split-runtime compose 展开面已显式对齐：
    - `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`
    - `LOCK_BACKEND=redis_contract`
    - `CACHE_BACKEND=redis_contract`
    - `REDIS_URL=redis://redis:6379/0`
    - `DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/cosmeles`

当前 yellow blocker：
- Worker C 这轮只完成了 preflight validation，还没有执行 phase-19 真正的 deployment profile / compose-env / config-switch smoke。
- 因此当前只能证明：
  - external PG / Redis capability boundary 已冻结为可继续状态
  - acceptance 已具备 owner gate 的基础证据
- 还不能证明：
  - deployment profile 已真正脱离硬编码单机假设
  - phase-19 integration gate 已完成

owner 判断：
- phase-19 当前不是 capability truth blocker，也不是 acceptance blocker。
- 当前 gate 卡点只剩 Worker C follow-up smoke。
- `runtime-phase-6 / phase-20` 继续保持关闭，直到 Worker C follow-up 完成且 owner 复核转绿。

## Follow-Up Schedule

Owner
- [2026-03-25 07:08 Asia/Shanghai] 冻结 phase-19 first gate `yellow` 结论，维持当前唯一 freeze，不开 phase-20。
- [2026-03-25 07:10 Asia/Shanghai] 基于 Worker B `green/go`，正式放行 Worker C 进入 deployment profile / compose-env / config-switch smoke。
- [2026-03-25 10:00 Asia/Shanghai] 收 Worker C follow-up 结果，做 phase-19 follow-up integration gate。

Worker C
- [2026-03-25 07:10 Asia/Shanghai] 开始做 deployment profile、compose/env、config switch 与 smoke，不再停留在 preflight。
- [2026-03-25 10:00 Asia/Shanghai] 回 `green|yellow|red`，说明 profile/config switch 是否已真正脱离硬编码单机假设。

## Follow-Up Gate Result - 2026-03-25

owner follow-up 复核结论：`green`

follow-up 已收口项：
- Worker C 已完成 deployment profile / compose-env / config-switch smoke，不再停留在 preflight。
- `single_node / split_runtime / multi_node` 三套 profile 的 frontend/runtime wiring 已确认不回退到硬编码单机地址。
- `single_node` 仍保留低成本本地 fallback；`split_runtime / multi_node` 已对齐 external PG / Redis contract 的 config-switch 语义。
- phase-19 的 external PG / Redis capability boundary、lock/cache/pool/downgrade acceptance、deployment profile smoke 已形成同一套 owner gate 证据。

owner follow-up 验证：
- Worker A：
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `166 passed`
- Worker B：
  - `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/settings.py` -> `green`
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `166 passed`
- Worker C：
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner spot-check：
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `23 passed`
  - split-runtime compose 展开面显式保持：
    - `SELECTION_RESULT_REPOSITORY_BACKEND=postgres_payload`
    - `LOCK_BACKEND=redis_contract`
    - `CACHE_BACKEND=redis_contract`
    - `REDIS_URL=redis://redis:6379/0`
    - `DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/cosmeles`

owner 结论：
- 将 `runtime-phase-5 / phase-19` 视为完成。
- 该轮已足够进入 `runtime-phase-6 / phase-20`。
- phase-20 的唯一目标是按固定顺序推进多机拆分：`worker -> db -> api -> web`。

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-19 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/worker-a.prompt.md`

一句简评：
- 这轮守 lock/cache/pool/downgrade acceptance，不抢 capability truth 定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-19 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-5 truth owner，先把 external PG / Redis 的使用边界和 adapter 语义冻住。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-19 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-19/worker-c.prompt.md`

一句简评：
- 这轮只做 deployment profile / compose/env / config switch adoption 与 smoke，前提是 Worker B 已冻结 capability 真相。
