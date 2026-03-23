# Phase 14 Worker A Prompt

你是 Worker A，当前轮次是 phase-14，对应 `runtime-phase-0` 的 contract / verification / env skeleton。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/deploy-dispatch.md`

当前目标：
- 作为 verification / contract worker，先把 phase-14 需要的 env skeleton、health/readiness、adapter contract tests 和 acceptance gate 补齐。
- 本轮不抢 backend seam 定义权；如果 Worker B 的接口还没冻结，先按最小 testing seam 接入，不发明第二套 contract。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`
- `/Users/lijiabo/Documents/New project/frontend/tests/**`
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

建议起手：
- 先看 runtime plan 的 `runtime-phase-0`
- 再看 `backend/tests/` 当前 coverage
- 再补 `.env.*.example` 和 readiness/health 的验证入口

交付标准：
- phase-14 需要的 env profile skeleton 已经存在
- adapter seam 至少有最小 contract tests
- health / readiness 验证不依赖未来 phase 才能补
- 不为了方便测试去反向决定 backend 真相层语义

必须验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

升级给 Owner：
- 现有测试基座无法支撑 adapter seam，而需要先重整测试目录
- health / readiness 必须伴随 compose / deployment 结构一起改，不适合单独补
- Worker B 定义的 seam 导致前后两套 contract 并存
