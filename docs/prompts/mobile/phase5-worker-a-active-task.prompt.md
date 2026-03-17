# Phase 5 Worker A Active Task Prompt

你现在直接开工，不要空转。

先读：
1. `/Users/lijiabo/Documents/New project/docs/prompts/mobile/worker-a-cleanroom-handoff.prompt.md`
2. `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_p0_funnel.v1.json`
3. `/Users/lijiabo/Documents/New project/frontend/app/analytics/README.md`

## 这次只做一件事
把 Phase 5 owner 冻结的 P0 analytics contract 落到 `/analytics` 第一屏，能做的直接做，做不到的明确按 contract 标成 blocked，不允许自己发明私有 summary 口径。

## 你的任务边界

### 允许改
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/MobileAnalyticsDashboard.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/README.md`

### 不允许改
- utility route-state 语义
- `me / history / bag` continuation
- result contract
- `MobileBottomNav` 及其行为
- 新建 contract 外的 analytics event name / query param / summary key

## 交付目标

### 第一优先级
让 `/analytics` 第一屏明确回答以下 5 个问题中的 4 个“已可回答项”：
1. 有多少会话从 `/m` 点击主 CTA 进入主链路
2. 进入 `/m/choose` 后有多少会话开始答题
3. 哪一道题流失最高
4. 有多少会话成功到达结果页
5. 到达结果后有多少会话继续动作

### 具体要求
1. `/overview` / `/funnel` / dashboard 第一屏必须消费 owner 冻结的 P0 metric key。
2. 如果 backend 现在缺 `home_primary_cta_click`、`choose_view`、`choose_start_click` 聚合，就补到现有 analytics 聚合接口和 schema 里，但必须沿用 owner contract 的 key。
3. `question_dropoff` 当前必须显式展示为 `blocked` 或等价文案，说明原因是：
   - `questionnaire_view(step)` 还未形成稳定共享真值
   - 不是“暂无数据”
   - 不是“默认 0”
4. 结果动作必须分开：
   - `result_primary_cta_click`
   - `result_secondary_loop_click`
   - `utility_return_click`
5. compare 兼容事件只能留在 supporting context，不得重新占领第一屏 KPI。

## 实现顺序
1. 先比对 `analytics_p0_funnel.v1.json` 和当前 backend/frontend `/analytics` 字段差距。
2. 补 backend response contract 与测试。
3. 补 frontend types。
4. 改 dashboard 第一屏与文案。
5. 最后跑最小必要验证。

## 强约束
1. 不要发明 frontend-only summary shape。
2. 不要为了让图表“完整”伪造 `question_dropoff`。
3. 不要把 `compare_result_view` 当成结果到达主 KPI。
4. 不要动 `MobileBottomNav`，也不要碰任何会重新触发其 lint/stale-state 问题的周边改法。
5. 不要 push `main`。

## 最小验证

前端：
- `cd "/Users/lijiabo/Documents/New project/frontend"`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

后端：
- `cd "/Users/lijiabo/Documents/New project"`
- `python3 -m py_compile backend/app/routes/products.py backend/app/schemas.py`
- `PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`

## 输出要求
最终回复必须写清：
- 改了什么
- 为什么
- 验证结果
- 哪个 P0 问题仍 blocked，blocked 在 contract、ingestion 还是 UI
- commit hash
