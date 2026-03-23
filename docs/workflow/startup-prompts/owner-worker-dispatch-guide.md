# Owner Worker Dispatch Guide

这不是制度文档，这是给 owner 真正派工时用的操作说明。

## 核心规则

每次给 worker 派工，顺序固定：

1. 先给对应 worker 的长期 `handoff`
2. 再叠加本轮 `assignment`

不要反过来。
更不要只丢本轮 phase prompt。

只丢 assignment 的问题很大：
- worker 不知道自己的长期边界
- worker 不知道哪些是 frozen truth，哪些只是本轮 scope
- worker 会把 phase 文件当成唯一真相，最后越干越窄，或者越干越歪

结论很简单：
- `handoff` 定长期工作方式
- `assignment` 定本轮任务范围

这两个不是一个东西。

另外再加一条：
- workflow prompt 不是 initiative 真相文档
- 如果本轮要落 PRD、rollout、review、record、archive，必须放进 `docs/initiatives/`

## 对应关系

- Worker A handoff:
  - `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-a/cleanroom-handoff.prompt.md`
- Worker B handoff:
  - `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md`
- Worker C handoff:
  - `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-c/cleanroom-handoff.prompt.md`

本轮 assignment 统一从这里取：
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/assignments/`

## 正确派工顺序

### 新开对话框

1. 用 `docs/workflow/startup-prompts/worker-x-dialog-bootstrap.prompt.md` 作为第一条消息
2. 让 worker 先读完自己的长期 handoff 和核心 live docs
3. 等 worker 回复 `waiting for assignment`
4. 再发本轮 assignment

### 已经有上下文的同一对话框

1. 先重申对应 handoff 仍然有效
2. 再补发本轮 assignment
3. 不要默认 worker 记得上轮边界

## assignment 派发格式

每次派工至少要带上：
- 当前绝对时间
- 本轮目标
- 该 worker 的 owned scope
- 不允许碰什么
- 依赖谁先完成
- 自检要求
- 升级条件
- 如果本轮会创建或更新正式文档，还要带上：
  - 文档应该放在 `docs/workflow/` 还是 `docs/initiatives/`
  - 目标文档路径
  - 目标 `status`
  - 是否涉及 `supersedes` / `superseded_by`

时间一律写绝对时间：
- 格式：`[YYYY-MM-DD HH:mm Asia/Shanghai]`

不要写：
- “现在”
- “今天晚点”
- “你先看看”
- “先做一点”

这类话没有复盘价值。

## 你应该怎么理解 handoff 和 assignment

`handoff` 回答的是：
- 你是谁
- 你默认怎么工作
- 你不能干什么
- 什么时候必须升级

`assignment` 回答的是：
- 你这轮具体干什么
- 你这轮不该干什么
- 你这轮的输出和验证是什么
- 如果会碰正式文档，你该把文档落到哪里，以及目标状态是什么

问题不在文件名。
根在你不能拿临时任务说明替代长期角色约束。

## Owner 最容易犯的错

- 只发 phase prompt，不发 handoff
- 让 worker 自己猜当前 frozen truth
- 一边派工，一边自己下场把同类活做掉
- 不写时间，事后根本没法复盘
- 不写依赖，最后大家互相覆盖

## 你每次派工前最少检查三件事

1. 这个 worker 的 handoff 有没有先给
2. 本轮 assignment 有没有明确 scope 和禁区
3. 时间戳和依赖顺序有没有写清
4. 如果会动正式文档，文档归属和目标状态有没有写清
