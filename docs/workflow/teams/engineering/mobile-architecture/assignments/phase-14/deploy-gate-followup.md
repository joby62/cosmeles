---
doc_id: mobile-phase-14-deploy-gate-followup
title: Mobile Phase 14 Deploy Gate Follow-up
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

# Phase 14 Deploy Gate Follow-up

这个 follow-up 继续服务 `phase-14 = runtime-phase-0`，不是开启 `phase-15`。

当前 owner 结论：
- `green`

当前目标：
- 把 `phase-14` 从 `branch integration green` 推进到明确的 deploy gate verdict
- 先把代码 readiness、profile wiring readiness、环境 blocker 分开
- 在真实 `docker compose` smoke 完成前，不推进 `runtime-phase-1`

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

## 当前已确认事实

- backend `healthz / readyz` 在应用内 smoke 下返回 `200`
- `docker compose config` 已能在默认环境、`single_node`、`split_runtime`、`multi_node` 三套 env skeleton 下展开
- frontend `prod compose` 的运行时 `INTERNAL_API_BASE` 已修正为 profile-aware 插值，不再只在 build args 生效
- backend 全量 `pytest backend/tests` 已恢复为绿色
- owner 已完成真实 `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`
- owner 已完成 host-level smoke：
  - `http://127.0.0.1:8000/healthz`
  - `http://127.0.0.1:8000/readyz`
  - `http://127.0.0.1:5001`
- phase-14 当前已不再存在 deploy-gate blocker

## Worker A

owned scope：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`

当前任务：
- 审核并补强 `healthz / readyz` 的 phase-14 contract 证明
- 如果缺失，补一个最小验证，证明 runtime profile 和 readiness 在 `single_node` 本地后端下稳定返回
- 检查 env skeleton 是否还有和当前 compose wiring 不一致的字段

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/frontend/**`

必须回报：
- `green | yellow | red`
- 缺的是测试证据、contract 证据，还是环境证据
- 如果改代码，列出最小 diff 和验证命令

## Worker B

owned scope：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_results.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/backend/app/settings.py`

当前任务：
- 审核 phase-14 seam 是否还有“必须现在收口”的直连漏点
- 明确哪些 local-only 实现是 phase-14 可接受残留，哪些已越过 deploy gate 容忍线
- 对 Worker A / Worker C 的结论给出 backend truth owner 视角的最终裁定

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docker-compose.*`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

必须回报：
- `green | yellow | red`
- 哪些残留属于 phase-14 合法 fallback
- 哪些问题会阻止 phase-15 开启

## Worker C

owned scope：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/frontend/Dockerfile.prod`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`

当前任务：
- 审核 API origin / asset origin / profile wiring 是否在 build-time 与 runtime 一致
- 扫出剩余硬编码 origin、asset fallback、mixed-content / proxy 风险
- 复核 `split_runtime` 与 `multi_node` 在 compose config 层是否还有回退到单机地址的口子

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`

必须回报：
- `green | yellow | red`
- 哪些问题是 wiring blocker，哪些只是下一 phase 的预留项
- 若改代码，必须同时给出 `tsc` / `build` 结果

## Owner 审核口径

- A 侧必须证明 `healthz / readyz` 与 env skeleton 没有自相矛盾
- B 侧必须证明 phase-14 seam 已收口到“可以 deploy-prep、但尚未切真后端”的边界
- C 侧必须证明 profile wiring 在 build-time 和 runtime 没有分叉
- 任一 worker = `red`，不开 integration gate
- 全部非 `red` 但真实 compose smoke 仍缺失时，owner 维持 `yellow`
- 当前代码验证已经足够支撑 deploy-prep，剩余 blocker 仅允许被记录为环境级 blocker，不再混同为代码 blocker
- 真实 `docker compose up` + 基础健康检查已完成，phase-14 deploy gate 已由 owner 提升为 `green`

## Owner 必做验证

- 审核 Worker A / B / C 的 diff 是否都还在各自 write scope 内
- 复核 backend 全量验证：
  - `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`
- 复核 frontend 验证：
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
- 复核 compose/profile 展开：
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config`
  - `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config`
- 已完成真实 smoke：
  - `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`
  - `curl -sS http://127.0.0.1:8000/healthz`
  - `curl -sS -i http://127.0.0.1:8000/readyz`
  - `curl -I http://127.0.0.1:5001`
- Owner 最终决定：
  - `phase-14 = deploy gate green`
  - `runtime-phase-1 -> phase-15` 可以进入 active 执行轮

## 当前排期

- `2026-03-24 17:30 Asia/Shanghai`：Owner 发出 follow-up assignment，冻结本轮 gate 目标
- `2026-03-24 18:15 Asia/Shanghai`：收 Worker A / B 首轮状态与 diff 审核结论
- `2026-03-24 18:45 Asia/Shanghai`：收 Worker C 首轮状态与 wiring 审核结论
- `2026-03-24 19:10 Asia/Shanghai`：Owner 做 phase-14 gate 复核，判断是 `yellow-pending-env` 还是进入实机 smoke
- `2026-03-24 18:27 Asia/Shanghai`：Owner 完成真实 `docker compose` smoke，phase-14 提升为 deploy gate `green`
