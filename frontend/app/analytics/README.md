# Desktop Analytics Hub PRD

## 什么是 PRD

PRD 是 `Product Requirements Document`，中文通常叫“产品需求文档”。

它解决的是 4 件事：

1. 这个功能为什么要做
2. 这个功能要给谁用
3. 这个功能第一版具体做什么、不做什么
4. 工程、设计、产品如何用同一份标准推进落地

这份文档对应的不是移动端页面，而是一个新的 **desktop 独立板块**：

- 一级板块名称：`数据分析`
- 目标路由：`/analytics`
- 信息层级：和 `/product`、`/matrix-test`、`/upload` 并列
- 第一版默认聚焦：`移动端行为与流失分析`

---

## 1. 文档信息

- 模块名称：Desktop Analytics Hub
- 一级入口：`/analytics`
- 模块定位：桌面端内部分析台
- 第一版主题：移动端产品发现、上传、横向对比、结果阅读链路分析
- 使用角色：
  - 产品经理
  - 运营/增长
  - 前端/后端工程师
  - AI/数据分析同学

---

## 2. 背景与问题

当前移动端已经形成一条真实业务链路：

1. 用户在百科详情页发现产品
2. 如果没有自己的产品，点击 CTA 去“我的在用”
3. 选择品类，进入横向对比
4. 选择产品库产品，可选补充自己正在用的产品
5. 启动 AI 对比分析
6. 查看结果，决定继续用/替换/分场景混用

此前我们主要知道：

- 页面能不能打开
- 接口有没有报错
- AI 有没有出结果

但我们不知道：

- 用户到底在哪一步最容易失去兴趣
- 是 CTA 不吸引、use 页转化差，还是 compare 上传/分析阶段劝退
- 报错时，最容易出问题的是哪个 stage
- 用户主观上觉得是“看不懂 / 太慢 / 太麻烦 / 不信结果”
- 成功跑完后，用户有没有真的看到结果页

因此需要一个 desktop 独立分析板块，把现有行为数据收拢成可读的产品视图。

---

## 3. 产品目标

### 3.1 核心目标

在不引入复杂 BI 依赖的前提下，给内部团队一个可直接使用的桌面分析台，回答以下问题：

1. 用户从“看到产品”到“进入 compare”这条链路哪里流失最多
2. compare 过程里最常失败的阶段是什么
3. 哪些错误最伤转化，是否集中在某些 category
4. 用户主观上最容易因为什么离开
5. 已完成 compare 的用户，是否真的进入结果页

### 3.2 第一版成功标准

第一版上线后，团队应该能在不查日志的情况下直接回答：

1. 最近 7 天 CTA 点击率是多少
2. 从百科详情进入 use 页后，有多少人继续进入 compare
3. compare 的整体完成率是多少
4. compare 失败主要集中在哪个 stage
5. 失败后的主观反馈 Top 3 是什么
6. 某个具体 `compare_id` 或 `session_id` 的路径是什么

---

## 4. 非目标

第一版不做：

1. 通用全站分析平台
2. 面向外部用户的可视化页面
3. 复杂多租户权限系统
4. 自动生成结论报告 PDF
5. 复杂 cohort / retention / LTV 分析
6. 埋点 SDK 多端统一治理

---

## 5. 当前已经收集到的数据

### 5.1 事件存储底座

当前所有移动端事件统一写入：

- 表：`mobile_client_events`

关键字段：

- `event_id`
- `owner_type`
- `owner_id`
- `session_id`
- `name`
- `page`
- `route`
- `source`
- `category`
- `product_id`
- `user_product_id`
- `compare_id`
- `step`
- `stage`
- `dwell_ms`
- `error_code`
- `error_detail`
- `http_status`
- `props_json`
- `created_at`

说明：

- `owner_id`：设备/浏览器级身份，用于设备维度用户路径
- `session_id`：一次站内会话 ID，用于会话级路径
- `created_at`：服务端入库时间
- `props_json`：原始扩展上下文，保留未拆平字段

### 5.2 每条事件自动携带的通用字段

前端统一 tracker 额外补充：

- `session_id`
- `client_ts`

后端统一补充：

- `owner_type`
- `owner_id`
- `created_at`

### 5.3 当前已埋事件总表

#### 页面级

- `page_view`
- `page_exit`

当前已覆盖页面：

- `wiki_product_detail`
- `my_use`
- `mobile_compare`
- `compare_result`
- `compare_result_error`

#### 百科详情链路

- `wiki_upload_cta_expose`
- `wiki_upload_cta_click`

主要字段：

- `page`
- `route`
- `source`
- `category`
- `product_id`
- `target_path`

#### 我的在用链路

- `my_use_category_card_click`

主要字段：

- `page`
- `route`
- `source`
- `category`
- `is_prefilled`
- `target_path`

#### compare 入口与选择

- `compare_intro_start_clicked`
- `compare_category_selected`
- `compare_upload_pick`
- `compare_library_pick`
- `compare_reset_to_intro`

常见字段：

- `category`
- `product_id`
- `is_recommendation`
- `is_most_used`
- `selected`
- `filename`

#### compare 上传与运行

- `compare_upload_success`
- `compare_upload_fail`
- `compare_run_start`
- `compare_stage_progress`
- `compare_stage_error`
- `compare_run_error`
- `compare_run_success`

关键字段：

- `category`
- `compare_id`
- `run_mode`
- `has_upload`
- `selected_library_count`
- `total_count`
- `pair_count`
- `stage`
- `stage_label`
- `percent`
- `pair_index`
- `pair_total`
- `error_code`
- `detail`
- `http_status`
- `retryable`
- `source_event`

#### compare 结果

- `compare_result_view`

关键字段：

- `category`
- `compare_id`
- `decision`
- `confidence`

#### 轻反馈

- `feedback_prompt_show`
- `feedback_submit`
- `feedback_skip`

关键字段：

- `trigger_reason`
- `stage`
- `stage_label`
- `error_code`
- `compare_id`
- `reason_label`
- `reason_text`
- `reason_text_len`
- `skip_reason`

### 5.4 当前反馈触发节点

第一版只在高流失节点触发，且是采样触发：

- `compare_upload_fail`
- `compare_stage_error`
- `compare_restore_failed`

采样逻辑：

- 采样率：`35%`
- 按 `session_id + promptKey` 稳定采样
- 同一提示在单会话中只显示一次

---

## 6. 当前暂未埋、后置处理的次优先级数据

这些不是缺失到不能做分析，而是为了先保证主链路稳定，暂时后置。

### 6.1 百科发现前置链路

尚未埋：

- `wiki_list_view`
- `wiki_product_click`
- 列表搜索词
- facet/filter 使用
- 列表滚动深度

影响：

- 现在能分析“进入详情之后”，但还不能分析“用户在列表里怎么找产品”

### 6.2 use 页细粒度

尚未埋：

- `my_use_prefill_hit`
- `my_use_page_land_reason`
- use 页停留超时
- use 页离开前未点击的细分原因

影响：

- 现在知道进了 use 页有没有点品类卡
- 但还不能区分“是页面没看懂”还是“页面看懂了但暂时不想传”

### 6.3 compare 结果页后续行为

尚未埋：

- `compare_result_leave`
- 结果页滚动深度
- 结果页 CTA 点击
- 看完结果后是否跳百科/返回重试/退出

影响：

- 现在知道结果页被看到了
- 但还不知道“看完之后有没有行动”

### 6.4 通用体验信号

尚未埋：

- `dead_click`
- `rage_click`
- `stall_detected`
- 首次交互耗时
- 页面首屏渲染完成时间

影响：

- 现在更偏“功能漏斗”
- 还不是完整“交互质量监控”

### 6.5 设备环境上下文

尚未埋：

- 浏览器版本
- 操作系统
- 设备类型
- 网络状态
- 页面语言

影响：

- 现在能做业务路径分析
- 但还不能做“某浏览器/某语言导致高失败”的环境诊断

### 6.6 数据模型限制

当前限制：

- `client_ts` 在 `props_json`，不是独立列
- `reason_text` 在 `props_json`
- `page_exit` 依赖浏览器离开事件，极端情况下可能丢
- 当前是设备级/会话级，不是账号级

---

## 7. Desktop 板块定位

### 7.1 信息架构

新板块：

- 名称：`数据分析`
- 路由：`/analytics`
- 位置：桌面端一级导航
- 并列关系：
  - `/product`
  - `/matrix-test`
  - `/upload`
  - `/analytics`

### 7.2 第一版页面结构

推荐 `/analytics` 第一版结构：

1. 顶部全局筛选栏
2. Overview 总览
3. Funnel 漏斗
4. Stage Errors 阶段失败
5. Feedback 用户反馈
6. Session Explorer 会话钻取
7. Coverage 数据覆盖说明

不建议第一版拆很多子路由。

推荐：

- `/analytics`
  - 默认就是“移动端行为分析总览”

第二版再考虑：

- `/analytics/mobile`
- `/analytics/desktop`
- `/analytics/quality`

---

## 8. 页面 PRD 详细方案

## 8.1 顶部全局筛选栏

### 目标

让产品、工程、运营可以快速缩小到某段时间、某品类、某错误类型。

### 筛选项

- 时间范围
  - 今天
  - 最近 7 天
  - 最近 14 天
  - 最近 30 天
  - 自定义
- `category`
  - all
  - shampoo
  - bodywash
  - conditioner
  - lotion
  - cleanser
- `page`
  - all
  - wiki_product_detail
  - my_use
  - mobile_compare
  - compare_result
- `stage`
  - all
  - prepare
  - resolve_targets
  - resolve_target
  - stage1_vision
  - stage2_struct
  - pair_compare
  - finalize
  - done
  - uploading
- `error_code`
  - all
  - 动态加载
- `trigger_reason`
  - all
  - compare_upload_fail
  - compare_stage_error
  - compare_restore_failed

### 交互要求

- 所有图表联动
- URL 带 query，支持分享当前视图
- 筛选变化不整页刷新

---

## 8.2 Overview 总览

### 目标

一眼看清最近流量和转化的总体健康度。

### 卡片列表

1. 移动端会话数
2. 唯一设备数
3. 百科详情页访问数
4. CTA 点击率
5. use 页转 compare 率
6. compare 启动数
7. compare 完成率
8. 结果页到达率
9. 反馈提交率

### 指标定义

- `移动端会话数`
  - 去重 `session_id`
- `唯一设备数`
  - 去重 `owner_id`
- `百科详情页访问数`
  - `page_view where page='wiki_product_detail'`
- `CTA 点击率`
  - `wiki_upload_cta_click / wiki_upload_cta_expose`
- `use 页转 compare 率`
  - `my_use_category_card_click / page_view(page='my_use')`
- `compare 启动数`
  - `count(compare_run_start)`
- `compare 完成率`
  - `compare_run_success / compare_run_start`
- `结果页到达率`
  - `compare_result_view / compare_run_success`
- `反馈提交率`
  - `feedback_submit / feedback_prompt_show`

### 展示方式

- KPI 卡片 + 与上一周期对比
- 每个卡片可点开查看明细趋势

---

## 8.3 Funnel 漏斗

### 目标

定位用户在哪一层掉得最多。

### 第一版主漏斗

1. `page_view(page='wiki_product_detail')`
2. `wiki_upload_cta_expose`
3. `wiki_upload_cta_click`
4. `page_view(page='my_use')`
5. `my_use_category_card_click`
6. `page_view(page='mobile_compare')`
7. `compare_run_start`
8. `compare_run_success`
9. `compare_result_view`

### 展示方式

- 标准转化漏斗图
- 每一层显示：
  - UV
  - 从上一层转化率
  - 从第一层累计转化率
- 支持按 `category` 切换

### 价值

- 一眼判断是前半段掉得多，还是 compare 内部掉得多

---

## 8.4 Stage Errors 阶段失败

### 目标

把 compare 失败从“模糊失败”变成“可定位失败”。

### 模块 1：阶段失败排行

字段：

- `stage`
- 失败次数
- 去重 `compare_id`
- 占 compare 启动比例

### 模块 2：错误码排行

字段：

- `error_code`
- 次数
- 去重 `compare_id`
- 平均 `http_status`

### 模块 3：阶段 × 错误码热力图

行：

- `stage`

列：

- `error_code`

值：

- count

### 模块 4：阶段耗时估算

基于：

- `compare_stage_progress.created_at`

估算：

- `prepare -> resolve_targets`
- `resolve_targets -> stage1_vision`
- `stage1_vision -> stage2_struct`
- `stage2_struct -> pair_compare`
- `pair_compare -> finalize`
- `finalize -> done`

### 注意

- 当前耗时用服务端入库时间近似
- 第一版足够用于发现大卡点

### 价值

- 工程可直接看到哪一阶段最伤转化
- 产品可判断“慢”到底发生在哪

---

## 8.5 Feedback 用户反馈

### 目标

补足“用户为什么放弃”的主观信息。

### 模块 1：反馈触发量

- `feedback_prompt_show`
- 按 `trigger_reason`

### 模块 2：反馈提交率

- `feedback_submit / feedback_prompt_show`

### 模块 3：Top reason label

按 `reason_label` 排序：

- `upload_problem`
- `dont_know_what_to_upload`
- `too_much_work`
- `leave_for_now`
- `hard_to_understand`
- `too_slow`
- `not_confident`
- `restore_unclear`

### 模块 4：trigger_reason × reason_label

用交叉表展示：

- 哪种失败更容易得到什么样的主观反馈

### 模块 5：自由文本池

来源：

- `feedback_submit.props_json.reason_text`

展示：

- 最近文本
- 按 trigger_reason 过滤
- 支持关键词搜索

### 价值

- 产品不再只靠猜用户为什么走
- 工程能快速知道“报错看不懂”是不是主要问题

---

## 8.6 Session Explorer 会话钻取

### 目标

给产品和工程一个“看具体案例”的地方。

### 查询入口

- 按 `session_id`
- 按 `compare_id`
- 按 `owner_id`
- 按时间范围 + category 搜索最近样本

### 时间线展示

按时间顺序展示：

- 进入了哪个页面
- 点击了哪个 CTA
- 选了什么品类
- 有没有上传
- compare 进入了哪些阶段
- 失败在哪
- 是否进入结果页
- 是否出现反馈卡
- 是否提交反馈

### 每条事件展示字段

- `created_at`
- `name`
- `page`
- `route`
- `category`
- `compare_id`
- `stage`
- `error_code`
- `http_status`
- `props_json`

### 价值

- 用于 debug 个案
- 也是产品看真实路径最直接的地方

---

## 8.7 Coverage 数据覆盖说明

### 目标

明确告诉团队：

- 当前哪些数据是可信的
- 哪些口径是近似
- 哪些数据还没埋

### 需要展示

- 当前已埋页面
- 当前已埋事件数
- 尚未埋的关键事件列表
- 采样说明
  - 反馈是 35% 抽样，不是全量
- 离站事件说明
  - `page_exit` 可能少量丢失

### 价值

- 避免团队误读数据

---

## 9. 第一版可以直接提供的信息价值

这套数据第一版已经足够提供 4 类价值。

### 9.1 产品价值

- 判断百科详情页 CTA 是否有效
- 判断 use 页是否承接住了百科来的用户
- 判断 compare 是否是主要流失点
- 判断结果页是否真的被看见

### 9.2 工程价值

- 快速定位高频失败阶段
- 看错误码分布而不是只看日志
- 看恢复任务是否经常失败

### 9.3 增长价值

- 看哪类品类更容易触发上传
- 看哪类品类更容易完成 compare
- 看哪类入口转化更高

### 9.4 用户体验价值

- 从主观反馈中识别“看不懂 / 太慢 / 太麻烦 / 不信结果”的主因

---

## 10. Desktop 后端接口方案

第一版建议增加以下接口：

### 10.1 `GET /api/products/analytics/mobile/overview`

返回：

- sessions
- owners
- wiki_detail_views
- cta_expose
- cta_click
- cta_ctr
- use_page_views
- use_category_clicks
- use_to_compare_rate
- compare_run_start
- compare_run_success
- compare_completion_rate
- compare_result_view
- result_reach_rate
- feedback_prompt_show
- feedback_submit
- feedback_submit_rate

### 10.2 `GET /api/products/analytics/mobile/funnel`

返回数组：

- `step_key`
- `step_label`
- `count`
- `from_prev_rate`
- `from_first_rate`

### 10.3 `GET /api/products/analytics/mobile/errors`

返回：

- `by_stage`
- `by_error_code`
- `stage_error_matrix`
- `stage_duration_estimates`

### 10.4 `GET /api/products/analytics/mobile/feedback`

返回：

- `by_trigger_reason`
- `by_reason_label`
- `trigger_reason_matrix`
- `recent_text_samples`

### 10.5 `GET /api/products/analytics/mobile/sessions`

支持：

- `session_id`
- `compare_id`
- `owner_id`
- `category`
- `date_from`
- `date_to`

返回：

- 事件时间线
- 会话摘要

---

## 11. 数据聚合口径

### 11.1 时间口径

第一版主时间口径：

- 使用服务端 `created_at`

原因：

- 已是结构化列
- 查询快
- 当前可直接索引

`client_ts` 仅做辅助参考，不做主过滤字段。

### 11.2 去重口径

- 会话：按 `session_id`
- 设备：按 `owner_id`
- compare：按 `compare_id`
- 页面 UV：按 `session_id + page`
- CTA UV：按 `session_id + product_id`

### 11.3 漏斗口径

第一版建议使用“会话级是否发生过该事件”：

- 某 `session_id` 里出现过该事件，即算进入该漏斗层

优点：

- 稳定
- 简单
- 不易被重复点击污染

### 11.4 阶段口径

`compare_stage_progress` 已在前端做过去重：

- 普通阶段：`compare_id + stage`
- `pair_compare`：`compare_id + pair_index/pair_total`

所以可以直接聚合，不需要再做复杂二次去重。

### 11.5 反馈口径

反馈卡是采样触发：

- `feedback_prompt_show` 是抽样后的曝光基数
- `feedback_submit_rate = feedback_submit / feedback_prompt_show`

不能拿 `feedback_submit / compare_stage_error` 直接算反馈提交率。

---

## 12. 第一版界面建议

推荐布局：

1. 顶部筛选栏
2. 第一屏：Overview KPI
3. 第二屏：Funnel + Stage Errors 双栏
4. 第三屏：Feedback + Session Explorer
5. 最底部：Coverage / Definitions

推荐桌面宽屏布局：

- 左：漏斗与错误
- 右：反馈与明细

推荐交互：

- 所有图表点击即过滤
- 右上角可复制当前筛选视图链接

---

## 13. 权限与安全

第一版建议：

- 仅 desktop 内部台可访问
- 不对外公开
- 不显示原始 owner 明文在大列表中
- 自由文本反馈需支持脱敏展示

不建议第一版：

- 开放任意人下载原始事件 CSV

---

## 14. 性能要求

第一版目标：

- Overview 接口 < 500ms
- Funnel / Errors / Feedback < 1s
- Session Explorer 单会话明细 < 500ms

建议：

- 所有聚合默认限制时间范围
- 默认最近 7 天
- 超大时间范围按日聚合

---

## 15. 风险与注意事项

### 15.1 当前能做的是“高质量第一版”，不是终局版

原因：

- 上游列表页行为还没埋
- 结果页后续动作还没埋
- 缺设备环境维度

### 15.2 `page_exit` 不可视为绝对准确

原因：

- 浏览器在极端情况下可能不发离开事件

### 15.3 反馈不是全量

原因：

- 是 35% 抽样

### 15.4 结果页“看了”不等于“读懂了”

原因：

- 当前只有 `compare_result_view`
- 还没有滚动深度和结果页后续动作

---

## 16. 第二阶段建议

如果第一版跑起来，第二阶段优先补：

1. `wiki_list_view`
2. `wiki_product_click`
3. `my_use_prefill_hit`
4. `compare_result_leave`
5. `compare_result_scroll_depth`
6. `stall_detected`
7. `dead_click`
8. `rage_click`
9. 设备/浏览器/语言上下文

这样第二阶段就能做：

- “发现页 -> 详情页”前半段分析
- “看完结果为什么不行动”分析
- “某环境下明显更差”的问题定位

---

## 17. DoD

当以下条件都满足时，认为 `/analytics` 第一版达到上线标准：

1. `/analytics` 成为 desktop 一级板块，和 `/product`、`/matrix-test` 并列
2. 能展示 Overview / Funnel / Errors / Feedback / Session Explorer 5 个区块
3. 所有指标均来自 `mobile_client_events`
4. 支持按时间、category、stage、error_code、trigger_reason 过滤
5. 能按 `compare_id` 和 `session_id` 查看会话时间线
6. 能明确标注采样、口径与缺失覆盖项

---

## 18. 建议的实施顺序

### Phase 1

- 后端聚合接口
- `/analytics` 页面骨架
- Overview + Funnel

### Phase 2

- Stage Errors
- Feedback

### Phase 3

- Session Explorer
- Coverage / Definitions

### Phase 4

- 补第二阶段埋点
- 迭代更细的体验分析
