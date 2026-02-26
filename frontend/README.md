# Frontend（Next.js）

## 技术栈
- Next.js 16（App Router）
- React 19
- TypeScript

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

## 路由分层（核心约束）
- `app/`：Desktop（冻结）
- `app/m/`：Mobile（主战场）

通过 `middleware.ts` 做移动端跳转：
- 移动设备访问 `/` -> 重定向到 `/m`
- 静态资源（如 `/brand/logo.svg`）跳过重定向

## Mobile 关键页面
- `/m`：为你推荐
- `/m/choose`：开始选择
- `/m/shampoo/start`：洗发水入口
- `/m/shampoo/profile`：多信号收集
- `/m/shampoo/resolve`：收敛判断
- `/m/shampoo/result`：唯一结果卡
- `/m/about`：关于我们（底栏放大镜入口）
- `/m/compare`：豆包比对
- `/m/bag`：购物袋

## 关键组件
- `components/mobile/MobileTopBar.tsx`
  - 品牌区点击返回 `/m`
  - logo 加载顺序：`svg -> png -> /m 下兜底`
- `components/mobile/MobileBottomNav.tsx`
  - 底部四栏 + 独立放大镜按钮
- `components/DesktopTopNavGate.tsx`
  - 控制 `/m` 页面不显示桌面顶栏

## 设计约束（必须遵守）
- 不在同一页面硬塞 mobile/desktop 响应式 hack
- 每页只做一件事
- 不做复杂表单和专业术语堆叠
- 优先验证“更快命中唯一答案”而不是视觉花哨

## 常见问题
- Next.js 16 会提示 `middleware` 约定未来迁移到 `proxy`，当前是警告，不影响运行。
- 若移动端 logo 丢失，优先检查：
  - `public/brand/logo.svg`
  - `public/brand/logo.png`
  - `middleware.ts` 是否放行静态资源。
