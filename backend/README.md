# Backend（FastAPI）

## 当前后端能力（完整清单）
- 健康检查与就绪检查（`/healthz`, `/readyz`）
- 产品上传入库（图片、JSON、豆包分析模式）
- 产品列表查询（支持分类/关键词/分页）
- 产品详情读取（返回完整产品 JSON）
- 产品编辑（分类、品牌、名称、一句话、标签）
- 产品删除（同步删除索引 + JSON + 图片）
- 分类统计（每个品类产品数量）
- 静态图片服务（`/images/*`）
- OpenAPI 文档（`/docs`, `/openapi.json`）

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
app/scripts/reindex.py   批量重建 products 索引
storage/                 图片、产品 JSON、SQLite 数据库
sample_data/             示例数据
```

## 路由与功能说明
### 1) 系统与文档
- `GET /healthz`
  - 功能：存活检查（进程是否在）
  - 返回：`{"status":"ok","service":"backend","env":"dev"}`
- `GET /readyz`
  - 功能：就绪检查（数据库可连接 + storage 可写）
  - 成功：`200 {"status":"ready"}`
  - 失败：`503`
- `GET /docs`
  - 功能：Swagger UI 文档
- `GET /openapi.json`
  - 功能：OpenAPI 规范 JSON

### 2) 产品查询
- `GET /api/products`
  - 功能：返回产品卡片列表
  - 参数：`category?`, `q?`, `offset=0`, `limit=100`
- `GET /api/products/page`
  - 功能：返回带分页元数据的列表
  - 参数：`category?`, `q?`, `offset=0`, `limit=30`
  - 返回：`{ items: ProductCard[], meta: { total, offset, limit } }`
- `GET /api/categories/counts`
  - 功能：返回各分类数量
  - 返回：`[{ "category":"shampoo", "count": 12 }, ...]`
- `GET /api/products/{product_id}`
  - 功能：返回完整产品 JSON（成分、summary、evidence）
  - 异常：产品不存在或 json 文件丢失返回 `404`

### 3) 产品维护
- `PATCH /api/products/{product_id}`
  - 功能：更新索引信息，并回写对应 JSON
  - Body(JSON)：`category?`, `brand?`, `name?`, `one_sentence?`, `tags?`
- `DELETE /api/products/{product_id}`
  - 功能：删除产品索引，并删除对应 json/image 文件
  - 返回：`{"id":"...","status":"deleted","removed_files":2}`

### 4) 上传入库
- `POST /api/upload`（推荐）
- `POST /api/ingest`（兼容旧入口）
  - 功能：接收上传并落库到 `storage + sqlite`
  - 默认来源：`source=doubao`（优先走图片识别）
  - 表单字段：
    - `image` 或 `file`（二选一，图片文件）
    - `meta_json` 或 `payload_json`（二选一，产品 JSON 字符串）
    - `category/brand/name`（可选，覆盖 JSON 同名字段）
    - `source`（可选：`manual | doubao | auto`）
  - 行为：
    - 仅图片：走豆包/样例分析生成结构化 JSON
    - 仅 JSON：直接入库
    - 图片+JSON：JSON 为主，图片用于展示与证据
  - 上传限制：
    - `image/*` 才允许
    - 最大文件大小：`MAX_UPLOAD_BYTES`（默认 8MB）

### 5) 静态资源
- `GET /images/{filename}`
  - 功能：读取 `storage/images` 下图片
  - 用法：前端产品图直接使用该路径

## 配置（`app/settings.py`）
- `APP_ENV`：环境标识，默认 `dev`
- `CORS_ORIGINS`：允许来源列表（逗号分隔）
- `STORAGE_DIR`：默认 `backend/storage`
- `DATABASE_URL`：默认 SQLite 文件（`backend/storage/app.db`）
- `DOUBAO_MODE`：`sample/mock | real`
- `DOUBAO_API_KEY` / `DOUBAO_ENDPOINT` / `DOUBAO_MODEL`
- `DOUBAO_REASONING_EFFORT`：默认 `medium`
- `DOUBAO_TIMEOUT_SECONDS`：默认 `60`
- `MAX_UPLOAD_BYTES`：上传图片大小限制，默认 `8388608`

可通过 `.env` 注入，未使用字段会被忽略。

### 豆包配置文件（推荐）
1. 复制模板：
```bash
cp backend/.env.local.example backend/.env.local
```
2. 在 `backend/.env.local` 填入 `DOUBAO_API_KEY`
3. 该文件已被 `.gitignore` 忽略，不会提交到仓库

### `DOUBAO_MODE` 说明
- `real`：调用豆包 Ark 在线分析（生产推荐）
- `mock` 或 `sample`：读取本地 `sample_data/product_sample.json`，不调用豆包（离线调试用）

## 存储与持久化
- 图片：`storage/images/`
- 产品 JSON：`storage/products/`
- 数据库：`storage/app.db`

线上请保证 `backend/storage` 做 volume 挂载与备份。

## 常用维护命令
- 批量重建索引：
```bash
cd backend
python -m app.scripts.reindex
```

- 查询健康状态：
```bash
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/readyz
```

- 查询某品类产品：
```bash
curl -s "http://127.0.0.1:8000/api/products?category=shampoo&limit=20"
```
