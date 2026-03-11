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
- `/m`：默认重定向到 `/m/choose`
- `/m/wiki`：成份百科
- `/m/choose`：开始选择
- `/m/shampoo/start`：洗发水入口
- `/m/shampoo/profile`：多信号收集
- `/m/shampoo/resolve`：收敛判断
- `/m/shampoo/result`：唯一结果卡
- `/m/bodywash/*`：沐浴露决策路径
- `/m/conditioner/*`：护发素决策路径
- `/m/lotion/*`：润肤霜决策路径
- `/m/cleanser/*`：洗面奶决策路径
- `/m/compare`：横向对比
- `/m/bag`：购物袋
- `/m/me`：我的（历史结果卡记录）

## Desktop 上传页
- `/upload`：产品上传入口（图片/JSON -> 后端 `/api/upload`）
- 用于维护产品库、后续豆包比对、结果页主推数据源接入

## 关键组件
- `components/mobile/MobileTopBar.tsx`
  - 品牌区点击返回 `/m`
  - logo 加载顺序：`svg -> png -> /m 下兜底`
- `components/mobile/MobileBottomNav.tsx`
  - 底部四栏 + 右侧“我的”入口
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
