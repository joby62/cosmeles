# Phase 14 Deploy Dispatch

phase-14 对应 `runtime-phase-0`，目标不是切存储或拆机器，而是先把运行时边界拆出来。

本轮只做 4 类事：
- `storage / repository / queue / lock / asset url` seam 抽象
- 单机 profile 的 env / profile skeleton
- 最小 caller adoption，不改产品行为
- contract / verification / acceptance skeleton

本轮唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

额外规则：
- 本轮不切 PostgreSQL 单真相
- 本轮不上对象存储正式读写 cutover
- 本轮不把 compare / upload 改成真实 job + worker 执行
- 本轮不改产品页面 IA、CTA、questionnaire 行为
- 本轮只允许“边界抽取 + wiring 预留 + 验证骨架”，不允许顺手扩 scope

## 本轮排期

Owner
- [2026-03-24 02:50 Asia/Shanghai] 冻结 `runtime-phase-0` 唯一真相、禁区、write scope，正式发 phase-14 assignment。
- [2026-03-24 03:20 Asia/Shanghai] 收 Worker A / Worker B 首轮 `green|yellow|red`，决定 Worker C 是否放行。
- [2026-03-24 04:10 Asia/Shanghai] 收 Worker C 首轮结果，做 owner integration gate。
- [2026-03-24 04:40 Asia/Shanghai] 若 A/B/C 全绿，开始收口 phase-14 docs / record / review 准备；若有阻塞，继续下一轮补工。

Worker B
- [2026-03-24 02:55 Asia/Shanghai] 先做，作为本轮 `truth owner`，先冻结 backend seam：`repository / storage / queue / lock` 的接口与默认 local adapter。
- [2026-03-24 03:20 Asia/Shanghai] 回 `green|yellow|red`，并明确告诉 Worker C 是 `go` 还是 `hold`。

Worker A
- [2026-03-24 02:55 Asia/Shanghai] 与 Worker B 并行，先补 contract / verification / env skeleton，不抢 B 的真相层语义。
- [2026-03-24 03:20 Asia/Shanghai] 回 `green|yellow|red`，说明 env、tests、health/readiness skeleton 是否已跟上。

Worker C
- [2026-03-24 02:55 Asia/Shanghai] `waiting for Worker B green`
- [2026-03-24 03:25 Asia/Shanghai] 若 Worker B = `green`，开始做 frontend/runtime caller 与 compose wiring 的最小 adoption，不改产品行为。
- [2026-03-24 04:05 Asia/Shanghai] 回 `green|yellow|red`，说明 caller / config / compose 是否已能承接下一 phase。

顺序规则：
- 先做：Owner + Worker B
- 并行：Worker A 与 Worker B
- 等待：Worker C 等 Worker B `green`
- Owner 下一步 gate：
  - 只有 B 完成真相冻结，C 才能进入大面积 adoption
  - 只有 A/B/C 全部不为 `red`，Owner 才能进入 phase-14 integration gate
  - 只有 integration gate 通过，才允许收成提交或开启 `runtime-phase-1`

## Worker A

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`

phase-14 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/worker-a.prompt.md`

一句简评：
- 这轮守 runtime contract、env skeleton、health/readiness 和 acceptance，不抢 backend seam 定义权。

起手建议：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/backend/tests/`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`

## Worker B

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`

phase-14 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/worker-b.prompt.md`

一句简评：
- 这轮你是 runtime seam `truth owner`，先把 backend 的 adapter 边界抽出来，不切运行时真相。

起手建议：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/backend/app/services/storage.py`
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_results.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`

## Worker C

长期 handoff：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

phase-14 assignment：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/worker-c.prompt.md`

一句简评：
- 这轮只做最小 caller / config / compose adoption，前提是 Worker B 已经把 seam 冻结出来。

起手建议：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`

## Owner 派工口径

给 Worker A：
- 你本轮只补 runtime contract / env / verification skeleton，不定义 backend truth seam，也不切业务行为。

给 Worker B：
- 你本轮先冻结 backend seam，尽量把本地文件、线程、直连依赖包进 adapter，不提前切 PostgreSQL / object storage / queue 后端。

给 Worker C：
- 你本轮等 Worker B `green` 后再接 caller / compose / profile adoption；不要反向决定 backend seam，也不要顺手改页面体验。
