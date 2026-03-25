# Backend（FastAPI）

## 当前后端定位

- 同一套后端镜像同时支持 `api` 和 `worker` 两种运行角色
- 当前 runtime profile 支持：
  - `single_node`
  - `split_runtime`
  - `multi_node`
- 健康检查和就绪检查已经暴露 runtime contract：
  - `GET /healthz`
  - `GET /readyz`

如果 README 和 governed initiative doc 冲突，以 initiative doc 为准：

- [mobile-architecture-v2.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md)
- [mobile-runtime-infrastructure-upgrade-plan-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md)
- [mobile-runtime-roadmap-closure-summary-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/records/mobile-runtime-roadmap-closure-summary-v1.md)

## 当前后端能力

- 产品上传与入库
- 豆包双阶段识别与 AI job 流式接口
- mobile 决策、compare、history、result 相关 API
- 后台任务执行：
  - upload ingest
  - mobile compare
  - product workbench / result build
- selection result PostgreSQL payload 单真相
- runtime health / readiness / rollout observability

完整 HTTP 细节以 `/docs` 和代码为准。

## 当前技术栈

- FastAPI
- SQLAlchemy
- SQLite / PostgreSQL runtime switch
- 本地文件存储 / object-storage contract
- Redis contract（lock / cache only）
- worker poller + DB-backed job truth

## 当前 runtime profile 语义

### `single_node`

- 适合当前低成本单机
- 默认仍允许：
  - SQLite
  - local storage
  - local queue
  - local lock
  - no cache

### `split_runtime`

- 适合同机 rehearsal，或者已经准备共享依赖时的拆分过渡态
- 语义目标：
  - PostgreSQL payload truth
  - object storage contract
  - Redis lock/cache contract
  - worker 轮询执行后台任务

### `multi_node`

- 适合真正多机
- 要求：
  - `DATABASE_URL` 必须指向所有节点都能访问的 PostgreSQL
  - `REDIS_URL` 必须指向共享 Redis
  - `API_INTERNAL_ORIGIN` / `BACKEND_HOST` 必须改成真实内网地址或私有 DNS

## 启动方式

### 本地开发

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Compose 运行（推荐）

当前推荐不要单独 `docker run backend`，而是用根目录 compose + env profile：

```bash
cp /Users/lijiabo/Documents/New\ project/.env.single-node.example /Users/lijiabo/Documents/New\ project/.env.runtime
cp /Users/lijiabo/Documents/New\ project/backend/.env.local.example /Users/lijiabo/Documents/New\ project/backend/.env.local

cd /Users/lijiabo/Documents/New\ project
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

### 仅调试镜像

```bash
docker build -t cosmeles-backend ./backend
docker run --rm -p 8000:8000 -v $(pwd)/backend/storage:/app/storage cosmeles-backend
```

这只适合镜像级调试，不是当前推荐生产方式。

## 关键目录

```text
app/main.py                           FastAPI 入口、healthz/readyz、worker daemon 启动
app/routes/                           API 路由
app/platform/                         runtime storage / queue / lock / cache / repository adapters
app/services/runtime_topology.py      profile + role 下的调度语义
app/services/runtime_worker.py        worker poller
app/services/runtime_rollout.py       phase-20 rollout contract
app/db/                               模型、session、初始化
storage/                              本地图片、SQLite、临时产物、开发期文件
user_storage/                         用户文件本地挂载目录
tests/                                backend 回归与 runtime contract 测试
```

## 健康检查与运行时可观测性

### `GET /healthz`

- 永远返回进程存活状态
- 额外带上 runtime profile 摘要：
  - `deploy_profile`
  - `runtime_role`
  - `backends.database/storage/selection_results/queue/lock/cache`
  - `rollout_contract`
  - `topology.worker_state`

### `GET /readyz`

- 检查：
  - 数据库可连接
  - storage 可初始化
- 注意：
  - `readyz` 不直接验证 Redis 连通性
  - 真要切到多机，仍必须做真实 compare / upload / worker smoke

## 当前最重要的配置文件

### 1. `backend/.env.local`

只放密钥和后端私有配置：

- `ARK_API_KEY` / `DOUBAO_API_KEY`
- `DOUBAO_*`
- 可选地理逆解析配置

### 2. 根目录 runtime env

这些决定后端真正跑在哪个 runtime profile：

- [/.env.single-node.example](/Users/lijiabo/Documents/New%20project/.env.single-node.example)
- [/.env.split-runtime.example](/Users/lijiabo/Documents/New%20project/.env.split-runtime.example)
- [/.env.multi-node.example](/Users/lijiabo/Documents/New%20project/.env.multi-node.example)

重点变量：

- `DEPLOY_PROFILE`
- `RUNTIME_ROLE`
- `DATABASE_URL`
- `REDIS_URL`
- `STORAGE_BACKEND`
- `SELECTION_RESULT_REPOSITORY_BACKEND`
- `LOCK_BACKEND`
- `CACHE_BACKEND`
- `API_PUBLIC_ORIGIN`
- `API_INTERNAL_ORIGIN`
- `ASSET_PUBLIC_ORIGIN`
- `ROLLOUT_*`

## 常用命令

```bash
# 健康状态
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/readyz

# 全量回归
cd /Users/lijiabo/Documents/New\ project
PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests

# 只看 runtime contract 相关测试
cd /Users/lijiabo/Documents/New\ project
PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_runtime_platform_adapters.py backend/tests/test_runtime_health_contract.py
```

## 进一步部署说明

完整部署、扩容、回滚顺序请直接看：

- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)
