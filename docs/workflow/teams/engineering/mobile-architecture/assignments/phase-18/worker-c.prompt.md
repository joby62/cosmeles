# Phase 18 Worker C Prompt

你是 Worker C，当前轮次是 phase-18，对应 `runtime-phase-4` 的 caller adoption / status smoke owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-18/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 job 真相后，接 compare / upload / result build caller adoption 与状态页 / SSE smoke。
- 本轮不改 selection-result 真相，不切 Redis，不切多机拆分。
- 当前 yellow follow-up 还要覆盖 product pipeline / workbench 上的 result-build 状态面，不只是 `/m` 下的 compare/upload。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

等待条件：
- `waiting for Worker B green`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/**`
- `/Users/lijiabo/Documents/New project/frontend/components/workbench/**`
- `/Users/lijiabo/Documents/New project/frontend/components/MobileSelectionResultGenerator.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/**`
- `/Users/lijiabo/Documents/New project/frontend/app/product/**`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/workers/**`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 compare / upload / result build caller 是否已脱离 API 内线程执行
- 若需修复，只做 caller / wiring / smoke 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

本轮优先检查：
- 先等 Worker B 的 `go`
- B `green` 后重跑 `/m` compare/upload 与 `/product/pipeline` result-build 状态面 smoke
- 明确前端是否仍假设 API 进程内即时执行，而不是 job status 轮询 / 读取模型

升级给 Owner：
- Worker B 的 job truth 冻结不足以支撑 caller adoption
- 当前 wiring 修复已经需要改 backend 真相层
- 你发现 phase-18 实际已经越到 phase-19
