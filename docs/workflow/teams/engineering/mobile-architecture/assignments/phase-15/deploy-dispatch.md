---
doc_id: mobile-phase-15-deploy-dispatch
title: Mobile Phase 15 Deploy Dispatch
doc_type: assignment
initiative: mobile
workstream: workflow
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-24
updated_at: 2026-03-24
completed_at: 2026-03-24
related_docs:
  - mobile-runtime-infrastructure-upgrade-plan-v1
---

# Phase 15 Deploy Dispatch

phase-15 对应 `runtime-phase-1`，目标是把当前单机运行正式拆成 `web / api / worker / postgres` 四块，而不是继续停留在“一个 backend 进程兼容所有职责”的形态。

当前 owner 结论：
- `green`

当前已确认事实：
- `docker-compose.prod.yml` 与 `docker-compose.dev.yml` 都已落成 `web / api / worker / postgres` 单机四模块拓扑。
- worker runtime 已从 API 进程职责中拆出：
  - `runtime_role=worker`
  - `api_routes_enabled=false`
- owner 复核通过：
  - backend 全量 `pytest backend/tests` = `150 passed`
  - frontend `npx tsc --noEmit` = green
  - frontend `npm run build` = green
  - `docker compose -f docker-compose.prod.yml config` = green
- 实机 smoke 已通过：
  - `docker compose -f docker-compose.prod.yml up -d --build postgres backend worker frontend`
  - `healthz` = `200`
  - `readyz` = `200`
  - frontend entry = `200`
  - SSE compare stream 返回 `accepted / progress / error / done` 事件流
- phase-15 已达到 integration gate 与 deploy-prep gate，可正式开启 `runtime-phase-2 -> phase-16`

本轮只做 4 类事：
- 单机 `web / api / worker / postgres` 拓扑落盘
- API / worker 入口与职责边界拆分
- compose / env / health / probe 适配单机模块化
- SSE 与普通页面链路的最小 smoke 验证

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切对象存储正式真相
- 本轮不切 `www/api/assets` 三域正式上线
- 本轮不切 selection result 的 PostgreSQL 单真相
- 本轮不切 compare / upload / result build 的真实 queue/job 系统
- 本轮只允许“单机模块化 + 入口拆分 + 编排验证”，不允许顺手推进 phase-16 之后的基础设施

## 本轮排期

Owner
- [2026-03-24 18:40 Asia/Shanghai] 冻结 `runtime-phase-1` 唯一真相、禁区、write scope，正式发 phase-15 assignment。
- [2026-03-24 19:20 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断 API/worker 入口拆分是否冻结。
- [2026-03-24 19:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 compose / health / probes 是否可继续。
- [2026-03-24 19:45 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做编排与 wiring adoption。
- [2026-03-24 20:30 Asia/Shanghai] 收 Worker C 首轮结果，做 phase-15 integration gate。

Worker B
- [2026-03-24 18:45 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 API / worker 的入口、职责边界和 DB 连接策略。
- [2026-03-24 19:20 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-24 18:45 Asia/Shanghai] 与 Worker B 并行，先补 `web/api/worker/postgres` 的 env / health / verification skeleton。
- [2026-03-24 19:30 Asia/Shanghai] 回 `green|yellow|red`，说明单机模块化的验证入口是否齐备。

Worker C
- [2026-03-24 18:45 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-24 19:45 Asia/Shanghai] 若 Worker B = `green`，开始做 compose / wiring / SSE vs page smoke adoption。
- [2026-03-24 20:30 Asia/Shanghai] 回 `green|yellow|red`，说明单机四模块编排是否能承接下一 phase。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成入口和职责冻结，C 才能进入大面积编排 adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-15 integration gate
  - 只有 integration gate 通过，才允许进入 `runtime-phase-2`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-15 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/worker-a.prompt.md`

一句简评：
- 这轮守 `web/api/worker/postgres` 的 health、probe、env、verification，不抢 backend 进程边界定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-15 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-1 truth owner，先拆 API / worker 入口与职责边界，不提前切 phase-16 之后的真后端。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-15 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/worker-c.prompt.md`

一句简评：
- 这轮只做单机四模块 compose / wiring adoption，前提是 Worker B 已经把 API / worker 边界冻结出来。
