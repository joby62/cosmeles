# 予选（MatchUp）

浴室里的最终答案。  
省下挑花眼的时间，只留最合适的一件。

## 项目定位
- 产品类型：洗护用品决策工具（不是展示型官网）
- 决策原则：`One Answer Policy`（每个品类只给一个最终推荐）
- 交互原则：路径清晰、一屏一事、强引导、弱干扰
- 端侧策略：`Desktop 冻结`，`Mobile (/m) 持续迭代`

## 目录结构
```text
backend/                  FastAPI + SQLite + 文件存储
frontend/                 Next.js App Router（desktop + mobile 双栈）
deploy/nginx/             历史 nginx 反向代理配置
docs/OPERATIONS_RUNBOOK.md  运维手册（Caddy / Docker / 502 排障）
```

## 开发与部署模式

### 1) 前端开发模式（热更新）
使用 `docker-compose.dev.yml`：
- 容器：`backend-dev` + `frontend-dev`
- 端口：
  - `5001 -> frontend-dev:3000`
  - `8000 -> backend-dev:8000`
- 说明：前后端都支持热更新（`next dev` + `uvicorn --reload`）
- Doubao：默认 `DOUBAO_MODE=real`（需配置 `backend/.env.local` 的 `DOUBAO_API_KEY`）

```bash
docker compose -f docker-compose.dev.yml up -d --build --remove-orphans
```

### 2) 线上生产模式（当前推荐）
使用 `docker-compose.prod.yml`：
- 容器：`cosmeles-backend` + `cosmeles-frontend`
- 端口：`5001 -> 3000`
- 本机后端健康检查：`127.0.0.1:8000`
- 反代：Caddy -> `172.17.0.1:5001`（当 Caddy 在 Docker 内）
- Doubao：默认 `DOUBAO_MODE=real`（建议在部署环境注入 `DOUBAO_API_KEY`）

```bash
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

### 3) 历史全栈模式（backend + frontend + nginx）
使用 `docker-compose.yml`：
- 对外端口：`5000`（nginx）
- 本机后端健康检查：`127.0.0.1:8000`
- 适合本地联调

```bash
docker compose up -d --build --remove-orphans
```

## 本地开发（不走 Docker）

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm ci
npm run dev
```

## Mobile IA（当前主线）
- `/m`：默认重定向到 `/m/choose`
- `/m/wiki`：成份百科（按类目查看成分作用）
- `/m/choose`：开始选择（品类入口）
- `/m/shampoo/start`
- `/m/shampoo/profile`
- `/m/shampoo/resolve`
- `/m/shampoo/result`
- `/m/bodywash/*`、`/m/conditioner/*`、`/m/lotion/*`、`/m/cleanser/*`
- `/m/me`：我的（记录已完成挑选与结果卡）

说明：桌面端页面保留，不再作为主要迭代对象。

## 文档导航
- 总运维手册：[docs/OPERATIONS_RUNBOOK.md](docs/OPERATIONS_RUNBOOK.md)
- 前端说明：[frontend/README.md](frontend/README.md)
- 后端说明：[backend/README.md](backend/README.md)

## 服务器重启后快速恢复（必看）
以下命令在服务器执行（`~/cosmeles`）：

### A. 生产恢复（推荐）
```bash
cd ~/cosmeles
git pull origin main

# 启动前后端 prod
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 重启 caddy（若你用 docker 跑 caddy）
docker restart caddy

# 验证
curl -I http://127.0.0.1:5001
curl -I http://127.0.0.1:8000/healthz
curl -I https://yuexuan.xyz
```

### B. 开发热更新恢复（dev）
```bash
cd ~/cosmeles
git pull origin main

docker compose -f docker-compose.dev.yml down --remove-orphans
docker compose -f docker-compose.dev.yml up -d --build --remove-orphans

# 验证
curl -I http://127.0.0.1:5001
curl -I http://127.0.0.1:8000/healthz
```

### C. 常见故障一句话判断
- `5001 能开，8000 不通`：后端没起来。
- 域名 502/503：优先检查 caddy upstream 与前端容器状态。
- `port is already allocated`：端口被旧容器占用，先 `down --remove-orphans`。
