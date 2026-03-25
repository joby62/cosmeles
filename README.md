# 予选（MatchUp）

更快选到适合自己的护理方案。

## 当前仓库状态

- 产品定位没有变：
  - 个护决策工具，不是百科站、对比站，也不是展示型官网
  - 主链路：`/m -> /m/choose -> /m/[category]/profile -> /m/[category]/result`
- 运行时大阶段已经完成：
  - `runtime-phase-0` 到 `runtime-phase-6` 已在仓库、`main`、`origin/main` 全部收口
  - 固定 rollout 顺序已冻结为：`worker -> db -> api -> web`
- 当前推荐生产基线：
  - 单台低配机器先跑 `single_node`
  - 真正需要扩容时，第一步优先拆 `worker`

## 文档导航

- 产品 PRD：[docs/initiatives/mobile/product/mobile-decision-prd-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md)
- 结果页与回流 PRD：[docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md)
- 首访 funnel spec：[docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md)
- compare / closure spec：[docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md)
- compare result spec：[docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md)
- 当前架构基线：[docs/initiatives/mobile/architecture/mobile-architecture-v2.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md)
- 已完成的运行时路线图：[docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md)
- 运行时收官摘要：[docs/initiatives/mobile/records/mobile-runtime-roadmap-closure-summary-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/records/mobile-runtime-roadmap-closure-summary-v1.md)
- 完整部署与扩容手册：[docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)
- 日常运维速查：[docs/workflow/operations/operations-runbook.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/operations-runbook.md)
- 前端说明：[frontend/README.md](/Users/lijiabo/Documents/New%20project/frontend/README.md)
- 后端说明：[backend/README.md](/Users/lijiabo/Documents/New%20project/backend/README.md)
- 文档索引：[docs/README.md](/Users/lijiabo/Documents/New%20project/docs/README.md)
- workflow 索引：[docs/workflow/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/README.md)
- initiatives 索引：[docs/initiatives/README.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/README.md)
- 当前文档面板：
  - [docs/initiatives/NOW.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/NOW.md)
  - [docs/initiatives/DOC_INDEX.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/DOC_INDEX.md)
  - [docs/initiatives/TIMELINE.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/TIMELINE.md)

## 目录结构

```text
backend/                                          FastAPI runtime（api/worker image + runtime profiles）
frontend/                                         Next.js App Router（mobile 前台 + desktop 内部台）
deploy/nginx/                                     历史 nginx 配置，仅作旧资料
docs/workflow/operations/README.md                当前完整部署与扩容手册
docs/workflow/operations/operations-runbook.md    日常运维速查
docs/initiatives/mobile/product/                  mobile 产品 PRD / spec
docs/initiatives/mobile/architecture/             mobile 架构与运行时真相
docs/initiatives/mobile/reviews/                  mobile acceptance / review
docs/initiatives/mobile/records/                  mobile milestone / closure 记录
docs/initiatives/mobile/archive/                  mobile 历史快照
docs/workflow/teams/engineering/mobile-architecture/  owner + worker handoff / assignment
docs/workflow/startup-prompts/                    新对话启动 prompt
```

## 这次大阶段更新后必须重查的配置

如果你继续跑现在的项目，至少要重新看这几类配置：

1. `backend/.env.local`
   - 这里只放密钥和后端私有配置
   - 重点看：`ARK_API_KEY` / `DOUBAO_API_KEY`

2. 根目录 runtime profile env
   - 当前单机：`/.env.single-node.example`
   - 同机 rehearsal：`/.env.split-runtime.example`
   - 未来多机：`/.env.multi-node.example`
   - 重点看：`DEPLOY_PROFILE`、`DATABASE_URL`、`REDIS_URL`、`API_*_ORIGIN`、`ASSET_*`、`BACKEND_HOST/BACKEND_PORT`、`ROLLOUT_*`

3. `docker-compose.prod.yml`
   - 现在生产栈不是旧的双容器说明了，而是围绕 `postgres / backend / worker / frontend`
   - frontend 已经改成 profile-aware `BACKEND_HOST/BACKEND_PORT/INTERNAL_API_BASE`

4. 反向代理与域名
   - 当前单机可以继续只反代 frontend
   - 一旦进入 `split_runtime` / `multi_node`，就要明确 `www`、`api`、`assets` 的域名职责

5. PostgreSQL / Redis / 对象存储
   - 单机低成本基线可以继续保守
   - 真要多机，必须先把共享 PostgreSQL 和共享 Redis 的地址、权限、连通性定下来

## 本地开发

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

### Docker 开发模式

```bash
docker compose -f docker-compose.dev.yml up -d --build --remove-orphans
```

## 当前生产部署建议（你现在这台 2c4g 机器）

当前最稳妥的建议不是直接上多机，而是：

1. 继续用单机 profile 跑
2. 把 `web / api / worker / postgres` 都放在同一台机器
3. 先把配置和运维动作标准化
4. 真有资源瓶颈时，再按固定顺序拆机

完整步骤直接看：
- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)

最短启动命令是：

```bash
cp .env.single-node.example .env.runtime
cp backend/.env.local.example backend/.env.local

docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

启动后最少检查：

```bash
docker compose -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
curl -sS -I http://127.0.0.1:5001
```

## 未来多机扩容，哪一步效益最高

效益最高的第一步是：先拆 `worker`。

原因很简单：

- 当前最容易拖慢用户请求的不是 web，而是 compare / upload / result build 这类后台任务
- 把 `worker` 从 API 所在机器先拿出去，能最快减少前台请求和后台任务抢 CPU / IO
- 这一步对用户流量入口影响最小，回滚也最容易

但要注意一个前提：

- 你不能在 `SQLite + 本地锁` 模式下直接拆 worker
- 真要跨机器，至少要让 worker 和 api 看到同一份 PostgreSQL 真相
- Redis 也要变成共享服务，不能继续依赖每台机器自己的本地缓存/锁

所以未来扩容的固定顺序仍然是：

1. `worker`
2. `db`
3. `api`
4. `web`

详细 step-by-step 也在：
- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)

## Mobile IA（当前主线）

### P0：决策主链路

- `/m`
- `/m/choose`
- `/m/shampoo/profile`
- `/m/bodywash/profile`
- `/m/conditioner/profile`
- `/m/lotion/profile`
- `/m/cleanser/profile`
- `/m/shampoo/result`
- `/m/bodywash/result`
- `/m/conditioner/result`
- `/m/lotion/result`
- `/m/cleanser/result`

### P1：实用辅链

- `/m/wiki`
- `/m/compare`
- `/m/bag`
- `/m/me`

## 文档治理规则

- `docs/workflow/` 只放规则、handoff、startup、assignment、ops
- `docs/initiatives/` 只放 PRD、spec、architecture、rollout、review、record、archive
- 当前 initiative 真相以显式 `status` 为准，不靠文件时间猜优先级
- 查当前状态先看：
  - [docs/initiatives/NOW.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/NOW.md)
  - [docs/initiatives/DOC_INDEX.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/DOC_INDEX.md)
  - [docs/initiatives/TIMELINE.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/TIMELINE.md)
