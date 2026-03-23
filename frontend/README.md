# Frontend（Next.js）

## 技术栈
- Next.js 16（App Router）
- React 19
- TypeScript

## 前端定位
- `app/m/`：用户前台，当前唯一主叙事阵地
- `app/`：desktop 内部工作台、分析台和剩余桌面页面
- 核心原则：先打通 mobile 决策主链路，再考虑 utility 辅链的承接与回流

## 文档入口
- 当前产品真相：
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-first-run-funnel-execution-spec-v1.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-decision-closure-spec-v1.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-compare-result-page-spec-v1.md`
- 当前架构真相：
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-first-run-and-compare-closure-rollout.md`
- 当前 initiative 面板：
  - `/Users/lijiabo/Documents/New project/docs/initiatives/NOW.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/DOC_INDEX.md`
  - `/Users/lijiabo/Documents/New project/docs/initiatives/TIMELINE.md`

说明：
- 这个 README 解释前端实现边界，不替代 initiative 真相。
- 如果 README 与 initiative doc 冲突，以 governed initiative doc 为准。

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

## 路由分层

### P0：决策主链路
- `/m`：决策首页，只做主叙事和主 CTA
- `/m/choose`：品类选择与进度恢复
- `/m/[category]/profile`：问答收集与收敛
- `/m/[category]/result`：结果交付页

### P1：实用辅链
- `/m/wiki`：产品/成分查询
- `/m/compare`：横向对比
- `/m/bag`：购物袋
- `/m/me`：历史、在用、返回入口

说明：
- 首访默认应进入 `/m`。
- `/m` 不承担产品地图教学，不承担四入口导览。
- `/m/choose` 只负责“恢复进度”和“选择品类”，不负责再次教育用户系统价值。

## 当前主叙事约束
- 首页只讲一件事：更快选到适合自己的护理方案。
- 首页只推一个主 CTA：`开始测配`。
- 首访叙事优先级：`/m` > `/m/choose` > `profile` > `result`
- `wiki`、`compare`、`me` 保留，但以下沉入口、底部导航和结果页回环为主。
- 任何页面都必须回答“这一屏只做什么”；回答不清，就是页面过胖。

## 当前度量优先级
- P0：`/m` 主 CTA 点击率
- P0：`/m/choose` 到答题开始率
- P0：问答完成率
- P0：结果页到达率
- P0：结果页 CTA 点击率
- P1：wiki / compare / me 承接与回流

## 关键组件与边界
- `components/mobile/MobileTopBar.tsx`
  - 负责 mobile 顶部导航与返回语义
- `components/mobile/MobileBottomNav.tsx`
  - 承载 utility 辅链入口，不替代首访主链路
- `components/DesktopTopNavGate.tsx`
  - 控制 `/m` 页面不显示桌面顶栏
- `frontend/features/mobile-decision/`
  - 决策主链路特性
- `frontend/features/mobile-utility/`
  - wiki / compare / me 等 utility 特性

## 设计与实现约束
- 不在同一页面硬塞 mobile/desktop 响应式 hack
- 首页不做产品地图导览
- `/m/choose` 不做长说明和重复教育
- 不做复杂表单和术语堆叠
- 优先验证“更快把用户送到结果页”，不是优先堆功能和情绪价值

## 常见问题
- Next.js 16 会提示 `middleware` 约定未来迁移到 `proxy`，当前是警告，不影响运行。
- 若移动端 logo 丢失，优先检查：
  - `public/brand/logo.svg`
  - `public/brand/logo.png`
  - `proxy.ts` 或相关重定向逻辑是否放行静态资源。
