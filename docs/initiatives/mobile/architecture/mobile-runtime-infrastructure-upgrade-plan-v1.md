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
updated_at: 2026-03-24
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

## 11. 分阶段实施计划

### Phase A：先把代码边界拆出来
- 新增 repository / storage / queue / lock 抽象层
- 让业务层不再直接调用本地文件读写
- 给资产 URL、对象存储路径、cookie domain、数据库连接统一配置入口

### Phase B：单机 `2c4g` 可上线版本
- 本机启 PostgreSQL
- 上对象存储和 CDN
- 把产品图、用户图、selection result artifact 迁出本地盘
- Web / API / worker 拆成独立服务，但仍可同机运行
- 恢复页面压缩，不再全站 `compress: false`

### Phase C：运行时正确性收口
- `selection result` 切成 PostgreSQL 单真相
- compare / upload 改 queue + worker
- 历史记录、session、closure、job 状态都收进数据库
- 发布前引入 result completeness gate

### Phase D：多机扩展
- 外置 PostgreSQL
- 新增 Redis 锁与热点缓存
- worker 独立迁移到单独机器
- Web / API 分离扩容

### Phase E：大陆用户体验优化增强
- 若不做 ICP：
  - 继续使用全球 CDN + 海外对象存储
  - 收益主要体现在静态资源与图片
- 若做 ICP：
  - 评估中国可用 CDN / China network / 中国对象存储
  - 让 `assets` 更靠近大陆用户

## 12. 供应商与合规说明
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

## 13. Go / No-Go
- 仍在线依赖本地盘交付 selection result，no-go
- 仍让 `/images`、`/user-images` 走 Next rewrite，no-go
- 仍让 compare / upload 在线程内跑在 API 进程里，no-go
- 仍以 SQLite 作为线上唯一真相库并承载并发写入，no-go
- 仍用“全站禁压缩”来迁就 SSE，no-go

## 14. 最终拍板
- 当前最合理的升级路线不是“一步到位多机”，而是：
  1. 单机 `2c4g` 先按模块拆清
  2. 文件型持久化先全部托管走
  3. `selection result` 先切 PostgreSQL 单真相
  4. compare / upload 先变成 worker 模式
  5. 后续按 `DB -> worker -> API -> web` 的顺序逐步拆机
- 这样可以做到：
  - 当前机器还能继续承接线上
  - 未来迁移到多服务器时主要改部署和配置，而不是重写业务代码
