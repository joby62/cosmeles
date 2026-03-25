---
doc_id: mobile-postgresql-full-migration-plan-v1
title: Mobile PostgreSQL Full Migration Plan v1
doc_type: architecture
initiative: mobile
workstream: architecture
owner: architecture-owner
status: completed
priority: p0
created_at: 2026-03-25
updated_at: 2026-03-25
completed_at: 2026-03-25
related_docs:
  - mobile-architecture-v2
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-runtime-roadmap-closure-summary-v1
---

# Mobile PostgreSQL Full Migration Plan v1

## 1. 文档定位
- 本文是 runtime 7-phase 路线完成后的后续架构真相，用来治理“剩余 SQLite 结构化真相如何完整迁入 PostgreSQL”。
- 本文不是单次 phase 派工卡；phase 执行仍由 workflow dispatch 驱动。
- 本文覆盖：
  - `backend/app/db/models.py` 中仍依赖当前默认数据库的结构化表
  - 单机 `DATABASE_URL=sqlite:///.../app.db` 仍承担的在线结构化真相
  - 后台工作台、上传、产品索引、移动端 session / history / bag / analytics 等结构化状态
  - env / compose / runtime contract 如何把 PostgreSQL 提升为唯一生产结构化真相
- 本文不重开已完成的 runtime-phase-0 到 runtime-phase-6；对象存储、CDN、worker 拆分、rollout 顺序继续以既有 runtime 路线收口结果为基线。

## 1.1 当前执行状态
- 当前 active PostgreSQL migration phase：
  - `none`
- 当前 workflow 执行映射：
  - `none`
- 当前状态：
  - PostgreSQL full migration route 已完成 closure
  - `postgresql-phase-4 / phase-25` 已通过 owner integration gate
  - 不再存在 active PostgreSQL migration dispatch
- 当前 integration 状态：
  - `postgresql-phase-0 / phase-21` 已完成 inventory / truth freeze / acceptance freeze / adoption inventory，并通过 owner integration gate
  - `postgresql-phase-1 / phase-22` 已完成 production-default PostgreSQL contract cutover，并通过 owner integration gate
  - `postgresql-phase-2 / phase-23` 已完成高并发表组真实迁移，并通过 owner integration gate
  - `postgresql-phase-3 / phase-24` 已完成移动端状态表组真实迁移，并通过 owner integration gate
  - `postgresql-phase-4 / phase-25` 已完成 SQLite closure，并通过 owner integration gate
- 当前 owner 判断：
  - runtime 7-phase 路线保持 `completed`
  - `selection result` 已经是 PostgreSQL 单真相，不回退
  - production-default database contract、phase-23 高并发表组、phase-24 移动端状态表组都已切到 PostgreSQL 单真相
  - production profile 不再存在剩余 SQLite 在线结构化真相
  - SQLite 已收口为 `dev_or_emergency_fallback`
  - PostgreSQL full migration 路线已经闭环
  - PostgreSQL 全迁移要作为一个新的 architecture initiative 执行，不复用 phase-20

## 2. 为什么必须新开这条路线
- 当前 `single_node` 默认数据库仍是 `backend/storage/app.db`，见 `/Users/lijiabo/Documents/New project/backend/app/settings.py`。
- `backend/app/db/init_db.py` 仍会对当前 active engine 执行 `Base.metadata.create_all(...)`，这意味着绝大多数结构化表仍跟随默认数据库启动。
- `selection result` 已单独切到 PostgreSQL payload，但其余结构化表仍与 SQLite / `app.db` 共存，这会让系统长期处于“双数据库心智负担 + 双启动路径”状态。
- runtime 路线已经把 `worker / db / api / web` 拆机顺序、外置 PG / Redis capability、rollout contract 冻结完成。继续保留大量主业务表在 SQLite，会让这条路线的长期收益被削弱。

## 3. 当前剩余 SQLite 结构化真相面

### 3.1 仍由默认数据库承载的主表
- 产品与后台工作台：
  - `ProductIndex`
  - `IngredientLibraryIndex`
  - `IngredientLibraryAlias`
  - `IngredientLibraryRedirect`
  - `IngredientLibraryBuildJob`
  - `UploadIngestJob`
  - `ProductWorkbenchJob`
  - `AIJob`
  - `AIRun`
  - `ProductRouteMappingIndex`
  - `ProductAnalysisIndex`
  - `ProductFeaturedSlot`
- 移动端 session / history / utility：
  - `MobileSelectionSession`
  - `MobileCompareSessionIndex`
  - `MobileCompareUsageStat`
  - `MobileBagItem`
  - `MobileClientEvent`
  - `UserUploadAsset`
  - `UserProduct`

### 3.2 当前配置与启动面的 SQLite 依赖
- `database_url` 默认仍是 `sqlite:///{storage_dir}/app.db`
- `db_downgrade_to_sqlite_on_error=true` 仍允许 PostgreSQL 失败时回退到 SQLite
- 多数测试 fixture 仍以临时 SQLite 文件作为默认 engine
- `backend` 与 `worker` 共享同一组 SQLAlchemy model / session contract，意味着 SQLite 仍在真实启动路径里出现

### 3.3 当前不在本轮切换范围内的对象
- 图片、artifact、`doubao_runs` 等文件类对象仍属于 storage/object-store 分层，不属于“结构化真相全迁 PG”的直接目标
- `selection result` 的 PG payload 单真相已经完成，不在本轮重开

## 4. 非谈判原则
- PostgreSQL 是生产态、`split_runtime`、`multi_node` 的唯一结构化真相数据库。
- SQLite 不能长期保留为在线共同真相；最多只能作为 dev / emergency fallback。
- 任何表一旦切到 PostgreSQL，就不能继续保留“线上读 SQLite、线上写 PostgreSQL”的长期双真相。
- cutover 按 bounded context 分组推进，不能随机逐表迁移。
- 不把对象存储、图片回源、前端 IA、analytics 语义混入本路线。

## 5. 收益排序与迁移顺序

| 阶段 | 推荐 workflow phase | 目标 | 预期收益 |
| --- | --- | --- | --- |
| `postgresql-phase-0` | `phase-21` | 盘清剩余 SQLite 真相面，冻结迁移边界、迁移分组、acceptance | 消除“到底还剩什么在 SQLite”的不确定性，避免后续 phase 空转 |
| `postgresql-phase-1` | `phase-22` | 冻结 engine/session/init/default contract，使 PostgreSQL 成为生产默认真相 | 收口启动路径、消除 `app.db` 作为生产默认的架构歧义 |
| `postgresql-phase-2` | `phase-23` | 先迁产品管理、工作台、后台 job/AI 表 | 并发收益最高；worker/api 共用状态更稳 |
| `postgresql-phase-3` | `phase-24` | 再迁移动端 session/history/bag/events 与用户资产索引 | 用户连续性、清理任务、分页查询统一到 PostgreSQL |
| `postgresql-phase-4` | `phase-25` | 降级 SQLite 为 dev-only / emergency fallback，收口 docs/ops/tests | 彻底消除双主真相心智负担 |

### 5.1 最高收益优先级
- 先迁 `job / workbench / AI / product index`
  - 这部分最容易被 `api + worker` 并发写拖出问题
- 再迁 `mobile session / history / bag / analytics`
  - 这部分直接影响用户恢复、历史、清理、统计连续性
- 最后处理 `SQLite downgrade demotion`
  - 它是 closure 动作，不是最先要做的第一刀

## 6. phase-21 范围
- 只做 inventory、真相冻结、acceptance 冻结、迁移分组冻结。
- 允许的输出：
  - 剩余 SQLite 表面清单
  - PostgreSQL 目标边界
  - 第一批 cutover 候选表组
  - startup / downgrade / empty-state acceptance
  - phase-22 dispatch 前提
- 本轮不做：
  - 大规模代码 cutover
  - 随机改 compose 默认值直接切 PostgreSQL
  - 与产品功能需求并轮推进

## 7. Worker 分工

### 7.1 Worker B
- truth owner
- 负责盘清剩余 SQLite 真相面，冻结 PostgreSQL 目标边界、迁移分组、engine/session/init contract

### 7.2 Worker A
- verification / acceptance owner
- 负责把 bootstrap、downgrade、parity、empty-state、consistency 验证面冻结清楚

### 7.3 Worker C
- adoption / deploy owner
- 负责在 Worker B freeze 后，盘清 env / compose / runtime / frontend 管理台与工作台的 adoption 面，不抢真相定义权

## 8. phase-21 退出标准
- 剩余 SQLite 结构化真相面被明确列出并分组
- PostgreSQL 全迁移的 phase 序列被明确冻结
- phase-22 的第一刀 cutover 目标已经确定
- acceptance 已覆盖：
  - schema/bootstrap
  - startup/readiness
  - downgrade/fail-fast
  - parity/consistency
  - empty-state clean start
- `NOW / DOC_INDEX / TIMELINE` 与 phase-21 dispatch 同步完成

## 8.1 phase-21 gate result
- Worker A：`green`
  - phase-22 前 acceptance 已冻结到 tests，覆盖 bootstrap / parity / empty-state / consistency
- Worker B：`green`
  - 剩余 SQLite 结构化真相面、迁移分组、engine/session/init/default contract 已冻结
- Worker C：`green`
  - deployment/profile/config 与 frontend adoption inventory 已盘清
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `34 passed`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests` -> `177 passed`
- owner 结论：
  - `postgresql-phase-0 / phase-21` 达到 `green`
  - 可以开启 `postgresql-phase-1 / phase-22`

## 9. phase-21 freeze（worker-b truth freeze）

### 9.1 PG target boundary（唯一结构化真相边界）
- `postgresql` 是目标在线结构化真相 driver。
- `selection result` 持续保持 PostgreSQL payload 单真相：
  - 表：`mobile_selection_result_index`
  - 在线 payload 列：`published_payload_json`
  - artifact 语义：copy-only，不回退为在线读取来源。
- 其余结构化主表在 phase-21 基线仍跟随默认数据库启动路径（当前 single-node 默认仍为 SQLite），必须进入后续 PostgreSQL cutover 序列。

### 9.2 迁移分组冻结
- `postgresql-phase-2 / phase-23`（先迁高并发表组）：
  - `products`
  - `ingredient_library_index`
  - `ingredient_library_alias_index`
  - `ingredient_library_redirects`
  - `ingredient_library_build_jobs`
  - `upload_ingest_jobs`
  - `product_workbench_jobs`
  - `ai_jobs`
  - `ai_runs`
  - `product_route_mapping_index`
  - `product_analysis_index`
  - `product_featured_slots`
- `postgresql-phase-3 / phase-24`（再迁移动端状态组）：
  - `mobile_selection_sessions`
  - `mobile_compare_session_index`
  - `mobile_compare_usage_stats`
  - `mobile_bag_items`
  - `mobile_client_events`
  - `user_upload_assets`
  - `user_products`
- 总计剩余结构化主表：`19`（不含已是 PG payload 真相的 `mobile_selection_result_index`）。

### 9.3 engine / session / init / default contract 冻结
- engine contract（phase-22 前置）：
  - 当前仍允许 `sqlite` active（用于 single-node / dev / fallback），但生产目标 driver 固定为 `postgresql`。
  - `split_runtime`、`multi_node` 的默认数据库 contract 必须收口为 PostgreSQL。
  - PostgreSQL 连接池 contract（`pool_size/max_overflow/pool_timeout/pool_recycle/pool_pre_ping`）保持为唯一生产池配置入口。
- session contract：
  - `SessionLocal` 继续保持“单 active engine 绑定”的唯一 sessionmaker 入口。
  - 不引入并行双 session 真相，不允许 page-local 分叉会话语义。
- init contract：
  - `Base.metadata.create_all(bind=engine)` 继续绑定 active engine，不做双引擎并行建表。
  - schema patcher 仅维持：
    - `mobile_selection_sessions`
    - `mobile_selection_result_index`
    - `mobile_compare_session_index`
- default contract（phase-22 第一刀）：
  - 当前 `database_url` 默认仍为 `sqlite:///{storage_dir}/app.db`（phase-21 仅冻结，不在本轮直接切换）。
  - phase-22 必须冻结 `DATABASE_URL` 生产默认为 PostgreSQL，并把 SQLite downgrade 语义降级为 dev/emergency-only。

### 9.4 runtime observability freeze
- runtime profile 必须可直接暴露：
  - `postgresql_migration_contract.target_boundary`
  - `postgresql_migration_contract.engine_session_default_contract`
  - `postgresql_migration_contract.init_bootstrap_contract`
- 任何后续 cutover 轮次不得绕开这三块 contract 直接改行为。

### 9.5 phase-21 adoption inventory（worker-c freeze）

本节只盘清 phase-22 如果把 PostgreSQL 提升为生产默认值时，需要同步变化的 deployment/profile/config 与 frontend adoption 面，不在 phase-21 直接执行 cutover。

#### 9.5.1 deployment / profile / config 同步项

1. compose 默认值与 profile skeleton
   - `docker-compose.prod.yml` 的 backend/worker 仍保留：
     - `DATABASE_URL=${DATABASE_URL:-sqlite:////app/storage/app.db}`
     - `DB_DOWNGRADE_TO_SQLITE_ON_ERROR=${...:-true}`
   - phase-22 若冻结“生产默认 PostgreSQL”，需要把生产 profile 的默认 contract 从隐式 SQLite fallback 收口为 PostgreSQL 基线，并把 SQLite 回退改为显式 emergency 开关，而不是默认开启。
2. single-node profile 生产基线
   - `.env.single-node.example` 当前仍是：
     - `DATABASE_URL=sqlite:////app/storage/app.db`
     - `DB_DOWNGRADE_TO_SQLITE_ON_ERROR=true`
   - phase-22 若 single-node 也视为生产可运行 profile，需同步切到 PostgreSQL 默认，并明确 SQLite 仅 dev/emergency 可用。
3. split-runtime / multi-node profile
   - `.env.split-runtime.example`、`.env.multi-node.example` 已使用 PostgreSQL `DATABASE_URL`，但仍保留 `DB_DOWNGRADE_SQLITE_URL` 字段。
   - phase-22 需要冻结“生产部署必须显式给出 PostgreSQL 连接串 + 池配置”的 contract，避免遗漏环境变量后回落到 SQLite 心智。
4. runtime 启动与可观测
   - phase-22 需确保 readiness/health 输出能直接判断：
     - active driver 是否为 PostgreSQL
     - downgrade 是否启用
   - 目标是让“是否仍在用 SQLite”成为可观测事实，而非部署猜测。

#### 9.5.2 frontend 管理台 / 工作台 / browser-side adoption inventory

1. 管理台与工作台 API 调用链
   - `frontend/lib/api.ts` 的工作台、管理台、pipeline、dedup、ingredient、upload、maintenance、analytics 请求全部走 `/api/*` 或同一套 `apiFetch/postSSE`。
   - 前端页面层未发现直接依赖 `sqlite`/`app.db` 的实现语义；数据库驱动切换主要是后端与部署层问题。
2. browser-side 隐含部署假设（需在 phase-22 同步约束）
   - 浏览器端优先使用 `NEXT_PUBLIC_API_BASE`；为空时走同源 `/api` rewrite。
   - server-side fallback 仍是：
     - `INTERNAL_API_BASE || API_INTERNAL_ORIGIN || "http://nginx"`
   - phase-22 若调整默认 profile 或 LB 拓扑，必须同步 frontend build/runtime env，避免落到兜底 host。
3. next rewrite 依赖
   - `frontend/next.config.ts` 的 `/api`、`/images`、`/user-images` rewrite 仍由 `INTERNAL_API_BASE` 驱动。
   - phase-22 需要把 API/LB/internal host 显式注入各 profile，避免 browser-side 请求链路因默认值产生单机假设。

#### 9.5.3 phase-21 边界确认

- 本轮结论是 adoption inventory freeze，不是 default cutover。
- 本轮不改 backend truth contract，不改 selection-result/job semantics，不提前执行 phase-22。

### 9.6 phase-22 stage-1 adoption preflight（worker-c）

本节对应 `postgresql-phase-1 / phase-22` 的第一阶段并行 preflight，仅做 adoption 盘点与影响面确认，不在本节执行 production default cutover。

#### 9.6.1 preflight 盘点覆盖面

- env/profile skeleton：
  - `.env.single-node.example`
  - `.env.split-runtime.example`
  - `.env.multi-node.example`
- compose/runtime wiring：
  - `docker-compose.prod.yml`
  - `docker-compose.dev.yml`
- frontend runtime request chain：
  - `frontend/next.config.ts`
  - `frontend/Dockerfile.prod`
  - `frontend/lib/api.ts`
  - 管理台与工作台调用入口（`/product/pipeline`、`/product/dedup`、`/product/ingredients` 等）对应的 API caller

#### 9.6.2 phase-22 若提升 PostgreSQL 生产默认值，需要同步变化的 deployment/profile/config

1. compose 生产默认 contract
   - `docker-compose.prod.yml` 中 backend/worker 仍是 `DATABASE_URL` 默认 SQLite 和 `DB_DOWNGRADE_TO_SQLITE_ON_ERROR=true`。
   - phase-22 truth 若要求“生产默认 PostgreSQL”，则必须把这两项收口到 PostgreSQL production-default 语义，SQLite fallback 改为显式 emergency-only。
2. single-node profile contract
   - `.env.single-node.example` 仍是 `DATABASE_URL=sqlite:////app/storage/app.db` + `DB_DOWNGRADE_TO_SQLITE_ON_ERROR=true`。
   - 需要在 phase-22 明确：
     - single-node 是否继续作为生产 profile
     - 若是生产 profile，是否也提升 PostgreSQL 为默认 driver。
3. split/multi profile contract
   - `.env.split-runtime.example`、`.env.multi-node.example` 已是 PostgreSQL `DATABASE_URL`，且 downgrade 开关为 false。
   - phase-22 需要确保 compose 默认与 profile contract 一致，避免“profile 文件是 PG、compose 默认仍可回落 SQLite”造成部署歧义。
4. runtime observability 对齐
   - phase-22 需要确保 readiness/health 可直接观测 active driver 与 downgrade 状态，避免线上环境继续依赖推测判断是否仍在 SQLite。

#### 9.6.3 frontend 管理台 / 工作台 / browser-side 请求链路 preflight

1. 管理台与工作台 caller 形态
   - 管理台/工作台相关 API 调用统一走 `frontend/lib/api.ts` 的 `apiFetch/postSSE` 封装，经 `/api/*` 访问后端。
   - 页面层未发现直接引用 `sqlite`/`app.db` 的硬编码；数据库迁移影响主要在 deployment/runtime contract。
2. browser-side API chain 关键依赖
   - 浏览器优先使用 `NEXT_PUBLIC_API_BASE`。
   - 若为空，走同源 `/api` rewrite。
   - server-side fallback 仍是 `INTERNAL_API_BASE || API_INTERNAL_ORIGIN || "http://nginx"`。
3. hidden default risk（需在 phase-22 stage-2 收束）
   - 若 phase-22 调整默认 profile contract，但未同步 `NEXT_PUBLIC_API_BASE/INTERNAL_API_BASE/API_INTERNAL_ORIGIN`，管理台与工作台会落回同源 rewrite 或 server-side fallback host。
   - 这不是 SQLite 直依赖，但属于“旧默认值导致请求链路偏离目标拓扑”的隐含风险。

#### 9.6.4 stage-1 结论（worker-c）

- adoption preflight 覆盖完整：`env + compose + runtime + frontend request chain`。
- 当前未执行 phase-22 cutover；仅冻结影响面和收束前提。
- stage-2 进入条件：Worker B `green` 并明确 phase-22 truth（尤其 single-node 与 downgrade 生产语义）。

## 10. phase-22 目标
- 把 PostgreSQL 变成生产默认结构化真相 driver，而不是仅停留在 frozen contract。
- 第一刀 scope 固定为：
  - `DATABASE_URL` 生产默认 contract
  - `DB_DOWNGRADE_TO_SQLITE_ON_ERROR` 的 production demotion
  - `SessionLocal` / active engine / init bootstrap contract 收口
  - profile / compose / runtime observability / frontend adoption 同步
- 本轮仍不迁 `phase-23 / phase-24` 的具体表组 payload。

## 11. phase-22 stage-1 truth freeze（worker-b）

### 11.1 production-default PostgreSQL contract
- production profile 固定为：
  - `split_runtime`
  - `multi_node`
- 上述 profile 的 `DATABASE_URL` 默认 driver 固定为 `postgresql`。
- `single_node` 在 phase-22 的定位明确为：
  - `dev_or_emergency_fallback`
  - 不作为生产默认 PostgreSQL profile
  - 可继续显式使用 SQLite（`sqlite:///{storage_dir}/app.db`）做本地或应急回退。

### 11.2 downgrade production demotion
- `DB_DOWNGRADE_TO_SQLITE_ON_ERROR` 的 production 默认语义：
  - production profile（`split_runtime` / `multi_node`）默认 `false`
  - 只有显式环境变量覆盖时才允许打开
- `single_node` 保持 fallback 语义，可显式为 `true`。

### 11.3 session / active engine / init bootstrap contract
- `SessionLocal` 继续绑定单 active engine，不引入双 session 真相。
- active engine 的默认解析顺序固定：
  1. 显式 `DATABASE_URL`
  2. production profile -> PostgreSQL default URL
  3. single-node profile -> SQLite fallback URL
- `init_db` 继续执行：
  - `Base.metadata.create_all(bind=engine)`（绑定 active engine）
  - 既有 schema patcher 范围不扩张，不提前进入 phase-23/24 payload 迁移。

### 11.4 compose / profile / observability 对齐
- `docker-compose.prod.yml` backend/worker 默认值收口为：
  - `DEPLOY_PROFILE=split_runtime`
  - `DATABASE_URL` 默认 PostgreSQL DSN
  - `DB_DOWNGRADE_TO_SQLITE_ON_ERROR=false`
- `docker-compose.dev.yml` backend/worker 默认值也对齐 PostgreSQL-first contract；若使用 single-node skeleton 则由显式 env 覆盖回 SQLite fallback。
- runtime profile 必须暴露：
  - `postgresql_migration_contract.phase=postgresql-phase-1`
  - `engine_session_default_contract`
  - `init_bootstrap_contract`
  - 并明确 `phase-23` 仍锁定为“下一阶段表组迁移”。

### 11.5 给 Worker A / Worker C 的第二阶段收束边界
- Worker A：
  - 只收束 acceptance 到 phase-22 truth（startup/readiness、downgrade、clean-start、parity）
  - 不新增 phase-23/24 表组迁移验证目标
- Worker C：
  - 只收束 env/compose/runtime/frontend adoption 到本节 production-default contract
  - 不把 single-node fallback 当成 production 主语义
  - 不提前改 phase-23/24 payload migration 相关结论

### 11.6 phase-22 first owner gate
- gate 时间：
  - `2026-03-25 16:41 Asia/Shanghai`
- Worker A stage-1：
  - `green`
  - phase-22 acceptance baseline 已成立
  - scoped diff = `0`
- Worker B stage-1：
  - `green`
  - truth freeze 已落地到：
    - `backend/app/settings.py`
    - `backend/app/db/session.py`
    - `backend/app/db/init_db.py`
    - `backend/app/platform/runtime_profile.py`
    - `docker-compose.dev.yml`
    - `docker-compose.prod.yml`
    - `.env.single-node.example`
    - `.env.split-runtime.example`
    - `.env.multi-node.example`
- Worker C stage-1：
  - `green`
  - adoption preflight 已覆盖 env / compose / runtime / frontend request chain
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `34 passed, 2 warnings`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `177 passed, 2 warnings`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-22 truth freeze 成立
  - `single_node` 在 phase-22 明确保持 `dev_or_emergency_fallback`
  - Worker A / Worker C 可进入第二阶段收束
  - phase-22 仍处于 `in_execution`；未达到 integration gate `green`

### 11.7 phase-22 integration gate
- gate 时间：
  - `2026-03-25 16:53 Asia/Shanghai`
- Worker A stage-2：
  - `green`
  - acceptance 已收束到 phase-22 truth
  - scoped diff = `0`
- Worker B stage-2：
  - `yellow`
  - 无 contract 冲突
  - 本地 `conda run -n cosmeles python3 -m pytest` 命中解释器映射问题；owner 已用 `conda run -n cosmeles python -m pytest` 完成同组验证
- Worker C stage-2：
  - `green`
  - compose/runtime/frontend adoption 已收束到 phase-22 truth
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `34 passed, 2 warnings`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `177 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 结论：
  - phase-22 integration gate = `green`
  - PostgreSQL 现在是 production-default structured-truth driver
  - `split_runtime / multi_node` 是 production-default PostgreSQL profile
  - `single_node` 保持 `dev_or_emergency_fallback`
  - `phase-23 / postgresql-phase-2` 可以开启

## 12. phase-23 目标
- 把高并发后台 / 产品工作台 / job / AI / index 表组迁到 PostgreSQL 单在线真相。
- 收口该表组的 repository / service / route 读写路径。
- acceptance 只覆盖：
  - PG-only truth
  - bootstrap / backfill / replay idempotence
  - worker/api parity and concurrency consistency
  - empty-state / clean-start for this table group
- adoption 只覆盖：
  - 管理台 / 工作台 / 产品后台 / upload 相关 call-site 与 smoke/replay 面
- 本轮不做：
  - `phase-24` 的 mobile state 表组
  - `phase-25` 的 SQLite closure
  - 对象存储 / 产品 IA / analytics 语义变更

## 12.1 phase-23 worker split
- Worker B：
  - truth owner
  - 负责 phase-23 表组的 PG-only truth 边界、repository/service cutover、read/write path 收口
- Worker A：
  - verification / acceptance owner
  - 负责 phase-23 acceptance baseline 与 follow-up 收束
- Worker C：
  - adoption / replay owner
  - 负责管理台 / 工作台 / 产品后台 / upload 相关 adoption preflight 与第二阶段收束

## 12.2 phase-23 exit criteria
- phase-23 表组不再长期依赖 SQLite 作为在线读写真相
- 该表组的 PG-only truth 在 tests / runtime contract / adoption smoke 上可验证
- 不把 mobile state 表组提前混入
- owner 完成：
  - integration gate
  - `record / review / currentness`
  - phase-24 dispatch 开立（若达绿）

## 12.3 phase-23 first owner gate
- gate 时间：
  - `2026-03-25 17:18 Asia/Shanghai`
- Worker A stage-1：
  - `green`
  - acceptance baseline 已成立
  - 新增 `test_postgresql_phase23_acceptance_baseline.py`
- Worker B stage-1：
  - `green`
  - phase-23 PG-only truth 已落地到：
    - `backend/app/db/session.py`
    - `backend/app/main.py`
    - `backend/app/platform/runtime_profile.py`
    - `backend/app/db/models.py`
    - `backend/app/db/init_db.py`
- Worker C stage-1：
  - `green`
  - adoption / replay preflight 已覆盖管理台 / 工作台 / 产品后台 / upload 相关 caller 与 smoke 面
  - scoped diff = `0`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests/test_postgresql_phase23_acceptance_baseline.py backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py` -> `37 passed, 2 warnings`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `180 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-23 truth freeze 成立
  - Worker A / Worker C 可进入第二阶段收束
  - phase-23 仍处于 `in_execution`；未达到 integration gate `green`

## 12.4 给 Worker A / Worker C 的第二阶段收束边界
- Worker A：
  - 只收束 acceptance 到 phase-23 truth（PG-only truth、bootstrap/backfill、worker/api parity、clean-start）
  - 不新增 phase-24 mobile state 表组验证目标
- Worker C：
  - 只收束管理台 / 工作台 / 产品后台 / upload 相关 adoption/replay/smoke 到 phase-23 truth
  - 不提前改 phase-24 payload migration 相关结论

## 12.5 phase-23 integration gate
- gate 时间：
  - `2026-03-25 17:24 Asia/Shanghai`
- Worker A stage-2：
  - `green`
  - acceptance 已贴合 phase-23 truth
  - scoped diff = `0`
- Worker B stage-2：
  - `green`
  - 无 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：
  - `green`
  - adoption/replay/smoke 已贴合 phase-23 truth
  - scoped diff = `0`
- owner 结论：
  - phase-23 integration gate = `green`
  - 高并发表组 PG-only truth 已闭合
  - `phase-24 / postgresql-phase-3` 可以开启

## 13. phase-24 目标
- 把移动端状态表组迁到 PostgreSQL 单在线真相：
  - `mobile_selection_sessions`
  - `mobile_compare_session_index`
  - `mobile_compare_usage_stats`
  - `mobile_bag_items`
  - `mobile_client_events`
  - `user_upload_assets`
  - `user_products`
- 收口移动端状态相关 repository / service / route 读写路径。
- acceptance 只覆盖：
  - state continuity
  - resume/history/bag parity
  - cleanup/empty-state
  - worker/api consistency for this table group
- adoption 只覆盖：
  - `/m/me`
  - history
  - bag
  - compare/upload user-state 相关 call-site 与 replay/smoke
- 本轮不做：
  - `phase-25` 的 SQLite closure
  - product/workbench/job/AI/index 表组重开
  - 产品 IA / analytics 语义变更

## 13.1 phase-24 worker split
- Worker B：
  - truth owner
  - 负责 phase-24 移动端状态表组的 PG-only truth 边界、repository/service cutover、state continuity truth
- Worker A：
  - verification / acceptance owner
  - 负责 phase-24 acceptance baseline 与 follow-up 收束
- Worker C：
  - adoption / replay owner
  - 负责移动端 state call-site adoption / replay preflight 与第二阶段收束

## 13.2 phase-24 exit criteria
- phase-24 表组不再长期依赖 SQLite 作为在线读写真相
- 该表组的 PG-only truth 在 tests / runtime contract / mobile adoption smoke 上可验证
- 不把 phase-25 SQLite closure 提前混入
- owner 完成：
  - integration gate
  - `record / review / currentness`
  - phase-25 dispatch 开立（若达绿）

## 13.3 phase-24 stage-1 truth freeze（worker-b）
- phase-24 移动端状态表组（7 表）在线真相固定为 PostgreSQL：
  - `mobile_selection_sessions`
  - `mobile_compare_session_index`
  - `mobile_compare_usage_stats`
  - `mobile_bag_items`
  - `mobile_client_events`
  - `user_upload_assets`
  - `user_products`
- route / service / repository 在线读写路径收口原则：
  - 在线结构化读写统一经过 SQLAlchemy active engine（`SessionLocal/get_db`）；
  - production profile（`split_runtime` / `multi_node`）不允许以 SQLite 作为 phase-24 表组在线真相；
  - 历史 artifact fallback 仅允许 `single_node`（`dev_or_emergency_fallback`）场景，production profile 禁止作为在线真相读取来源。
- runtime observability contract：
  - `postgresql_migration_contract.phase=postgresql-phase-3`
  - 暴露 `phase_24_mobile_state_pg_only_truth_contract`，可直接判断：
    - 移动端状态表组 PG-only 是否要求生效
    - 当前 active driver 是否合规
    - legacy fallback 是否允许
    - 是否触发 downgrade 导致违约
- startup/readiness contract：
  - phase-24 生产 profile 若 active driver 非 PostgreSQL，启动与 `readyz` 必须 fail-fast。

## 13.4 给 Worker A / Worker C 的第二阶段收束边界
- Worker A：
  - 只收束 phase-24 acceptance（state continuity、resume/history/bag parity、cleanup/empty-state、worker/api consistency）
  - 不新增 phase-25 SQLite closure 验证目标
- Worker C：
  - 只收束 `/m/me`、history、bag、compare/upload user-state call-site 的 adoption/replay/smoke 到 phase-24 truth
  - 不提前给 phase-25 closure 结论

## 13.5 phase-24 first owner gate
- gate 时间：
  - `2026-03-25`
- Worker A stage-1：
  - `green`
  - acceptance baseline 成立
  - mandatory 全量回归通过：`180 passed, 2 warnings`
  - scoped diff = `0`
- Worker B stage-1：
  - `green`
  - phase-24 移动端状态表组 PG-only truth 已落地到：
    - `backend/app/db/session.py`
    - `backend/app/main.py`
    - `backend/app/routes/mobile.py`
    - `backend/app/platform/runtime_profile.py`
    - `backend/app/db/models.py`
    - `backend/app/db/init_db.py`
- Worker C stage-1：
  - `green`
  - adoption / replay preflight 已覆盖 `/m/me`、history、bag、compare/upload user-state 相关 call-site
  - scoped diff = `0`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `180 passed, 2 warnings`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-24 truth freeze 成立
  - Worker A / Worker C 可进入第二阶段收束
  - phase-24 仍处于 `in_execution`；未达到 integration gate `green`

## 13.6 phase-24 integration gate
- gate 时间：
  - `2026-03-25`
- Worker A stage-2：
  - `green`
  - acceptance 已收束到 phase-24 truth
  - 新增 `test_postgresql_phase24_acceptance_baseline.py`
- Worker B stage-2：
  - `green`
  - 无 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：
  - `green`
  - mobile adoption / replay / smoke 已收束到 phase-24 truth
  - scoped diff = `0`
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `188 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
- owner 结论：
  - phase-24 integration gate = `green`
  - 所有剩余结构化真相表组都已完成 PostgreSQL online-truth 迁移
  - `phase-25 / postgresql-phase-4` 可以开启

## 14. phase-25 目标
- 收口 SQLite 为 `dev-only / emergency fallback` 的最终 closure 语义。
- 补齐 docs / ops / tests / runtime observability，使“生产在线结构化真相全部在 PostgreSQL”成为可验证事实。
- 明确 single-node fallback 仍存在，但只能作为显式 fallback 角色，不能再伪装成 production 主语义。
- 本轮不重开 phase-22 到 phase-24 的表组迁移。

## 14.1 phase-25 worker split
- Worker B：
  - truth owner
  - 负责 phase-25 SQLite closure truth、runtime/default/downgrade contract、剩余 backend fallback 语义收口
- Worker A：
  - verification / acceptance owner
  - 负责 phase-25 acceptance baseline 与 follow-up 收束
- Worker C：
  - adoption / deploy owner
  - 负责 env / compose / ops / runtime smoke 与剩余 adoption 口径收束

## 14.2 phase-25 exit criteria
- PostgreSQL 全迁移被明确判定为 repo 内 closure complete。
- production profile 不再保留任何隐式 SQLite 在线结构化真相路径。
- single-node / emergency fallback 语义、docs、ops、tests、runtime observability 保持一致。
- owner 完成：
  - integration gate
  - `record / review / currentness`
  - PostgreSQL full migration 路线 closeout

## 14.3 phase-25 closure freeze
- 所有结构化真相迁移分组状态：
  - `phase-23` 高并发表组：`completed`
  - `phase-24` 移动端状态表组：`completed`
- production profile（`split_runtime` / `multi_node`）不允许存在隐式 SQLite 在线真相、隐式 fallback、或旧 artifact/file truth 主路径。
- `single_node` 只保留：
  - 本地开发
  - 显式 emergency fallback
- runtime observability 与 docs/tests 必须可直接回答：
  - 当前是否仍有剩余 SQLite 在线结构化真相
  - 当前 profile 是否允许 SQLite fallback
  - 当前 fallback 是否为 explicit emergency 而非 production default

## 14.4 phase-25 stage-1 truth freeze（worker-b）
- runtime/startup/settings/observability 已收口为 phase-25 closure contract：
  - startup 与 `readyz` 统一执行 `phase-23`、`phase-24`、`phase-25` 三段 contract fail-fast；
  - `phase_25_sqlite_closure_contract` 暴露到 runtime profile 与 database engine contract；
  - production profile（`split_runtime` / `multi_node`）固定为 SQLite downgrade forced-off；
  - `single_node` 保持 `dev_or_emergency_fallback` 语义，不重定义为 production 主语义。
- phase-25 不重开 phase-22~24 表组迁移：
  - 不改 phase-23/24 表组边界；
  - 仅收口 closure 语义与可观测 contract。

## 14.5 给 Worker A / Worker C 的第二阶段收束边界
- Worker A：
  - 只收束 phase-25 acceptance（closure contract、profile parity、readiness/observability、一致性）；
  - 不重开 phase-22~24 表组迁移断言。
- Worker C：
  - 只收束 env/compose/ops/smoke 与 phase-25 closure 口径一致性；
  - 不恢复 production profile 的 SQLite/artifact 在线回退路径。

## 14.6 phase-25 first owner gate
- gate 时间：
  - `2026-03-25`
- Worker A stage-1：
  - `green`
  - acceptance baseline 成立
  - 新增 `test_postgresql_phase25_acceptance_baseline.py`
  - mandatory 全量回归通过：`194 passed, 2 warnings`
- Worker B stage-1：
  - `green`
  - phase-25 SQLite closure truth 已落地到：
    - `backend/app/settings.py`
    - `backend/app/db/session.py`
    - `backend/app/main.py`
    - `backend/app/platform/runtime_profile.py`
    - `backend/app/db/init_db.py`
    - `backend/app/db/models.py`
- Worker C stage-1：
  - `green`
  - ops/deploy preflight 已覆盖 `.env.*`、`docker-compose.prod.yml`、`docker-compose.dev.yml`、frontend runtime caller
  - scoped diff = `0`
  - `.env.*` 头注释仍有 phase-22 历史标注，但当前不构成 gate blocker，留到第二阶段收束
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `194 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 结论：
  - first owner gate = `green`
  - Worker B 的 phase-25 truth freeze 成立
  - Worker A / Worker C 可进入第二阶段收束
  - phase-25 仍处于 `in_execution`；未达到 integration gate `green`

## 14.7 phase-25 integration gate
- gate 时间：
  - `2026-03-25`
- Worker A stage-2：
  - `green`
  - acceptance 已收束到 phase-25 truth
  - scoped diff = `0`
- Worker B stage-2：
  - `green`
  - 无 A/C 升级
  - scoped diff = `0`
- Worker C stage-2：
  - `green`
  - `.env.*` 历史口径文案已收束到 phase-25
  - deploy / docs / ops / smoke 已收束到 phase-25 truth
- owner 验证：
  - `python3 -m py_compile backend/app/settings.py backend/app/db/session.py backend/app/db/init_db.py backend/app/db/models.py backend/app/platform/runtime_profile.py backend/app/main.py backend/app/routes/mobile.py` -> `green`
  - `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python -m pytest -q backend/tests` -> `194 passed, 2 warnings`
  - `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit` -> `green`
  - `cd /Users/lijiabo/Documents/New project/frontend && npm run build` -> `green`
  - `docker compose --env-file .env.single-node.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.split-runtime.example -f docker-compose.prod.yml config` -> `green`
  - `docker compose --env-file .env.multi-node.example -f docker-compose.prod.yml config` -> `green`
- owner 结论：
  - phase-25 integration gate = `green`
  - PostgreSQL full migration route = `completed`
  - 不再存在 active PostgreSQL migration phase
