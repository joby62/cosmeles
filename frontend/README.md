# Frontend（Next.js）

## 当前前端定位

- `app/m/`：用户前台，当前唯一主叙事阵地
- `app/`：desktop 内部工作台、分析台和剩余桌面页面
- 当前前端已经完成 runtime profile wiring：
  - `single_node`
  - `split_runtime`
  - `multi_node`

如果 README 和 initiative 文档冲突，以 governed initiative doc 为准：

- [mobile-decision-prd-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md)
- [mobile-result-intent-routing-prd-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md)
- [mobile-first-run-funnel-execution-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md)
- [mobile-result-decision-closure-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md)
- [mobile-compare-result-page-spec-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md)
- [mobile-architecture-v2.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md)
- [mobile-runtime-infrastructure-upgrade-plan-v1.md](/Users/lijiabo/Documents/New%20project/docs/initiatives/mobile/architecture/mobile-runtime-infrastructure-upgrade-plan-v1.md)
- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)

## 当前 profile-aware 前端语义

### `single_node`

- 默认给低成本单机用
- `NEXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_ASSET_BASE` 可以保持为空
- `BACKEND_HOST/BACKEND_PORT` 使用 compose 内部服务发现

### `split_runtime`

- 用于同机 rehearsal 或拆分过渡态
- build-time / runtime 都要显式带上：
  - `BACKEND_HOST=api`
  - `INTERNAL_API_BASE=http://api:8000`
  - `NEXT_PUBLIC_API_BASE=https://api.yuexuan.xyz`
  - `NEXT_PUBLIC_ASSET_BASE=https://assets.yuexuan.xyz`

### `multi_node`

- 用于真正多机
- `api-internal` 只是示例占位，不是可直接上线的值
- 上线前必须替换为真实私网 DNS 或私网 IP

## 运行方式

### 本地开发

```bash
cd frontend
npm ci
npm run dev
```

默认端口：`3000`

### 生产构建

```bash
cd frontend
npm ci
npm run build
npm run start -- -p 3000 -H 0.0.0.0
```

### Compose 生产方式（推荐）

```bash
cd /Users/lijiabo/Documents/New\ project
cp .env.single-node.example .env.runtime
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build frontend
```

真正生产仍建议按完整栈启动：

```bash
docker compose --env-file .env.runtime -f docker-compose.prod.yml up -d --build postgres backend worker frontend
```

## 关键环境变量

- `DEPLOY_PROFILE`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `INTERNAL_API_BASE`
- `API_INTERNAL_ORIGIN`
- `NEXT_PUBLIC_RUNTIME_PROFILE`
- `NEXT_PUBLIC_API_BASE`
- `NEXT_PUBLIC_ASSET_BASE`
- `ASSET_PUBLIC_ORIGIN`
- `NEXT_COMPRESS`

这些值主要来自根目录的 runtime env 文件，而不是 `frontend/.env`。

## 路由分层

### P0：决策主链路

- `/m`
- `/m/choose`
- `/m/[category]/profile`
- `/m/[category]/result`

### P1：实用辅链

- `/m/wiki`
- `/m/compare`
- `/m/bag`
- `/m/me`

## 当前前端边界

- `/m` 不做产品地图导览
- `/m/choose` 只做恢复与品类选择
- utility 辅链保留，但不抢首访主叙事
- profile-aware API / asset origin 已是当前运行时 contract 的一部分，不能再写死到页面里

## 关键组件与目录

- `components/mobile/`
  - mobile 导航、bag、壳层组件
- `features/mobile-decision/`
  - 决策主链路特性
- `features/mobile-utility/`
  - wiki / compare / me
- `lib/api.ts`
  - 前端 API / asset origin 组装逻辑
- `next.config.ts`
  - rewrite / asset origin / compress 相关 wiring

## 验证命令

```bash
cd /Users/lijiabo/Documents/New\ project/frontend
npx tsc --noEmit
npm run build
```

## 进一步部署说明

完整部署、域名拆分和多机扩容，直接看：

- [docs/workflow/operations/README.md](/Users/lijiabo/Documents/New%20project/docs/workflow/operations/README.md)
