---
doc_id: mobile-runtime-infrastructure-upgrade-plan-v1
title: Mobile Runtime Infrastructure Upgrade Plan v1
doc_type: architecture
initiative: mobile
workstream: architecture
owner: architecture-owner
status: active
priority: p0
created_at: 2026-03-20
updated_at: 2026-03-25
related_docs:
  - mobile-architecture-v2
  - mobile-refactor-playbook
---

# Mobile Runtime Infrastructure Upgrade Plan v1

## 1. 文档定位
- 本文是移动端运行时基础设施升级方案，不是单次 phase 派工卡。
- 目标不是一次性把所有机器和云服务都上满，而是先把当前日本单机 `2c4g` 的运行方式拆成清晰模块，再保证后续能逐步迁移到多服务器部署。
- 本文覆盖：
  - `frontend` Web 入口
  - `backend` API / SSE / mobile domain
  - selection result / compare / upload / analytics 相关运行时依赖
  - 数据库、对象存储、CDN、worker、缓存与锁
- 本文不替代产品文档；它只负责运行时架构、存储分层、交付路径和迁移顺序。

## 1.1 当前执行状态
- 当前 active runtime phase：
  - `none`
- 当前 workflow 执行映射：
  - `none`
- 当前目标：
  - runtime 7-phase 路线已完成仓库内与本地 deploy gate 收口
  - 保持 `worker -> db -> api -> web` 的固定拆机顺序作为 frozen rollout contract
  - 后续目标环境灰度/回滚演练不再作为新的 runtime phase 处理
- 当前 integration 状态：
  - `runtime-phase-0 / phase-14` 已完成真实 `docker compose` smoke，并通过 deploy gate
  - `runtime-phase-1 / phase-15` 已完成真实单机四模块 smoke，并通过 owner integration gate
  - `runtime-phase-2 / phase-16` 已完成 object-storage contract、asset-domain wiring、profile-ready env/compose 补强，并通过 owner integration gate
  - `runtime-phase-3 / phase-17` 已完成 selection-result PostgreSQL 单真相切换，并通过 owner follow-up integration gate
  - `runtime-phase-4 / phase-18` 已完成 compare / upload / result-build 的 job + worker execution truth 收口，并通过 owner follow-up integration gate
  - backend 全量 `pytest backend/tests` 为绿色
  - frontend `tsc` 与 `build` 为绿色
  - `single_node / split_runtime / multi_node` 三套 `docker compose config` 已可展开
  - `phase-15` record / review 已落盘
  - `phase-16` record / review 已落盘
  - `phase-17` record / review 已落盘
  - `phase-18` record / review 已落盘
  - `phase-19` record / review 已落盘
  - `phase-20` record / review 已落盘
  - `phase-20` dispatch 已落盘，多机拆分执行轮已正式启动
  - `phase-20` first owner gate 已完成首轮复核：
    - Worker B rollout truth = `green`
    - Worker A acceptance = `green`
    - Worker C follow-up smoke = `green`
  - owner 抽检：
    - `backend/tests/test_runtime_platform_adapters.py` + `backend/tests/test_runtime_health_contract.py` = `30 passed`
    - `pytest backend/tests` = `173 passed`
    - frontend `tsc` = green
    - split-runtime compose 已显式展开 `postgres_payload + redis_contract + postgresql DATABASE_URL`
    - frontend `BACKEND_HOST` 已按 profile 展开为：
      - `single_node -> backend`
      - `split_runtime -> api`
      - `multi_node -> api-internal`
    - split-runtime 真实 `docker compose up` 已通过：
      - backend / worker / postgres `healthy`
      - `healthz` = `200`
      - `readyz` = `200`
      - frontend entry = `200`
- 当前未越过的 gate：
  - 仓库内无未越过 gate；目标环境灰度/回滚演练属于后续 ops 执行，不再阻塞当前路线图闭环
- 当前 owner 判断：
  - `runtime-phase-0 / phase-14` 已达到 deploy gate `green`
  - `runtime-phase-1 / phase-15` 已达到 integration gate `green`
  - `runtime-phase-2 / phase-16` 已达到 integration gate `green`
  - `runtime-phase-3 / phase-17` 已达到 integration gate `green`
  - `runtime-phase-4 / phase-18` 已达到 integration gate `green`
  - `runtime-phase-5 / phase-19` 已达到 follow-up integration gate `green`
  - external PG / Redis capability boundary、pool、downgrade、profile config-switch 已冻结完成
  - `runtime-phase-6 / phase-20` 已达到 deploy gate `green`
  - runtime 7-phase 路线在 source-repo 维度已闭环完成
  - 后续若要继续做运行时演进，必须新开 phase，不复用 `phase-20`

## 2. 当前仓库暴露出的核心问题
- 页面、API、图片、本地静态文件、结果 JSON、SQLite 全部压在同一台机器上。
- 当前生产默认数据库仍是本地 SQLite，见 [`../../../../backend/app/settings.py`](../../../../backend/app/settings.py) 与 [`../../../../docker-compose.prod.yml`](../../../../docker-compose.prod.yml)。
- `selection result` 在线读取仍是 `DB index -> local file` 双真相，见 [`../../../../backend/app/services/mobile_selection_results.py`](../../../../backend/app/services/mobile_selection_results.py)。
- `/images` 与 `/user-images` 仍从本地目录挂载并通过 Next rewrite 转发，见 [`../../../../backend/app/main.py`](../../../../backend/app/main.py) 与 [`../../../../frontend/next.config.ts`](../../../../frontend/next.config.ts)。
- 全站压缩当前被统一关闭，原因是历史上为了 SSE 减少 buffering，但结果是 HTML / JS / CSS / JSON 一起失去压缩收益，见 [`../../../../frontend/next.config.ts`](../../../../frontend/next.config.ts)。
- compare、upload、AI 类长任务仍由 Web API 进程直接起线程执行，见 [`../../../../backend/app/routes/mobile.py`](../../../../backend/app/routes/mobile.py) 与 [`../../../../backend/app/routes/ingest.py`](../../../../backend/app/routes/ingest.py)。
- 这导致当前线上同时存在 4 类问题：
  - 首屏静态资源跨境加载慢
  - 用户图片和公开图片都依赖日本单机本地盘
  - 结果真相不稳定，第一次失败、稍后又好
  - 长任务与 Web 进程耦合，不利于扩 worker 和拆机

## 3. 非谈判原则
- 每类核心数据只能有一个在线真相源。
- 公开静态资源、图片、版本化 artifact 不能继续依赖本地盘在线交付。
- 结构化真相数据不能塞进对象存储，必须落数据库。
- SSE / streaming 接口必须允许无缓存、无 buffering、无压缩干扰，但这不能成为全站禁压缩的理由。
- 同一套业务代码必须支持：
  - 单机部署
  - Web / API / worker / DB 逐步拆机
- 所有“以后再拆”的能力，都要先通过 adapter / repository / queue contract 预留，而不是未来重写业务层。

## 4. 目标拓扑

### 4.1 Phase 1：单机 `2c4g` 可运行
- 外部托管：
  - CDN
  - 对象存储
- 本机部署：
  - `web`：Next.js
  - `api`：FastAPI
  - `worker`：长任务 worker，初期低并发
  - `postgres`：本机 PostgreSQL
- 本机只保留临时 scratch 目录，不再承担长期持久化文件真相。

```text
User
  -> CDN / Edge
    -> www.yuexuan.xyz -> web (Next.js)
    -> api.yuexuan.xyz -> api (FastAPI)
    -> assets.yuexuan.xyz -> Object Storage

Single Japan 2c4g host
  - web
  - api
  - worker (low concurrency)
  - postgres
```

### 4.2 Phase 2：可随时拆分的多机拓扑
```text
User
  -> CDN / Edge
    -> www.yuexuan.xyz -> web cluster
    -> api.yuexuan.xyz -> api cluster
    -> assets.yuexuan.xyz -> Object Storage

Managed / external services
  - PostgreSQL
  - Redis
  - Object Storage

Worker pool
  - compare worker
  - upload / ingest worker
  - result publish / rebuild worker
```

## 5. 域名与流量分层
- `www.yuexuan.xyz`
  - 页面 HTML、RSC、静态构建产物
- `api.yuexuan.xyz`
  - REST API
  - SSE / stream endpoints
- `assets.yuexuan.xyz`
  - 产品图
  - 用户上传图
  - compare / result 相关公开或签名访问 artifact

### 5.1 为什么一定要拆域名职责
- 现在 [`../../../../frontend/next.config.ts`](../../../../frontend/next.config.ts) 里 `/api`、`/images`、`/user-images` 都由 Next 反代，这让 Next 同时承担页面渲染、API 代理、图片代理和 SSE 中转，边界太乱。
- 后续只要把资产域与 API 域拆开：
  - CDN 策略可以按流量类型单独配置
  - SSE 可以单独禁缓存 / 禁 buffering
  - 页面压缩可以恢复，不再为了 stream 牺牲整站

### 5.2 Cookie 预留
- 当前 mobile owner cookie 仍是 host-only，见 [`../../../../backend/app/routes/mobile_support.py`](../../../../backend/app/routes/mobile_support.py)。
- 若拆成 `www` 与 `api` 子域，需预留 `cookie_domain=.yuexuan.xyz` 配置项，避免后续 API 子域拿不到连续 owner state。

## 6. 数据分层与真相归属

| 数据类型 | 当前状态 | Phase 1 真相 | Phase 2 真相 | 备注 |
| --- | --- | --- | --- | --- |
| selection result 在线读取 | SQLite index + 本地 JSON | PostgreSQL | PostgreSQL | 不再在线读本地文件 |
| selection result 发布副本 | 本地 JSON | 对象存储 | 对象存储 | 归档与审计副本 |
| compare session / result index | DB + 本地依赖混合 | PostgreSQL | PostgreSQL | 完整 session / closure 真相 |
| 产品图 | 本地 `storage/images` | 对象存储 + CDN | 对象存储 + CDN | 公开长缓存 |
| 用户上传图 | 本地 `user_storage/images` | 对象存储 | 对象存储 | 私有桶 + 签名 URL |
| 产品 JSON / route mapping / profile / ingredient artifact | 本地 JSON | 对象存储 + DB index | 对象存储 + DB index | 不继续占本地盘 |
| AI / doubao 中间产物 | 本地 JSON | 对象存储 | 对象存储 | 设 TTL / 生命周期 |
| job 状态 / 进度 | 进程内线程 + DB | PostgreSQL | PostgreSQL + Redis lock | 不允许只存在内存里 |
| 临时上传 scratch | 本地目录 | 本地短期保留 | 本地短期保留 | 可清理，可丢失 |

## 7. 代码层模块拆分方案

### 7.1 目标不是“文件搬家”，而是责任拆分
- `domain`
  - 只保留选择逻辑、compare 逻辑、closure 逻辑、analytics 语义
- `application`
  - 编排 use case：selection resolve、compare run、history persist、artifact publish
- `platform`
  - PostgreSQL repository
  - object storage adapter
  - queue / worker adapter
  - cache / lock adapter
- `routes`
  - 只做 HTTP 输入输出与鉴权，不再直接起线程或读本地文件

### 7.2 建议目标目录
```text
backend/app/
  domain/
    mobile/
  application/
    mobile/
  platform/
    db/
    storage/
    queue/
    cache/
  workers/
    compare_worker.py
    upload_worker.py
    selection_result_worker.py
  routes/
    mobile.py
    mobile_selection.py
    ingest.py
```

### 7.3 当前最需要先抽掉的直接依赖
- 把 `load_json / save_json_at / read_rel_bytes` 这类本地文件直接调用，从业务逻辑里抽到 storage adapter，见 [`../../../../backend/app/services/storage.py`](../../../../backend/app/services/storage.py)。
- 把 `selection result` 的读取，从“数据库索引 + 本地文件”改成 repository 直接返回 payload，见 [`../../../../backend/app/services/mobile_selection_results.py`](../../../../backend/app/services/mobile_selection_results.py)。
- 把 compare / upload 的 `threading.Thread(...)` 改成 queue 提交接口，见 [`../../../../backend/app/routes/mobile.py`](../../../../backend/app/routes/mobile.py) 与 [`../../../../backend/app/routes/ingest.py`](../../../../backend/app/routes/ingest.py)。
- 把图片对外访问从本地静态目录挂载，改成资产域 URL 生成器，不再依赖 [`../../../../backend/app/main.py`](../../../../backend/app/main.py) 的 `/images`、`/user-images` 静态挂载。

## 8. 单机 `2c4g` 阶段的部署守则

### 8.1 可以放在同机上的模块
- `web`
- `api`
- `worker`
- `postgres`

### 8.2 不建议第一阶段同机加入的模块
- Redis
- 大量后台批处理并发 worker
- 继续依赖本地长期持久化 artifact

### 8.3 单机运行约束
- `api` 只处理在线请求，不再承载长时间线程任务。
- `worker` 必须独立成单独进程或容器，即使还在同一台机器上。
- `worker` 初期只允许低并发。
- `postgres` 使用保守连接池与保守内存配置。
- 构建与大批量预生成任务避开线上高峰。

## 9. CDN 与对象存储策略

### 9.1 CDN 必做项
- 给 `www` 提供压缩、TLS、边缘缓存静态资源。
- 给 `assets` 提供图片与公开 artifact 的边缘缓存。
- 不把 `api` 的 SSE 路径当作普通缓存流量处理。

### 9.2 缓存规则
- `www` HTML / RSC
  - 短 TTL 或 ISR
- `assets` 公开产品图片
  - 长 TTL、immutable 文件名优先
- `assets` 用户上传图片
  - 私有桶或签名 URL，短 TTL，不公开长缓存
- `api`
  - 普通 GET 接口按读模型决定是否加短 TTL
  - SSE / stream 一律 `no-cache, no-transform`

### 9.3 为什么不能继续把图片走 Next rewrite
- 现在 [`../../../../frontend/next.config.ts`](../../../../frontend/next.config.ts) 让 `/images` 与 `/user-images` 经由前端服务中转。
- 这会让 CDN 命中变差，Next CPU 被图片与页面混跑，也会让 SSE 与图片共用同一反代路径。
- 正确做法是：前端只拿资产 URL，不替图片做代理。

## 10. 结果页与 compare 相关运行时升级

### 10.1 Selection result
- 在线真相必须改成 PostgreSQL 单表读取。
- 本地 JSON 改为对象存储归档副本。
- rules version 切换前必须全量预生成并做 completeness gate。
- 用户在线请求不得命中“结果不存在但稍后会好”的构建态。

### 10.2 Compare / upload / AI 类长任务
- 当前实现是 Web 路由直接起线程，见 [`../../../../backend/app/routes/mobile.py`](../../../../backend/app/routes/mobile.py) 与 [`../../../../backend/app/routes/ingest.py`](../../../../backend/app/routes/ingest.py)。
- 目标实现：
  - API 只负责创建 job
  - worker 消费 job
  - PostgreSQL 持久化 job 状态与结果
  - SSE 只负责推送状态，不再直接托管真实执行线程

### 10.3 上传链路
- 当前图片先上传到日本后端，再由后端写本地盘。
- 目标是浏览器直传对象存储，后端只拿 object key 和 metadata。
- 这样大陆用户上传不再走“浏览器 -> 日本后端 -> 本地盘 -> 后续处理”双重长链路。

## 11. 最新 7 个 Phase 执行路线图

### 11.1 Phase 命名规则
- 本文使用稳定的路线图命名：`runtime-phase-0` 到 `runtime-phase-6`。
- 它们是基础设施重构 phase，不和产品侧 `phase-10`、`phase-13` 混用。
- 当基础设施改造真的进入 workflow 派工时，若它成为下一条主执行线，建议按仓库现有约定顺序映射为：
  - `runtime-phase-0` -> `phase-14`
  - `runtime-phase-1` -> `phase-15`
  - `runtime-phase-2` -> `phase-16`
  - `runtime-phase-3` -> `phase-17`
  - `runtime-phase-4` -> `phase-18`
  - `runtime-phase-5` -> `phase-19`
  - `runtime-phase-6` -> `phase-20`
- 如果未来中间插入新的产品执行轮，workflow 的数字 phase 可顺延，但 `runtime-phase-0~6` 的语义编号保持不变。

### 11.2 runtime-phase-0：边界与开关先拆出来
- 目标：
  - 先把 `storage / repository / queue / lock / asset url` 抽象层搭好。
  - 让业务层不再直接依赖本地文件、本地 SQLite 语义、线程启动和硬编码资产路径。
- 代码落盘：
  - `backend/app/platform/`
  - `backend/app/application/`
  - `backend/app/domain/mobile/`
  - `frontend/lib/` 中与 asset origin、API origin、runtime profile 相关的适配层
  - `docker-compose.*` 与 `.env.*.example`
- 交付结果：
  - 代码仍然单机跑，但已经具备“只改配置就能换后端实现”的前提。
  - 不要求本 phase 就上 PostgreSQL、对象存储或 worker 拆机。
- 验证门槛：
  - 同一套业务路径仍可在当前单机开发环境跑通。
  - 新 adapter 有最小 contract tests。
  - 本地文件直读、线程直起、硬编码资产域引用明显收缩。

### 11.3 runtime-phase-1：单机 `2c4g` 模块化运行
- 目标：
  - 在同一台日本 `2c4g` 上拆成 `web / api / worker / postgres` 四个模块。
  - 把“一个 backend 进程兼容所有职责”的形态拆开。
- 代码落盘：
  - `docker-compose.dev.yml`
  - `docker-compose.prod.yml`
  - `backend` 进程入口拆分
  - `frontend` 与 `backend` 的 profile-aware env 接入
- 交付结果：
  - 单机 profile 成为正式可运行拓扑，而不是临时拼装。
  - worker 即使仍与 API 同机，也必须是独立容器或进程。
- 验证门槛：
  - `web`、`api`、`worker`、`postgres` 各自有独立 health/readiness。
  - SSE、页面渲染、后台任务不再共享同一执行进程。

### 11.4 runtime-phase-2：对象存储与 CDN 上线
- 目标：
  - 把产品图、用户上传图、公开 artifact 从本地盘迁到对象存储。
  - 让 `www / api / assets` 三类流量职责正式分层。
- 代码落盘：
  - `backend/app/platform/storage/`
  - `backend/app/services/storage.py` 相关调用迁移
  - `frontend/next.config.ts`
  - 资产 URL 生成与签名 URL 逻辑
- 交付结果：
  - 页面和 API 不再代理图片。
  - CDN 开始承接静态资源、产品图、公开 artifact。
- 验证门槛：
  - 本地盘不再是图片与公开 artifact 的在线真相。
  - 页面普通压缩恢复；SSE 只走特殊 no-buffer / no-transform 规则。

### 11.5 runtime-phase-3：Selection Result 切 PostgreSQL 单真相
- 目标：
  - 彻底解决“第一次 404，稍后又好了”的结果不稳定问题。
  - 把 selection result 在线读取从 `DB index -> local file` 改为 `PostgreSQL payload` 直读。
- 代码落盘：
  - `backend/app/domain/mobile/`
  - `backend/app/application/mobile/`
  - `backend/app/platform/db/`
  - `backend/app/services/mobile_selection_results.py`
  - 相关 migration、schema、tests
- 交付结果：
  - selection result 的在线真相只有 PostgreSQL。
  - JSON artifact 降级为归档副本，可进对象存储。
- 验证门槛：
  - rules version 上线前有 completeness gate。
  - 用户请求不再命中“结果文件在，但索引没到”这种双真相窗口。

### 11.6 runtime-phase-4：长任务改成 Job + Worker
- 目标：
  - compare、upload、AI、result build 不再由 API 进程直接起线程。
  - API 只创建 job，worker 执行，SSE 只读状态。
- 代码落盘：
  - `backend/app/workers/`
  - `backend/app/platform/queue/`
  - `backend/app/routes/mobile.py`
  - `backend/app/routes/ingest.py`
  - job 状态 schema、worker runner、SSE 读模型
- 交付结果：
  - 在线请求和后台重任务彻底分层。
  - worker 变成后续第一优先可拆模块。
- 验证门槛：
  - compare / upload / result build 都能通过 job status 恢复与追踪。
  - API 无需持有真实执行线程。

### 11.7 runtime-phase-5：数据库和缓存能力升级
- 目标：
  - PostgreSQL 为未来拆机准备外置能力。
  - Redis 加入，但只做缓存与分布式锁，不抢数据库真相。
- 代码落盘：
  - `backend/app/platform/cache/`
  - `backend/app/platform/lock/`
  - 连接串、池配置、缓存与锁开关
- 交付结果：
  - 多 worker、多 API 节点具备一致性与锁语义基础。
  - 单机 profile 仍可在 `CACHE_BACKEND=none` 或 `LOCK_BACKEND=local` 下运行。
- 验证门槛：
  - 外置 PostgreSQL 时只改 `DATABASE_URL`。
  - Redis 开关可开可关，业务层不感知。

### 11.8 runtime-phase-6：逐步拆成多服务器完全体
- 目标：
  - 从“单机 fully modular”平移到“多机 fully modular”。
  - 迁移顺序固定：`worker -> db -> api -> web`。
- 代码落盘：
  - 主要不是业务代码重写，而是部署、环境变量、健康检查和灰度切流配置。
  - 必要时补充 job lag、worker fail rate、DB replica、LB readiness 支持。
- 交付结果：
  - `web`、`api`、`worker` 都能按角色独立扩容。
  - 单机 profile 仍可保留，作为低成本部署模式。
- 验证门槛：
  - 每次只迁一个真相层。
  - 新节点先暗启动，再切一小部分流量。
  - 每一步都可通过配置回滚。

## 12. 如何落盘到仓库

### 12.1 initiative 真相如何落盘
- 本文继续作为 runtime upgrade 的唯一 live architecture 方案文档。
- 每个 runtime phase 真正开工时，不再另起第二份“总方案”；只在本文更新：
  - 当前 active phase
  - 当前 blocked items
  - 当前 go / no-go
- 如果某个 phase 改变了当前系统真相，还需要同步更新：
  - [`./mobile-architecture-v2.md`](./mobile-architecture-v2.md)
  - 必要时更新对应 product / rollout / record / review 文档

### 12.2 workflow 执行对象如何落盘
- 当某个 runtime phase 进入执行，workflow 层使用连续数字 phase 派工。
- 当前建议映射：
  - `runtime-phase-0` -> `docs/workflow/teams/engineering/mobile-architecture/assignments/phase-14/`
  - `runtime-phase-1` -> `.../phase-15/`
  - `runtime-phase-2` -> `.../phase-16/`
  - `runtime-phase-3` -> `.../phase-17/`
  - `runtime-phase-4` -> `.../phase-18/`
  - `runtime-phase-5` -> `.../phase-19/`
  - `runtime-phase-6` -> `.../phase-20/`
- 每个执行 phase 至少包含：
  - `worker-a.prompt.md`
  - `worker-b.prompt.md`
  - `worker-c.prompt.md`
  - `deploy-dispatch.md`

### 12.3 每个 phase 的 initiative 记录如何落盘
- 每个 runtime phase 完成后，至少新增两类 initiative 文档：
  - `records/mobile-runtime-phase-x-record-v1.md`
  - `reviews/mobile-runtime-phase-x-acceptance-review-v1.md`
- 若 phase 只是局部试点、未形成稳定系统真相，可以只落 record，不落新的 live rollout。
- 若 phase 修改了部署守则、运行时职责或真相层，则必须回写本文与 `mobile-architecture-v2`。

### 12.4 建议的提交切片
- 每个 runtime phase 默认拆成 3 类提交面：
  1. `docs / contract / env skeleton`
  2. `runtime code / adapter / migration`
  3. `acceptance / record / review`
- 禁止把“基础设施重构 + 产品页面大改 + docs 重写”混成一个提交。

## 13. Owner / Worker 执行模型

### 13.1 Owner 的固定职责
- Owner 不直接吞掉全部 implementation；Owner 的职责是：
  - 冻结当前 runtime phase 的唯一真相与禁区
  - 指定谁是 `truth owner`，谁是 `adopter / verifier`
  - 先把 workflow assignment 与 initiative 目标状态写清楚，再派工
  - 收 A / B / C 首轮结果，做 `go / no-go`
  - 做 integration review，决定是否可收成提交、是否可推主线、是否可进入下一 phase
  - 维护 initiative 侧的 `NOW / DOC_INDEX / TIMELINE / record / review / archive`
- Owner 不能跳过这些动作：
  - 不先冻结真相就派工
  - 不写依赖顺序就让多人并行
  - 不做统一验收就让 worker 自己宣布完工

### 13.2 Worker A / B / C 的默认姿态
- Worker A
  - 默认偏 `contract / observability / verification / acceptance`
  - 负责 env、health、metrics、tests、dashboard、migration verification、compat bridge
- Worker B
  - 默认偏 `truth owner`
  - 负责 backend domain、repository、storage、queue、DB schema、lock/cache contract、runtime semantics
- Worker C
  - 默认偏 `service integration / call-site adopter`
  - 负责 compose、service wiring、frontend/runtime caller、asset path adoption、worker runner、deploy glue、smoke path
- 这三个角色仍然是可重组人力池，不是永久模块负责人；但在 runtime 改造里，推荐优先沿用这套分工，以减少切换成本。

### 13.3 默认协作规则
- 先做：Owner 冻结 + Worker B 真相层
- 并行：Worker A 可与 Worker B 并行做 contract / verification / env skeleton
- 等待：Worker C 默认等 Worker B 的真相冻结后再大面积接 call-site 或 service wiring
- 回报格式继续沿用：
  - `green`：本 scope 完成且可并入下一 gate
  - `yellow`：有局部风险，但不阻塞继续集成
  - `red`：被 contract、branch、schema、环境或上游真相阻塞

## 14. 每个 Phase 的分工、验收与文档维护

| Runtime Phase | Owner | Worker A | Worker B | Worker C | 最小验收门槛 | 文档维护动作 |
| --- | --- | --- | --- | --- | --- | --- |
| `runtime-phase-0` | 冻结 adapter 边界、目录目标、env contract、禁止直读本地真相 | 补 contract tests、env example、health/readiness、验证旧路径仍可跑 | 抽 `repository/storage/queue/lock` 接口，收 backend truth seam | 接 frontend/runtime caller、compose wiring、最小 smoke adoption | 单机链路仍可跑；adapter seam 生效；无大面积行为回归 | 更新本文 active phase；新增 `phase-14` assignment；完成后补 `record/review` |
| `runtime-phase-1` | 冻结单机 profile 拓扑与进程职责，禁止 backend 再兼 worker | 验证 `web/api/worker/postgres` health、env、compose、监控探针 | 拆 API/worker 入口，收服务边界与 DB 连接策略 | 落容器编排、service wiring、SSE 与普通页面分流 smoke | 单机 `web/api/worker/postgres` 独立运行；worker 不再寄生 API 进程 | 更新本文 active phase；如部署拓扑真相变化，回写 `mobile-architecture-v2` |
| `runtime-phase-2` | 冻结 `www/api/assets` 分层与 object storage 真相 | 做 CDN/header/cache/compression 验证、回归测试、backfill 核对 | 落 storage adapter/object key 规则/签名 URL contract | 落前端资产 URL、Next config、compose/env 接线、上传/图片 smoke | 图片与公开 artifact 不再走本地盘在线真相；普通页面恢复压缩 | 更新本文；必要时新增 record；若旧资产路径退场，记入 review |
| `runtime-phase-3` | 冻结 selection result 的单真相切换与 completeness gate | 做 schema/test/backfill 校验、故障演练、旧新读一致性验证 | 落 PG payload model、migration、读写 cutover、publish gate | 接 result caller、历史链路、compare bootstrap adoption smoke | 结果页首访不再命中 `PRECOMPUTED_MISSING`；在线只读 PG | 更新本文与 `mobile-architecture-v2`；补 `record/review`；必要时 archive 旧读取说明 |
| `runtime-phase-4` | 冻结 job model、worker role、SSE status read model | 做 job metrics、lag/fail rate、acceptance tests、恢复/重试验证 | 落 queue contract、job schema、worker execution truth | 接 compare/upload/result build caller、worker runner、状态页/SSE smoke | compare/upload/result build 不再直接在线程内跑 | 更新本文；新增 `record/review`；如果产品流转受影响，补相关 rollout/review |
| `runtime-phase-5` | 冻结外置 DB/Redis 的使用边界：DB 真相、Redis 仅锁/缓存 | 验证 lock/cache 行为、pool、故障降级、单机 profile 兼容 | 落 `cache/lock` adapter、外置 PG 支持、连接池与迁移策略 | 接 deployment profile、config switch、灰度 smoke | 单机 profile 仍可跑；外置 PG/Redis 只改配置即可切换 | 更新本文 active phase；补 `record/review`；更新 `DOC_INDEX/TIMELINE` |
| `runtime-phase-6` | 冻结拆机顺序、灰度策略、回滚策略、观测指标 | 验证新节点暗启动、流量分批、监控与告警 | 收多节点一致性、读写/锁/队列/DB 真相 | 接 LB、worker pool、API/Web 节点 wiring 与 smoke | 迁移顺序固定：`worker -> db -> api -> web`，每步可回滚 | 更新本文 active phase；完成后补完整 `record/review`，如旧部署模型退场则 archive |

### 14.1 每个 Phase 的统一验收规则
- 每个 runtime phase 都必须经过 3 层 gate：
  1. `worker gate`
     - A / B / C 分别回 `green|yellow|red`
  2. `owner integration gate`
     - Owner 统一看交叉依赖是否收口
  3. `deploy gate`
     - 单机 profile 或目标 profile 上的真实运行验证
- 若某 phase 涉及真相层切换，还要额外做：
  - 双写 / backfill / 一致性校验
  - 旧读路径下线前的观察窗口
  - 回滚开关验证

## 15. 进度维护与唯一真相更新规则

### 15.1 当前正在做什么，写到哪里
- `NOW.md`
  - 只维护当前 active / frozen / in_execution / blocked 的 initiative 真相文档
- 本文
  - 维护当前 active runtime phase、blocked item、go/no-go
- workflow assignment
  - 维护本轮 worker 具体任务，而不是 initiative 真相

### 15.2 一个 Phase 开工时必须更新什么
- 更新本文：
  - 当前 active runtime phase
  - 当前目标、禁区、gate
- 新建 workflow 派工目录：
  - `docs/workflow/teams/engineering/mobile-architecture/assignments/phase-xx/`
- 如是新的 initiative 执行轮，需要在 `TIMELINE.md` 追加 `updated` 事件
- 若 live truth 有变化，再更新 `NOW.md` 和 `DOC_INDEX.md`

### 15.3 一个 Phase 完成后必须更新什么
- 新增：
  - `records/mobile-runtime-phase-x-record-v1.md`
  - `reviews/mobile-runtime-phase-x-acceptance-review-v1.md`
- 更新：
  - `TIMELINE.md`
  - 必要时更新 `NOW.md`
  - 若系统真相已变化，更新 `mobile-architecture-v2.md`
- 若旧文档已经不再是 live truth：
  - 标记 `superseded` 或 `completed`
  - 必要时归档到 `archive/YYYY-MM-DD/`

### 15.4 唯一真相如何保持单一
- 产品行为真相：
  - `docs/initiatives/mobile/product/*`
- 系统/运行时真相：
  - `docs/initiatives/mobile/architecture/*`
- 过程派工真相：
  - `docs/workflow/teams/engineering/mobile-architecture/assignments/*`
- 历史完成态：
  - `docs/initiatives/mobile/records/*`
  - `docs/initiatives/mobile/reviews/*`
  - `docs/initiatives/mobile/archive/*`
- 任何时候都不允许：
  - 用 assignment 代替 architecture 真相
  - 用 chat 代替 phase record/review
  - 用 archive snapshot 代替 current live doc

## 16. 从单机到完全体的逐步部署打法

### 16.1 单机 fully modular 先跑稳
- 先完成：
  - `web`
  - `api`
  - `worker`
  - `postgres`
- 外部先接：
  - CDN
  - Object Storage
- 这是“代码完全体的单机 profile”，也是后续一切迁移的零点。

### 16.2 多机迁移顺序为什么固定
- 第一优先拆 `worker`
  - 因为它最容易吃资源，也最不该和在线请求混跑
- 第二优先拆 `db`
  - 因为 API 和 worker 扩容都建立在稳定的共享真相上
- 第三优先拆 `api`
  - 因为在线请求量起来后，API 才值得横向扩
- 最后拆 `web`
  - 因为 CDN 往往已经吃掉了大量静态与边缘压力

### 16.3 每一步迁移怎么保证站还稳
- 只迁一个真相层
- 新节点先暗启动
- 先双写 / backfill / 核对，再切读
- 流量分批切，不一次性全量
- 保留配置级回滚，不依赖手工代码回退
- 所有节点都保留：
  - `healthz / readyz`
  - job lag / fail rate
  - DB 可用性
  - SSE 路径专用 no-cache / no-buffering 策略

### 16.4 完全体终局
- `CDN / Edge`
- `www` web pool
- `api` API pool
- `worker` pool
  - compare worker
  - upload worker
  - selection result worker
- 托管 PostgreSQL
- Redis
- Object Storage
- completeness gate
- 监控 / 告警 / 回滚机制
- 但同一套代码仍要支持：
  - `DEPLOY_PROFILE=single_node`
  - `DEPLOY_PROFILE=split_runtime`
  - `DEPLOY_PROFILE=multi_node`

## 17. 供应商与合规说明
- 若当前优先级是“先快落地”：
  - 可先选全球 CDN + 海外对象存储
  - 这能先解决静态资源、图片、压缩与源站负载问题
- 若后续优先级是“大陆体验拉满”：
  - 需评估 ICP 与中国区节点方案
  - 中国内地节点通常伴随备案要求

参考官方资料：
- Cloudflare compression docs:
  - <https://developers.cloudflare.com/speed/optimization/content/compression/>
- Cloudflare China Network:
  - <https://developers.cloudflare.com/china-network/>
  - <https://developers.cloudflare.com/china-network/faq/>
- Alibaba Cloud OSS access and network overview:
  - <https://help.aliyun.com/zh/oss/user-guide/access-and-network-overview>
- Cloudflare R2 custom domain / object storage docs:
  - <https://developers.cloudflare.com/r2/>

## 18. Go / No-Go
- 仍在线依赖本地盘交付 selection result，no-go
- 仍让 `/images`、`/user-images` 走 Next rewrite，no-go
- 仍让 compare / upload 在线程内跑在 API 进程里，no-go
- 仍以 SQLite 作为线上唯一真相库并承载并发写入，no-go
- 仍用“全站禁压缩”来迁就 SSE，no-go

## 19. 最终拍板
- 当前最合理的升级路线不是“一步到位多机”，而是：
  1. 单机 `2c4g` 先按模块拆清
  2. 文件型持久化先全部托管走
  3. `selection result` 先切 PostgreSQL 单真相
  4. compare / upload 先变成 worker 模式
  5. 后续按 `worker -> DB -> API -> web` 的顺序逐步拆机
- 这样可以做到：
  - 当前机器还能继续承接线上
  - 未来迁移到多服务器时主要改部署和配置，而不是重写业务代码
