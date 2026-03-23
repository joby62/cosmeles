# 予选（MatchUp）

更快选到适合自己的护理方案。

## 当前产品判断
- 产品定义：个护决策工具，不是百科站、对比站，也不是展示型官网。
- 核心承诺：回答少量问题，直接得到更适合自己的护理方向和产品结果。
- 主链路：`/m` -> `/m/choose` -> `/m/[category]/profile` -> `/m/[category]/result`
- 北极星：首访用户从进入主链路到到达结果页的完成率。
- 辅链定位：`/m/wiki`、`/m/compare`、`/m/me` 保留，但不抢首访入口，不承担首屏主叙事。
- Desktop 定位：内部工作台与分析台，不承担用户首叙事。
- 内容供给：全场景结果内容继续保留在供给层，但前台必须表现得像一个窄、快、稳的决策工具。

## 文档导航
- 产品 PRD：[docs/initiatives/mobile/product/mobile-decision-prd-v1.md](docs/initiatives/mobile/product/mobile-decision-prd-v1.md)
- 结果页与回流 PRD：[docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md](docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md)
- 首访 funnel spec：[docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md](docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md)
- compare / closure spec：[docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md](docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md)
- compare result spec：[docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md](docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md)
- 当前架构基线：[docs/initiatives/mobile/architecture/mobile-architecture-v2.md](docs/initiatives/mobile/architecture/mobile-architecture-v2.md)
- 当前架构 playbook：[docs/initiatives/mobile/architecture/mobile-refactor-playbook.md](docs/initiatives/mobile/architecture/mobile-refactor-playbook.md)
- 运行时升级方案：[docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md](docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md)
- 前端说明：[frontend/README.md](frontend/README.md)
- 后端说明：[backend/README.md](backend/README.md)
- 文档索引：[docs/README.md](docs/README.md)
- workflow 索引：[docs/workflow/README.md](docs/workflow/README.md)
- initiatives 索引：[docs/initiatives/README.md](docs/initiatives/README.md)
- 当前文档面板：
  - [docs/initiatives/NOW.md](docs/initiatives/NOW.md)
  - [docs/initiatives/DOC_INDEX.md](docs/initiatives/DOC_INDEX.md)
  - [docs/initiatives/TIMELINE.md](docs/initiatives/TIMELINE.md)
- 运维手册：[docs/workflow/operations/operations-runbook.md](docs/workflow/operations/operations-runbook.md)

## 目录结构
```text
backend/                                          FastAPI + SQLite + 文件存储
frontend/                                         Next.js App Router（mobile 用户前台 + desktop 内部台）
deploy/nginx/                                     历史 nginx 反向代理配置
docs/README.md                                    docs 总索引与归档规则
docs/workflow/README.md                           workflow 规则、团队 prompt 与启动入口
docs/initiatives/README.md                        initiatives 输出文档与归档入口
docs/initiatives/mobile/product/                  mobile 产品 PRD
docs/initiatives/mobile/architecture/             mobile 架构与收口文档
docs/initiatives/mobile/reviews/                  mobile initiative review 输出
docs/initiatives/mobile/records/                  mobile initiative milestone 记录
docs/initiatives/mobile/archive/                  mobile initiative 历史快照
docs/workflow/teams/engineering/mobile-architecture/       微软架构师与 workers 的 handoff / assignments
docs/workflow/startup-prompts/                    owner / worker 新对话框启动 prompt
docs/workflow/operations/                                  运维与工具说明
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

### P0：决策主链路
- `/m`：决策首页，只讲一件事，只推一个主 CTA
- `/m/choose`：品类选择与进度恢复
- `/m/shampoo/profile`、`/m/bodywash/profile`、`/m/conditioner/profile`、`/m/lotion/profile`、`/m/cleanser/profile`
- `/m/shampoo/result`、`/m/bodywash/result`、`/m/conditioner/result`、`/m/lotion/result`、`/m/cleanser/result`

### P1：实用辅链
- `/m/wiki`：产品/成分查询与补充阅读
- `/m/compare`：横向对比
- `/m/bag`：购物袋
- `/m/me`：历史、在用与返回入口

说明：
- 首访叙事只围绕 P0。
- P1 保留，但以下沉入口、底部导航和结果页回环为主，不抢首屏解释权。

## 当前度量优先级
- P0：`/m` 主 CTA 点击率
- P0：`/m/choose` 到答题开始率
- P0：问答完成率
- P0：结果页到达率
- P0：结果页 CTA 点击率
- P1：wiki / compare / me 的承接与回流

## 文档治理规则
- `docs/workflow/` 只放规则、handoff、startup、assignment、ops。
- `docs/initiatives/` 只放 PRD、spec、architecture、rollout、review、record、archive。
- 当前 initiative 真相以显式 `status` 为准，不靠文件时间猜优先级。
- 查当前状态，先看：
  - `docs/initiatives/NOW.md`
  - `docs/initiatives/DOC_INDEX.md`
  - `docs/initiatives/TIMELINE.md`

## 上传解析（当前）
- `/upload` 走后端 `/api/upload`
- 豆包链路：`mini(看图提字)` -> `lite(基于文本结构化 JSON)`
- 两阶段原始输出会落盘到 `backend/storage/doubao_runs/`，并回传到前端上传页展示
- 若要前端分步展示，可走：`/api/upload/stage1` -> `/api/upload/stage2`
- 可定期调用清理接口：`POST /api/maintenance/cleanup-doubao?days=14`

## 服务器重启后快速恢复
以下命令在服务器执行（`~/cosmeles`）：

### A. 生产恢复（推荐）
```bash
cd ~/cosmeles
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
docker restart caddy
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
curl -I http://127.0.0.1:5001
curl -I http://127.0.0.1:8000/healthz
```

### C. 常见故障一句话判断
- `5001 能开，8000 不通`：后端没起来。
- 域名 502/503：优先检查 Caddy upstream 与前端容器状态。
- `port is already allocated`：端口被旧容器占用，先 `down --remove-orphans`。
