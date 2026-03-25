# Phase 17 Worker A Prompt

你是 Worker A，当前轮次是 phase-17，对应 `runtime-phase-3` 的 schema / backfill / completeness verification owner。

先读：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/phase-17/deploy-dispatch.md`

当前目标：
- 作为 verification owner，补齐 phase-17 yellow follow-up 的 acceptance 证据。
- 当前不是开 phase-18；这轮只补 PG payload 直读、payload-missing、artifact-copy-only、profile self-consistency 的验证缺口。
- 本轮不抢 Worker B 的 PG payload model 与 repository 定义权；只围绕 freeze 后的真相补验证与 acceptance。

唯一 freeze：
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md`

写入范围：
- `/Users/lijiabo/Documents/New project/backend/tests/**`

不要动：
- `/Users/lijiabo/Documents/New project/backend/app/domain/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/application/mobile/**`
- `/Users/lijiabo/Documents/New project/backend/app/platform/**`
- `/Users/lijiabo/Documents/New project/frontend/**`

交付标准：
- 给 Owner 一个 `green | yellow | red`
- 明确 selection-result payload-missing、PG payload 直读、artifact-copy-only、profile self-consistency 是否自洽
- 若需修复，只做 verification / acceptance 范围修复

必须先自行验证：
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests`

本轮优先检查：
- `SELECTION_RESULT_PAYLOAD_MISSING` 是否有定向断言
- PG payload 在线读路径是否有 acceptance 覆盖，而不是只靠全量回归兜底
- artifact-copy-only 策略是否有可执行验证
- profile contract 是否与 phase-17 真相一致

升级给 Owner：
- Worker B 的 PG payload / repository freeze 尚未形成，导致 completeness gate 无法落地
- 旧新读一致性需要伴随真相层一起改
- 你发现当前 phase-17 实际已经越到 phase-18
