# Phase 14 Worker C Prompt

你是 Worker C，当前轮次仍是 `phase-14`，但当前 live task 已进入 deploy-gate follow-up。

你的角色不变：frontend/runtime wiring owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/deploy-gate-followup.md`

当前目标：
- 你现在不再负责新增 wiring，而是负责 deploy gate 前的 frontend/runtime 侧最终确认。
- 你的目标是确认 build-time 与 runtime 的 API/asset/profile wiring 一致，并在真实 smoke 失败时做 frontend 侧定位。
- 你必须自己完成第一轮 frontend 验证，不把 `tsc` / `build` / config 展开转包给 Owner。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/frontend/lib/**`
- `/Users/lijiabo/Documents/New project/frontend/next.config.ts`
- `/Users/lijiabo/Documents/New project/frontend/Dockerfile.prod`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/**`

建议起手：
- 先看 `deploy-gate-followup.md`
- 再确认 `frontend/lib/api.ts`、`frontend/next.config.ts`、`Dockerfile.prod`、`docker-compose.prod.yml`
- 如果 A 的 smoke 失败，优先判定是 runtime env、rewrite、proxy、asset fallback 还是 mixed-content 回退

交付标准：
- 给 Owner 一个 frontend/runtime verdict：`green | yellow | red`
- 明确哪些是 deploy gate blocker，哪些只是 phase-15 预留项
- 若需修复，只做最小 deploy-gate 范围修复，不改产品行为

必须验证：
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run build`
- 如果 A 已经拉起 smoke 环境：`curl -I http://127.0.0.1:5001`

升级给 Owner：
- 当前 wiring 修复已经需要改 backend truth seam
- 真实 smoke 暴露出 mixed-content / proxy / asset fallback blocker
- 当前修复会导致页面行为变化或越出 phase-14
