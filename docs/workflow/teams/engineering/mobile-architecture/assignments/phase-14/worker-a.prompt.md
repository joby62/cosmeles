# Phase 14 Worker A Prompt

你是 Worker A，当前轮次仍是 `phase-14`，但当前 live task 已进入 deploy-gate follow-up。

你的角色不变：verification / acceptance owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/deploy-gate-followup.md`

当前目标：
- 你负责 phase-14 的第一轮真实验证，不负责定义 backend seam。
- 你的目标是把 `single_node` 的真实 deploy smoke 跑起来，证明当前分支已经不是代码 blocker，而只剩环境 blocker 或通过 gate。
- 你必须自己完成第一轮验证，不把 smoke 验证转包给 Owner。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/frontend/app/**`
- `/Users/lijiabo/Documents/New project/docker-compose.*`

建议起手：
- 先看 `deploy-gate-followup.md`
- 再确认当前 `single_node` env skeleton 和 health/readiness contract
- 最后在有 Docker daemon 的环境执行真实 smoke

交付标准：
- 给 Owner 一个清晰的 smoke verdict：`green | yellow | red`
- 证明当前 `single_node` smoke 的失败点到底是环境、compose、container boot，还是健康检查
- 不为了通过 smoke 去反向修改 backend 真相边界

必须验证：
- `cd /Users/lijiabo/Documents/New project && docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config`
- 在有 Docker daemon 的环境执行：`cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`
- `curl -sS http://127.0.0.1:8000/healthz`
- `curl -sS -i http://127.0.0.1:8000/readyz`
- `curl -I http://127.0.0.1:5001`
- 如果你改了测试或 health/readiness：`cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- 当前环境没有 Docker daemon，导致真实 smoke 无法执行
- smoke 失败点已经越出你的 write scope
- 你发现 health/readiness contract 与 deploy-gate-followup 的 freeze 直接冲突
