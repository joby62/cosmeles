# Phase 15 Worker A Prompt

你是 Worker A，当前轮次是 phase-15，对应 `runtime-phase-1` 的 verification / health / env owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-15/deploy-dispatch.md`

当前目标：
- 作为 verification owner，先把 `web / api / worker / postgres` 四模块需要的 env、health、probe、验证骨架补齐。
- 本轮不抢 Worker B 的 API / worker 边界定义权；只围绕 freeze 后的拓扑补验证与 acceptance。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`
- `/Users/lijiabo/Documents/New project/backend/app/main.py`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`
- `/Users/lijiabo/Documents/New project/frontend/app/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 `web/api/worker/postgres` 的 health / probe / env 是否自洽
- 若需修复，只做 verification / acceptance 范围修复

必须验证：
- `cd /Users/lijiabo/Documents/New project && docker compose -f docker-compose.prod.yml config`
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- 当前拓扑定义未冻结，导致验证骨架无法落地
- health / probes 必须伴随 Worker B 的入口拆分一并调整
- 你发现当前 phase-15 实际已经越到 phase-16
