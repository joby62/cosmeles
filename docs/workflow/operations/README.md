# 部署与扩容 README

这份 README 是当前仓库的完整部署手册。

它回答三件事：

1. phase-20 收口后，哪些配置必须重新看
2. 你当前这台 `2c4g` 单机应该怎么部署
3. 未来如果上多服务器，哪一步收益最高，应该怎么一步步拆

## 1. 当前结论

- runtime 路线已经完成到 `phase-20 / runtime-phase-6`
- 当前仓库支持三种 runtime profile：
  - `single_node`
  - `split_runtime`
  - `multi_node`
- 当前你的机器还是低配单机，推荐先跑：
  - `single_node`
- 未来扩容时，收益最高的第一步不是先拆 web，而是：
  - 先拆 `worker`
- 固定拆机顺序不能改：
  - `worker -> db -> api -> web`

## 2. 这次大阶段更新后，哪些配置必须重新检查

### 2.1 后端私有密钥

文件：

- `/Users/lijiabo/Documents/New project/backend/.env.local`

用途：

- 只放密钥和私有后端配置

必须检查：

- `ARK_API_KEY`
- `DOUBAO_API_KEY`
- `DOUBAO_*`

不要把 runtime profile、数据库地址、前端 origin 写进这里；那些属于根目录 runtime env。

### 2.2 根目录 runtime env

文件模板：

- `/Users/lijiabo/Documents/New project/.env.single-node.example`
- `/Users/lijiabo/Documents/New project/.env.split-runtime.example`
- `/Users/lijiabo/Documents/New project/.env.multi-node.example`

这些文件控制：

- 当前跑哪种 profile
- API / worker 跑什么角色
- 数据库、缓存、锁、对象存储、前端 origin 走哪套 contract

必须检查的键：

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
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_ASSET_BASE`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `ROLLOUT_STEP`
- `ROLLOUT_TARGET_STEP`
- `ROLLOUT_ROLLBACK_ENABLED`
- `ROLLOUT_CONSISTENCY_ENFORCED`

### 2.3 Compose

文件：

- `/Users/lijiabo/Documents/New project/docker-compose.prod.yml`
- `/Users/lijiabo/Documents/New project/docker-compose.dev.yml`

现在生产栈的理解应该是：

- `postgres`
- `backend`
- `worker`
- `frontend`

不是旧的“只有 backend + frontend 两个容器”的心智模型。

### 2.4 反向代理与域名

你现在如果还是单机同域，可以继续只把外部流量打到 frontend。

但一旦进入 `split_runtime` / `multi_node`，必须明确：

- `www`：前端页面
- `api`：API / SSE
- `assets`：对象存储 / CDN

### 2.5 PostgreSQL / Redis / 对象存储

单机低成本基线可以先保守。

但真要上多机，必须先有：

- 所有节点都能访问的 PostgreSQL
- 所有节点都能访问的 Redis
- 可供 `ASSET_PUBLIC_ORIGIN` 使用的对象存储 / CDN

注意：

- 当前 repo 没有内置生产 Redis 服务
- `.env.split-runtime.example` 和 `.env.multi-node.example` 里的 PG / Redis host 都是示例值，不能原样上线

## 3. 当前 2c4g 单机部署推荐

这是你现在最应该采用的方案。

### 3.1 适用条件

- 还是一台低配服务器
- 主要目标是稳定、低成本、可恢复
- 还没有必要上跨机队列、跨机缓存、灰度切流

### 3.2 前置条件

机器上需要有：

- Docker
- Docker Compose
- 仓库代码
- 可用的反向代理（如 Caddy）

### 3.3 准备代码

```bash
cd ~/cosmeles
git pull origin main
```

### 3.4 配置后端私钥

```bash
cd ~/cosmeles
cp backend/.env.local.example backend/.env.local
```

然后编辑：

- `backend/.env.local`

至少填好：

- `ARK_API_KEY` 或 `DOUBAO_API_KEY`

### 3.5 生成当前生产 env

```bash
cd ~/cosmeles
cp .env.single-node.example .env.runtime
```

然后编辑：

- `.env.runtime`

单机阶段重点看这些值：

- `DEPLOY_PROFILE=single_node`
- `DATABASE_URL=sqlite:////app/storage/app.db`
- `LOCK_BACKEND=local`
- `CACHE_BACKEND=none`
- `NEXT_PUBLIC_API_BASE=` 保持空，继续同域
- `NEXT_PUBLIC_ASSET_BASE=` 保持空，继续同域
- `BACKEND_HOST=backend`
- `BACKEND_PORT=8000`

### 3.5.1 首次 clone 后的本地数据目录

仓库现在会自带空的运行时目录骨架：

- `backend/storage/`
- `backend/user_storage/`

这些目录本身会出现在第一次 clone 中，但里面的运行时数据仍被 `.gitignore` 忽略，不会随 Git 下发。

在没有接入真正对象存储上传后端之前，这两棵目录仍然是 live local path。尤其下面这些内容还依赖本地文件：

- `backend/storage/images/`
- `backend/storage/doubao_runs/`
- `backend/storage/tmp_uploads/`
- `backend/user_storage/uploads/`
- `backend/user_storage/images/`
- `backend/user_storage/doubao_runs/`

注意：

- `selection result` 的结构化在线真相已经是 PostgreSQL payload，不再以本地 artifact 为在线主读源
- 但图片、豆包运行痕迹、用户上传文件仍可能在本地目录里

如果你像现在这样把旧项目重命名为 `legacy`，再重新 clone 新项目，首次启动前建议先把旧数据迁回来：

```bash
cd ~
cp -R cosmeles_legacy/backend/storage/* cosmeles/backend/storage/
cp -R cosmeles_legacy/backend/user_storage/* cosmeles/backend/user_storage/
```

如果你只想迁最关键的数据，至少先迁：

- `backend/storage/images/`
- `backend/storage/doubao_runs/`
- `backend/user_storage/`
- 以及你还需要的 `backend/storage/app.db`

如果你要开 admin console，再额外加入当前 compose 启动使用的 env 文件；如果你是 `--env-file .env.runtime`，就写进 `.env.runtime`：

```bash
ADMIN_CONSOLE_PASSWORD=change-this-password
ADMIN_CONSOLE_SESSION_SALT=change-this-session-salt
```

### 3.6 启动生产栈

```bash
cd ~/cosmeles
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

### 3.7 启动后验证

```bash
cd ~/cosmeles
docker compose -f docker-compose.prod.yml ps
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
curl -sS -I http://127.0.0.1:5001
```

你应该看到：

- backend 正常
- worker 正常
- frontend 正常
- `healthz` 返回 `200`
- `readyz` 返回 `200`

### 3.8 反向代理

如果你现在还是同域单机，最简单的 Caddy 规则就是把外部流量打到 frontend：

```caddy
yuexuan.xyz, www.yuexuan.xyz {
    reverse_proxy 127.0.0.1:5001
}
```

如果你的 Caddy 自己也跑在 Docker 容器里，不要写 `127.0.0.1`，要改成宿主机网关，例如：

```caddy
yuexuan.xyz, www.yuexuan.xyz {
    reverse_proxy 172.17.0.1:5001
}
```

如果后面你想显式暴露 API，再加：

```caddy
api.yuexuan.xyz {
    reverse_proxy 127.0.0.1:8000
}
```

同理，如果 Caddy 在 Docker 容器里，API upstream 也要改成宿主机网关：

```caddy
api.yuexuan.xyz {
    reverse_proxy 172.17.0.1:8000
}
```

### 3.9 日常更新

```bash
cd ~/cosmeles
git pull origin main
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

## 4. 什么时候该从单机升级

出现下面任一情况，就该考虑扩容：

- compare / upload / result build 一跑，前台请求明显变慢
- 单机 CPU 长时间被后台任务占满
- 你需要更稳定的 worker 隔离，而不是和 API 抢资源
- 你准备接入共享 PostgreSQL / Redis / 对象存储

## 5. 哪一步收益最高

收益最高的第一步是：先拆 `worker`。

### 原因

- 后台任务最容易把单机 CPU / IO 顶满
- 先拆 worker，对用户请求路径影响最小
- 回滚最简单
- 这是 fixed rollout contract 里风险最低、收益最高的第一步

### 但有一个硬前提

跨机器前，不能继续依赖：

- SQLite 单机文件
- 本地锁
- 本地缓存

因为 worker 和 api 不在一台机器后，这些本地真相就不共享了。

所以进入多机前，至少要满足：

- `DATABASE_URL` 指向所有节点都能访问的 PostgreSQL
- `REDIS_URL` 指向所有节点都能访问的 Redis

还要记住当前实现语义：

- 跨机 job dispatch 的真相在 PostgreSQL job 表
- worker 通过 poller 轮询共享 DB 取任务
- Redis 只做 lock / cache，不是当前的 job queue 真相

## 6. 未来多机部署路径（step by step）

下面按真正能执行的顺序写。

### Step 0：先把共享依赖准备好

无论你用托管服务还是自己搭，先准备：

1. PostgreSQL
2. Redis
3. 对象存储 / CDN
4. 私网 DNS 或者固定内网 IP

最低要求：

- `DATABASE_URL` 不能再是 SQLite
- `REDIS_URL` 不能再留空
- `API_INTERNAL_ORIGIN` / `BACKEND_HOST` 不能再是纯示例值

### Step 1：先在当前机器 rehearsal `split_runtime`

目的不是马上切多机，而是先把配置跑通。

```bash
cd ~/cosmeles
cp .env.split-runtime.example .env.runtime
```

然后至少替换这些值：

- `DATABASE_URL`
- `REDIS_URL`
- `API_PUBLIC_ORIGIN`
- `API_INTERNAL_ORIGIN`
- `ASSET_PUBLIC_ORIGIN`
- `ASSET_SIGNING_SECRET`
- `COOKIE_DOMAIN`
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_ASSET_BASE`
- `BACKEND_HOST`

先做 config 校验：

```bash
docker compose --env-file .env.runtime -f docker-compose.prod.yml config
```

再做本机 rehearsal：

```bash
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
curl -sS -I http://127.0.0.1:5001
```

注意：

- `readyz` 只检查数据库和 storage
- 它不代表 Redis、worker job、SSE 全都没问题
- 所以还要做真实 compare / upload / worker smoke

### Step 2：拆 `worker`，这是收益最高的第一步

这是第一个真正的多机动作。

#### 2.1 准备 worker 节点代码和 env

在新机器上：

```bash
git clone <your-repo> ~/cosmeles
cd ~/cosmeles
cp backend/.env.local.example backend/.env.local
cp .env.multi-node.example .env.runtime.worker
```

编辑：

- `backend/.env.local`
- `.env.runtime.worker`

关键值：

- `DEPLOY_PROFILE=multi_node`
- `RUNTIME_ROLE=worker`
- `DATABASE_URL=postgresql+psycopg://...`
- `REDIS_URL=redis://...`
- `API_INTERNAL_ORIGIN=http://<your-api-private-host>:8000`
- `BACKEND_HOST=<your-api-private-host>`
- `BACKEND_PORT=8000`
- `ASSET_PUBLIC_ORIGIN=https://assets.yuexuan.xyz`

#### 2.2 启动 worker 节点

```bash
cd ~/cosmeles
docker compose --env-file .env.runtime.worker -f docker-compose.prod.yml up -d --build --no-deps worker
```

#### 2.3 验证 worker 节点

```bash
docker logs --tail 200 cosmeles-worker
docker exec cosmeles-worker python -c "from app.platform.runtime_profile import describe_runtime_profile; import json; print(json.dumps(describe_runtime_profile(), ensure_ascii=False))"
```

确认：

- `runtime_role=worker`
- `worker_runtime_expected=true`
- `api_routes_enabled=false`

### Step 3：再处理 DB

下一步才是 `db`。

你的目标是把所有节点统一指向同一个 PG 真相。

有两种做法：

1. 直接上 managed PostgreSQL
2. 先把 PostgreSQL 放到独立 DB 机器

动作：

- 更新所有节点的 `DATABASE_URL`
- 先更新 worker，再更新 api
- 每更新一端就重启并检查 `readyz`

### Step 4：再拆 `api`

这一步开始影响用户 API 流量，所以排在 `worker` 和 `db` 后面。

#### 4.1 API 节点 env

新机器上：

```bash
cp .env.multi-node.example .env.runtime.api
cp backend/.env.local.example backend/.env.local
```

关键值：

- `DEPLOY_PROFILE=multi_node`
- `RUNTIME_ROLE=api`
- `DATABASE_URL=postgresql+psycopg://...`
- `REDIS_URL=redis://...`
- `API_PUBLIC_ORIGIN=https://api.yuexuan.xyz`
- `API_INTERNAL_ORIGIN=http://<your-api-private-host>:8000`
- `BACKEND_HOST=<your-api-private-host>`

#### 4.2 启动 API 节点

```bash
docker compose --env-file .env.runtime.api -f docker-compose.prod.yml up -d --build --no-deps backend
```

#### 4.3 验证 API 节点

```bash
curl -sS http://127.0.0.1:8000/healthz
curl -sS http://127.0.0.1:8000/readyz
```

然后再让 `api.yuexuan.xyz` 指向这个节点。

### Step 5：最后再拆 `web`

web 是最后一步，因为它最容易横向扩，也最不应该优先动。

#### 5.1 Web 节点 env

```bash
cp .env.multi-node.example .env.runtime.web
```

关键值：

- `DEPLOY_PROFILE=multi_node`
- `NEXT_PUBLIC_RUNTIME_PROFILE=multi_node`
- `NEXT_PUBLIC_API_BASE=https://api.yuexuan.xyz`
- `NEXT_PUBLIC_ASSET_BASE=https://assets.yuexuan.xyz`
- `BACKEND_HOST=<your-api-private-host>`
- `BACKEND_PORT=8000`
- `INTERNAL_API_BASE=http://<your-api-private-host>:8000`

#### 5.2 启动 Web 节点

```bash
docker compose --env-file .env.runtime.web -f docker-compose.prod.yml up -d --build --no-deps frontend
```

#### 5.3 验证 Web 节点

```bash
curl -sS -I http://127.0.0.1:5001
```

确认没问题后，再让 `www.yuexuan.xyz` 指向该节点。

## 7. 回滚纪律

必须遵守：

1. 一次只切一层
2. 顺序固定：
   - `worker`
   - `db`
   - `api`
   - `web`
3. 每切完一层都要做健康检查和业务 smoke

如果某一步失败：

- 不要继续切下一层
- 回到上一步配置
- 重启当前层对应服务

## 8. 当前最实用的建议

如果你今天只做一件事，建议是：

1. 先把当前 `single_node` 的 `.env.runtime` 固化好
2. 用这台 `2c4g` 机器稳定跑起来
3. 未来真要加机器时，先拆 `worker`

这条路线收益最大，风险最小，也和当前仓库已经冻结的 runtime contract 一致。
