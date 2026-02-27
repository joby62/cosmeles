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
- 容器：`frontend-dev`
- 端口：`5001 -> 3000`

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2) 线上生产模式（当前推荐）
使用 `docker-compose.prod.yml`：
- 容器：`cosmeles-frontend`
- 端口：`5001 -> 3000`
- 反代：Caddy -> `172.17.0.1:5001`（当 Caddy 在 Docker 内）

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 3) 历史全栈模式（backend + frontend + nginx）
使用 `docker-compose.yml`：
- 对外端口：`5000`（nginx）
- 适合本地联调，不作为当前线上主方案

```bash
docker compose up -d --build
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
