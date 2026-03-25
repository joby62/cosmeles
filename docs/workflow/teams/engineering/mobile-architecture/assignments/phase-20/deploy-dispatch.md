---
doc_id: mobile-phase-20-deploy-dispatch
title: Mobile Phase 20 Deploy Dispatch
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

# Phase 20 Deploy Dispatch

phase-20 对应 `runtime-phase-6`，目标是把当前已模块化、已具外置 PG / Redis capability 的单机运行面，按固定顺序平移到多机 fully modular 拓扑：`worker -> db -> api -> web`。

本轮只做 4 类事：
- 冻结拆机顺序、灰度策略、回滚策略、readiness / observability contract
- 做暗启动、流量切分、单节点/多节点一致性与回滚 acceptance
- 做 worker pool、DB role、API/Web service wiring、LB/profile/config adoption 与 smoke
- 保持 phase-19 的外置 PG / Redis capability truth 不回退，不重开 selection-result / job semantics

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 迁移顺序固定：`worker -> db -> api -> web`
- 不允许并行推进两个真相层 cutover
- 每一步必须可暗启动、可灰度、可回滚
- 本轮不改产品层 route / analytics 真相
- 本轮不重开 selection-result / compare / upload / product-workbench 的运行时语义

当前 owner 结论：
- `green`

当前已确认事实：
- `runtime-phase-5 / phase-19` 已达到 follow-up integration gate `green`
- external PostgreSQL / Redis capability boundary、lock/cache/pool/downgrade、profile config-switch 已冻结完成
- 当前路线图只剩最后一阶段：多机拆分与 rollout discipline
- Worker B 已完成 rollout truth freeze，并给出 Worker C = `go`
- Worker A 已完成 dark-start / readiness / rollback / consistency acceptance first-pass verification
- Worker C 已完成 multi-node wiring / LB-profile adoption / config smoke，profile 不再隐藏单机 host 假设
- owner 抽检：
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `30 passed`

## 本轮排期

Owner
- [2026-03-25 10:30 Asia/Shanghai] 冻结 `runtime-phase-6` 唯一真相、禁区、write scope，正式发 phase-20 assignment。
- [2026-03-25 11:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断拆机顺序、service boundary、rollback contract 是否冻结。
- [2026-03-25 11:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 dark-start / rollback / readiness acceptance 是否可继续。
- [2026-03-25 12:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 compose/env/LB/service wiring adoption 与 smoke。
- [2026-03-25 16:00 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-20 integration gate。
- [2026-03-25 17:30 Asia/Shanghai] 若 integration gate 通过，冻结 phase-20 deploy-prep scope，并决定是否进入最终 rollout rehearsal / archive 收口。

Worker B
- [2026-03-25 10:35 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结多机 rollout 顺序、service boundary、worker/db/api/web 角色责任、回滚与一致性 contract。
- [2026-03-25 11:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 10:35 Asia/Shanghai] 与 Worker B 并行，先补 dark-start / readiness / rollback / alertability / consistency acceptance。
- [2026-03-25 11:30 Asia/Shanghai] 回 `green|yellow|red`，说明验证入口是否齐备。

Worker C
- [2026-03-25 10:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 12:00 Asia/Shanghai] 若 Worker B = `green`，开始做 worker pool、DB/API/Web split wiring、compose/env/LB/profile adoption 与 smoke。
- [2026-03-25 16:00 Asia/Shanghai] 回 `green|yellow|red`，说明多机 wiring 是否已遵守固定顺序且不依赖单机假设。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成 rollout truth 冻结，C 才能进入大面积 wiring adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-20 integration gate
  - phase-20 是当前 roadmap 最后一个执行阶段；只有其 gate 通过，才进入最终 rollout rehearsal / archive 收口

## First Owner Gate - 2026-03-25

owner 复核结论：`yellow`

owner 已复核通过的证据：
- Worker A：`green`
- Worker B：`green`，并已明确给 Worker C = `go`
- owner 抽检：
  - `backend/app/services/runtime_rollout.py` 已将固定顺序、角色边界、回滚与一致性 contract 收拢到单一可观测对象
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `30 passed`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `173 passed`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`

当前 yellow blocker：
- 当前仓库与 config/smoke 已经收口，但真实目标环境上的 dark-start / gray rollout / rollback rehearsal 还未由 Owner 执行。
- 因此当前只能证明：
  - rollout truth 已冻结为可继续状态
  - verification / acceptance 已具备 owner gate 的基础证据
  - multi-node wiring / profile config-switch 已脱离隐藏单机假设
- 还不能证明：
  - 目标环境上的 dark-start / gray rollout / rollback 已通过
  - phase-20 deploy gate 已完成

owner 判断：
- phase-20 当前不是 rollout truth blocker，也不是 acceptance blocker。
- 当前 gate 卡点只剩 owner-side 真实环境演练。
- 在真实目标环境演练完成前，不做 phase-20 green 判定，也不做最终 archive 收口。

## Follow-Up Schedule

Owner
- [2026-03-25 07:20 Asia/Shanghai] 冻结 phase-20 first gate `yellow` 结论，维持当前唯一 freeze。
- [2026-03-25 07:20 Asia/Shanghai] 基于 Worker B `green/go`，正式放行 Worker C 进入 multi-node wiring / LB-profile adoption / smoke。
- [2026-03-25 16:00 Asia/Shanghai] 收 Worker C 结果，做 phase-20 follow-up integration gate。
- [2026-03-25 17:30 Asia/Shanghai] 在真实目标环境执行 owner-side dark-start / gray rollout / rollback rehearsal。

Worker C
- [2026-03-25 07:20 Asia/Shanghai] 开始或继续执行 worker/db/api/web 固定顺序下的 multi-node wiring / smoke。
- [2026-03-25 16:00 Asia/Shanghai] 回 `green|yellow|red`，说明多机 wiring 是否已遵守固定顺序且不依赖单机假设。

## Follow-Up Gate Result - 2026-03-25

owner follow-up 复核结论：`green`

follow-up 已收口项：
- Worker C 已把 frontend compose 中的 `BACKEND_HOST/BACKEND_PORT` 改为 profile-aware 插值，避免 build-time / runtime 隐式回退到单机 `backend`。
- `.env.single-node.example`、`.env.split-runtime.example`、`.env.multi-node.example` 已补齐 `BACKEND_HOST/BACKEND_PORT`，并统一同步到 phase-20 / runtime-phase-6 语义。
- `single_node / split_runtime / multi_node` 三套 profile 的 frontend/runtime wiring 已确认不回退到隐藏单机 host 假设。
- phase-20 的 rollout truth、acceptance、multi-node wiring smoke 已形成同一套仓库内 gate 证据。
- owner 已补齐 runtime image 依赖缺口：
  - `psycopg[binary]`
  - `redis`
  使 split-runtime 的 PostgreSQL / Redis contract 能在真实 `docker compose up` 下启动成功。

owner follow-up 验证：
- Worker A：
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `30 passed`
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `173 passed`
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
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> frontend `BACKEND_HOST=backend`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> frontend `BACKEND_HOST=api`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> frontend `BACKEND_HOST=api-internal`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `173 passed`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml up -d --build postgres backend worker frontend` -> `green`
  - `docker compose -f docker-compose.prod.yml ps` -> backend / worker / postgres `healthy`, frontend `up`
  - `curl -sS -i http://127.0.0.1:8000/healthz` -> `200 OK`
  - `curl -sS -i http://127.0.0.1:8000/readyz` -> `200 OK`
  - `curl -sS -i http://127.0.0.1:5001` -> `200 OK`
  - `docker exec cosmeles-worker python -c ...` -> `{"runtime_role":"worker","worker_runtime_expected":true,"api_routes_enabled":false}`

owner 结论：
- `runtime-phase-6 / phase-20` 已完成仓库内代码、contract、compose、profile 与真实 split-runtime deploy gate 收口。
- runtime 7-phase 路线在仓库与本地 deploy gate 层面视为完成。
- 目标环境的灰度与回滚仍然是后续运维动作，但不再构成 source-repo blocker。

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-20 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/worker-a.prompt.md`

一句简评：
- 这轮守 dark-start、readiness、rollback、consistency 和 observability acceptance，不抢 rollout truth 定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-20 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-6 truth owner，先把多机 rollout 顺序、角色责任、回滚与一致性 contract 冻住。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-20 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-20/worker-c.prompt.md`

一句简评：
- 这轮只做多机 deployment profile / compose/env / LB/service wiring adoption 与 smoke，前提是 Worker B 已冻结 rollout 真相。
