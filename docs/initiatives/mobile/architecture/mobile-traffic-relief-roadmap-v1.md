---
doc_id: mobile-traffic-relief-roadmap-v1
title: Mobile Traffic Relief Roadmap v1
doc_type: architecture
initiative: mobile
workstream: architecture
owner: architecture-owner
status: draft
priority: p1
created_at: 2026-03-26
updated_at: 2026-03-26
related_docs:
  - mobile-architecture-v2
  - mobile-runtime-infrastructure-upgrade-plan-v1
  - mobile-postgresql-full-migration-plan-v1
---

# Mobile Traffic Relief Roadmap v1

## 1. 文档定位
- 本文是“未来流量止血完全体”的 parked roadmap。
- 当前状态是 `draft`：
  - 这是 backlog truth，不是 active execution truth。
  - 现在不派 phase，不进入 owner/worker dispatch。
  - 后续只有在 owner 明确 re-activate 后，才允许进入 `active -> frozen -> in_execution`。
- 本文要解决的问题只有一个：
  - 中国用户访问公开图片和静态资源时，不要持续把日本源站 `43.130.245.82` 当作每次请求的直接出口。

## 2. 当前事实

### 2.1 当前线上资产交付事实
- 当前代码已经支持 `assets` 公共域名 contract，但还没有完成“真实对象存储写入 + 公共资产读路径切换”。
- 当前生产态公开资产仍以日本源站本地文件为实际在线来源：
  - `backend/storage/`
  - `backend/user_storage/`
- 当前后端仍直接暴露本地静态挂载：
  - `/images`
  - `/user-images`

### 2.2 当前止血机会
- 即使文件仍在日本源站，只要公开图片和静态资源先接入 CDN，缓存命中后的中国访问就不必每次回日本源站。
- 这条路能先止住：
  - 轻量服务器出站流量包持续爆量
  - 中国用户图片/静态资源首屏和回访体验过慢

### 2.3 当前不能误判的边界
- 这条路线不是“直接删除本地文件”。
- 这条路线也不是“先把动态 API、SSE、streaming 一起塞进标准 CDN”。
- product/workbench/upload/analysis 仍有不少路径直接依赖本地文件语义；在这些路径改造前，不能把所有运行时文件真相直接搬离源站。

## 3. 目标状态
- 中国用户访问公开图片和静态资源时，优先命中中国边缘节点。
- 日本源站只承担：
  - CDN 回源
  - 动态 API
  - worker/runtime 本地执行所需文件
- 域名职责稳定分层：
  - `www.yuexuan.xyz`：页面与前端静态资源
  - `api.yuexuan.xyz`：动态 API / SSE / streaming / job status
  - `assets.yuexuan.xyz`：公开图片与公开 artifact
- product/workbench/upload 功能在止血过程中保持可用，不因为“资产域改造”导致分析、归并、详情读取直接退化。

## 4. 非谈判原则
- 先止血，再重构；不能为了追求“彻底对象存储化”先把线上 product 流程打坏。
- `assets` 先于 `www`，`www` 先于 `api`。
- 标准 CDN 不承担 `api` 的在线主语义，不缓存 SSE/streaming/dynamic job polling。
- 在公共资产读路径真正抽象完成前，不删除本地文件真相。
- 对外域名、回源域名、运行时源站语义必须分清，不能让加速域名回源到自己。

## 5. 推荐路线

### 5.1 Stage A: 最小止血
- 目标：
  - 先让 `assets.yuexuan.xyz` 成为公开图片与公开静态资产域。
  - 先上 CDN，但源站仍然是日本服务器 `43.130.245.82`。
- 动作：
  - 新增 `assets.yuexuan.xyz` DNS
  - 腾讯云 CDN 接 `assets.yuexuan.xyz`
  - 回源先指向现有日本源站
  - 为图片/公开静态资源设置明确缓存规则、压缩规则、回源 HOST
- 结果：
  - 不改上传写入逻辑
  - 不搬运行时文件
  - 先把公开资产读取流量挡在 CDN 前面

### 5.2 Stage B: 页面分发层止血
- 目标：
  - 在 `assets` 跑稳后，再让 `www.yuexuan.xyz` 接 CDN。
- 动作：
  - 页面 HTML 谨慎低缓存或不缓存
  - JS/CSS/字体/构建产物走更激进缓存
  - `@` 根域先不急着做复杂切换；可以先保留直连或只做到 `www` 的重定向
- 结果：
  - 站点公开静态内容进一步从日本源站卸载
  - 页面入口更快，但不误伤 API 动态语义

### 5.3 Stage C: 公共资产真相从“本地盘公开读取”升级到“对象存储公开读取”
- 目标：
  - 只迁“公开图片 / 公开 artifact”，不一次性迁所有运行时文件。
- 推荐实现：
  - 腾讯云 COS + 腾讯云 CDN
- 不推荐作为第一刀的实现：
  - 新买一台大陆服务器手工充当图片盘
- 动作：
  - 为公开资产定义 object key 规则
  - 建立 backfill 规则，把历史公开资产复制到对象存储
  - 让 `assets.yuexuan.xyz` 的源站切到 COS 或等价对象存储
- 结果：
  - 日本源站不再承担主要公开图片出站
  - 公开资产流量与运行时文件彻底分层

### 5.4 Stage D: 运行时兼容改造
- 目标：
  - 收口 product/workbench/upload/analysis 里“必须本地文件存在”的读路径假设。
- 动作：
  - 把“公开资产 URL”与“运行时私有工作文件”彻底拆开
  - 只把适合对象存储的公开资产走 runtime storage adapter
  - 保留 `tmp_uploads`、scratch、部分私有中间产物在本地，直到对应 bounded context 改造完成
- 结果：
  - 既不误删本地运行时依赖
  - 也不继续让公开资产被本地盘长期绑死

### 5.5 Stage E: 完整运维闭环
- 目标：
  - 让流量止血从一次性接入，变成可观测、可回滚、可扩展的长期能力。
- 动作：
  - 补 runbook：DNS/TXT 验证/CNAME 切换/回滚
  - 补监控：CDN 命中率、回源流量、源站出站、热门资源、异常回源
  - 补预算面：轻量服务器流量包、CDN 流量、COS 存储/回源 成本对照
- 结果：
  - 能判断“止血是否真的有效”
  - 能决定是否继续做更深层对象存储化

## 6. 推荐执行顺序
1. `assets.yuexuan.xyz`
2. `www.yuexuan.xyz`
3. 公开资产回源切 COS
4. product/runtime 读路径兼容改造
5. `api.yuexuan.xyz` 只在明确动态代理策略后再评估，不作为标准 CDN 第一优先级

## 7. 本路线的完成定义
- 中国用户访问公开图片时，边缘缓存命中率达到可接受水平，且日本源站图片出站明显下降。
- 轻量服务器流量包不再主要被公开图片/静态资源打爆。
- `assets`、`www`、`api` 的职责边界清晰，不再同域混跑所有对外流量。
- product/workbench/upload/analysis 在整条路线执行期间没有因为资产层改造丢失在线能力。
- 有明确 runbook、回滚方式、监控和成本观察面。

## 8. 当前不做的事
- 不在这份 backlog 文档里直接开 phase。
- 不把它当作已经启动的 object storage migration。
- 不把“接 CDN”误写成“已经完成真实对象存储改造”。
- 不把 `api` 的动态路径误判为适合普通静态 CDN 缓存。

## 9. 重新启用条件
- owner 明确决定把流量止血从 backlog 重新拉回 active execution。
- 已确认：
  - 有可用操作时间窗口
  - 已准备 DNS / CDN / ICP / 证书前置条件
  - 已同意先做 `assets` 再做 `www`
  - 已接受“先止血、后彻底对象存储化”的执行顺序

## 10. Owner 备注
- 这份文档刻意保持 `draft`，因为它现在是“未来路线图”，不是当前 active initiative。
- 重新启用时，owner 应基于当时真实线上状态补：
  - 当前域名/DNS 真相
  - 当前 CDN/ICP 状态
  - 当前资产写入/读取边界
  - 当前源站带宽与成本数据
