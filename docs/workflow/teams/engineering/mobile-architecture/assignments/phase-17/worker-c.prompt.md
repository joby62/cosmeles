# Phase 17 Worker C Prompt

你是 Worker C，当前轮次是 phase-17，对应 `runtime-phase-3` 的 result caller / history adoption。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/deploy-dispatch.md`

当前目标：
- 在 Worker B 冻结 selection-result PG 单真相后，接 result caller、历史链路、compare bootstrap adoption smoke。
- 当前是 phase-17 yellow follow-up，不新开 phase-18；这轮重点是确认 caller/history/compare bootstrap 在 B 收口后没有残留旧在线文件依赖。
- 本轮不切真实 job system，不切 Redis，不切多机拆分。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

等待条件：
- `waiting for Worker B green`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/**`
- `/Users/lijiabo/Documents/New project/frontend/app/m/**`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 result caller、history、compare bootstrap 是否已脱离旧在线文件读路径
- 若需修复，只做 caller / wiring / smoke 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`

本轮优先检查：
- 先等 Worker B 的 `go`
- B `green` 后重跑 result caller / history / compare bootstrap smoke
- 明确 caller 链路是否仍依赖任何本地文件在线读语义，而不是只看页面能否打开

升级给 Owner：
- Worker B 的 PG 真相冻结不足以支撑 caller adoption
- 当前 wiring 修复已经需要改 backend truth seam 之外的真相层
- 你发现 phase-17 实际已经越到 phase-18
