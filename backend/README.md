# Backend（FastAPI）

## 技术栈
- FastAPI
- SQLAlchemy + SQLite
- 文件存储（`storage/`）

## 运行方式

### 本地开发
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Docker
```bash
docker build -t cosmeles-backend ./backend
docker run --rm -p 8000:8000 -v $(pwd)/backend/storage:/app/storage cosmeles-backend
```

## 目录结构
```text
app/main.py              FastAPI 入口
app/routes/              API 路由（products / ingest）
app/services/            解析、豆包客户端、存储工具
app/db/                  模型、session、初始化
storage/                 图片、产品 JSON、SQLite 数据库
sample_data/             示例数据
```

## API 一览
- `GET /api/products`
  - 可选参数：`category`, `q`
- `GET /api/products/{product_id}`
- `POST /api/ingest`
  - 表单字段（MVP）：
    - `image` 或 `file`（二选一，图片文件）
    - `meta_json` 或 `payload_json`（二选一，产品 JSON 字符串）
    - `category/brand/name`（可选，覆盖 JSON 内同名字段）
    - `source`（可选：`manual | doubao | auto`）
  - 说明：
    - 只传图片：会走豆包/样例分析生成结构化 JSON
    - 只传 JSON：可直接入库（适合手工维护产品库）
    - 图片 + JSON：以 JSON 为主，图片用于展示与证据存档

## 配置（`app/settings.py`）
- `APP_ENV`：环境标识，默认 `dev`
- `CORS_ORIGINS`：默认 `http://localhost:3000`
- `STORAGE_DIR`：默认 `backend/storage`
- `DATABASE_URL`：默认 SQLite 文件（`backend/storage/app.db`）
- `DOUBAO_MODE`：`mock | real`
- `DOUBAO_API_KEY` / `DOUBAO_ENDPOINT` / `DOUBAO_MODEL`

可通过 `.env` 注入，未使用字段会被忽略。

## 存储与持久化
- 上传图片：`storage/images/`
- 产品 JSON：`storage/products/`
- 数据库：`storage/app.db`

线上请保证 `backend/storage` 做 volume 挂载与备份。

## 联调建议
- 前端通过 `/api/*` 与后端通信（反向代理转发）
- 本地无代理时，确保前端 `NEXT_PUBLIC_API_BASE` 指向后端地址
