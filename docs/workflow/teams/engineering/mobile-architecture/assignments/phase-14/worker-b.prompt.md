# Phase 14 Worker B Prompt

你是 Worker B，当前轮次是 phase-14，对应 `runtime-phase-0` 的 backend seam extraction。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/deploy-dispatch.md`

当前目标：
- 作为本轮 `truth owner`，先抽出 backend 的 `repository / storage / queue / lock` seam。
- 本轮只做接口与默认 local adapter，不切 PostgreSQL/object storage/redis/job queue 真后端。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/services/storage.py`
- `/Users/lijiabo/Documents/New project/backend/app/services/mobile_selection_results.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/mobile.py`
- `/Users/lijiabo/Documents/New project/backend/app/routes/ingest.py`

不要动：
- `/Users/lijiabo/Documents/New project/frontend/**`
- `/Users/lijiabo/Documents/New project/docker-compose.*`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/**`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/**`

建议起手：
- 先看 runtime plan 的 `runtime-phase-0`
- 再扫 `storage.py`、`mobile_selection_results.py`、`mobile.py`、`ingest.py`
- 先定最小 seam 和默认 local adapter，再回填调用方

交付标准：
- backend 已有统一 seam，不再到处直读本地文件、直起线程、写死后端实现
- 当前本地行为仍保持可运行
- 后续 phase 可以只换 adapter / config，不用重写业务层
- 给 Worker C 一个明确的 `go` 或 `hold`

必须验证：
- `cd /Users/lijiabo/Documents/New project/backend && python3 -m py_compile app/routes/mobile.py app/routes/ingest.py app/services/storage.py app/services/mobile_selection_results.py`

升级给 Owner：
- phase-0 若不先补 DB schema，将导致 seam 无法自洽
- 当前某条运行时链路无法在不切真相的前提下抽 seam
- scope 已经越过 phase-0，必须提前进入 PostgreSQL / object storage / queue 真切换
