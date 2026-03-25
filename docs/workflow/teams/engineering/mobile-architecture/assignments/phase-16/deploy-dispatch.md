---
doc_id: mobile-phase-16-deploy-dispatch
title: Mobile Phase 16 Deploy Dispatch
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
  - mobile-architecture-v2
---

# Phase 16 Deploy Dispatch

phase-16 对应 `runtime-phase-2`，目标是把图片、用户上传图、公开 artifact 的在线交付从本地盘推进到对象存储 / CDN 语义，并把 `www / api / assets` 三类流量职责正式拆开。

当前 owner 结论：
- `green`

当前已确认事实：
- object-storage contract 已进入代码层：
  - runtime storage 已支持 `object_storage_contract`
  - 已有 `object_key`、`signed_url`、private-prefix contract
- frontend/runtime wiring 已支持资产域：
  - `ASSET_PUBLIC_ORIGIN`
  - `NEXT_PUBLIC_ASSET_BASE`
  - `NEXT_COMPRESS`
- owner 复核通过：
  - backend 全量 `pytest backend/tests` = `152 passed`
  - frontend `npx tsc --noEmit` = green
  - frontend `npm run build` = green
  - `docker compose config` 在 `single_node / split_runtime / multi_node` 三套 env 下均为 green
- split/multi profile 已完成 phase-16 follow-up：
  - `STORAGE_BACKEND=object_storage_contract`
  - `ASSET_OBJECT_KEY_PREFIX`
  - `ASSET_SIGNED_URL_TTL_SECONDS`
  - `ASSET_SIGNED_URL_ENFORCED`
  - `ASSET_SIGNING_SECRET`
- frontend 复核确认：
  - 有资产域时不再保留 `/images`、`/user-images` rewrite
  - 无资产域时仍保留本地 fallback

当前 owner 定案：
- phase-16 的 yellow blocker 已清空
- A / B / C 本轮全部 `green`
- `runtime-phase-2 / phase-16` 已达到 owner integration gate `green`
- 可以开启 `runtime-phase-3 -> phase-17`

## 当前追加派工

Worker B
- [2026-03-25 18:10 Asia/Shanghai] 把 split/multi profile 的 backend storage runtime 正式切到 `object_storage_contract`
- [2026-03-25 18:10 Asia/Shanghai] 补 `ASSET_OBJECT_KEY_PREFIX`、`ASSET_SIGNED_URL_TTL_SECONDS`、`ASSET_SIGNED_URL_ENFORCED` 的 settings / compose / env contract
- [2026-03-25 18:50 Asia/Shanghai] 回第二轮修订后的 `green|yellow|red`

Worker A
- [2026-03-25 18:10 Asia/Shanghai] 补 env/contract 验证，明确 split/multi profile 不再停留在 `local_fs`
- [2026-03-25 18:10 Asia/Shanghai] 补 object-storage contract 的 self-consistency 测试，不只验证 `ASSET_PUBLIC_ORIGIN`
- [2026-03-25 18:50 Asia/Shanghai] 回第二轮修订后的 `green|yellow|red`

Worker C
- [2026-03-25 18:10 Asia/Shanghai] 在 Worker B 冻结后，补 frontend/compose wiring，使资产域 profile 在 build-time 和 runtime 都跟 backend contract 对齐
- [2026-03-25 18:10 Asia/Shanghai] 重点复核“有资产域时不再走本地 rewrite；无资产域时仍有 fallback”
- [2026-03-25 19:10 Asia/Shanghai] 回第二轮修订后的 `green|yellow|red`

本轮只做 4 类事：
- 冻结 object storage / asset URL / object key / signed URL contract
- 让 frontend / compose / env 能承接 `www / api / assets` 分层
- 做 cache / header / compression / smoke 的验证骨架
- 做图片、上传、公开 artifact 的最小 adoption，不提前切 phase-17 之后的真相层

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切 selection result 的 PostgreSQL 单真相
- 本轮不切 compare / upload / result build 的真实 job system
- 本轮不切 Redis 锁/缓存能力
- 本轮不切多机拆分
- 本轮允许先以 contract / adapter / url generation / compose wiring 的方式落地，不要求当天接入真实云厂商

## 本轮排期

Owner
- [2026-03-25 09:30 Asia/Shanghai] 冻结 `runtime-phase-2` 唯一真相、禁区、write scope，正式发 phase-16 assignment。
- [2026-03-25 10:15 Asia/Shanghai] 收 Worker B 首轮 `green|yellow|red`，判断 object storage contract 和 asset URL 规则是否冻结。
- [2026-03-25 10:30 Asia/Shanghai] 收 Worker A 首轮验证状态，确认 cache / header / compression / env 骨架是否可继续。
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B 已 `green`，放行 Worker C 做 compose / wiring / asset adoption。
- [2026-03-25 15:30 Asia/Shanghai] 收 Worker A / B / C 第二轮结果，做 phase-16 integration gate。
- [2026-03-25 17:30 Asia/Shanghai] 若 integration gate 通过，冻结 phase-16 deploy-prep scope。
- [2026-03-25 19:20 Asia/Shanghai] 收当前补强轮 A/B/C 结果，判断 phase-16 是继续 `yellow` 还是进入 deploy-prep。
- [2026-03-25 20:00 Asia/Shanghai] A/B/C 全部 `green` 且 profile 已正式切到 object-storage contract，phase-16 owner gate 通过。

Worker B
- [2026-03-25 09:35 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 object storage contract、asset public URL 规则、object key 规则、signed URL 语义。
- [2026-03-25 10:15 Asia/Shanghai] 回 `green|yellow|red`，并明确告知 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-25 09:35 Asia/Shanghai] 与 Worker B 并行，先补 cache / header / compression / env / acceptance skeleton。
- [2026-03-25 10:30 Asia/Shanghai] 回 `green|yellow|red`，说明验证入口是否齐备。

Worker C
- [2026-03-25 09:35 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-25 11:00 Asia/Shanghai] 若 Worker B = `green`，开始做 frontend / compose / env / asset adoption。
- [2026-03-25 15:30 Asia/Shanghai] 回 `green|yellow|red`，说明 `www / api / assets` 编排与 smoke 是否可继续承接下一 gate。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成 object storage / asset URL 冻结，C 才能进入大面积 adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-16 integration gate
  - 只有 integration gate 通过，才允许进入 `runtime-phase-3`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-16 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/worker-a.prompt.md`

一句简评：
- 这轮守 cache、header、compression、env 和 acceptance，不抢 object storage backend 的定义权。

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-16 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime-phase-2 truth owner，先把 storage adapter、asset URL、object key 和签名访问语义冻结出来。

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-16 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-16/worker-c.prompt.md`

一句简评：
- 这轮只做 `www / api / assets` wiring、Next/compose adoption 和 smoke，前提是 Worker B 已经把 object storage 与 asset URL 语义冻结出来。
