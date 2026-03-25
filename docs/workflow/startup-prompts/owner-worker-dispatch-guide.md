# Owner Worker Dispatch Guide

这不是制度文档，这是给 owner 真正派工时用的操作说明。

## 先把角色说清楚

当前默认协作模式不是：
- 用户定任务，owner 只是看一眼

而是：
- owner 是 Worker A / B / C 的直接管理者
- 用户默认是 relay / dispatcher
- 用户负责把 owner 准备好的内容转发出去
- worker 只在 owner 切好的边界内执行

所以 owner 每轮必须交付的不只是“思路”，而是完整可转发包。

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

还有一条必须长期保留：
- 如果用户问“我怎么发给他们”，owner 必须直接给可复制文本
- 不能只回：
  - “你自己口述一下”
  - “把这个文件发给他”
  - “你转述我的意思”

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
5. 如当前轮次有 `deploy-dispatch.md`，再发 `deploy-dispatch.md`
6. 再发 owner 准备好的可复制文本，明确：
   - 当前目标
   - 依赖
   - 必做验证
   - 回报格式

### 已经有上下文的同一对话框

1. 先重申对应 handoff 仍然有效
2. 再补发本轮 assignment
3. 如当前轮次有 `deploy-dispatch.md`，补发 `deploy-dispatch.md`
4. 再发本轮可复制文本
5. 不要默认 worker 记得上轮边界

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
- 如果用户负责转发，还必须给出：
  - 发给 Worker A 的完整文本
  - 发给 Worker B 的完整文本
  - 发给 Worker C 的完整文本
  - 固定发送顺序

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
- 只发文件路径，不给可复制文本
- 把用户当成第二个 owner，让用户自己重组任务
- 让 worker 自己猜当前 frozen truth
- 一边派工，一边自己下场把同类活做掉
- 不写时间，事后根本没法复盘
- 不写依赖，最后大家互相覆盖

## 每轮 owner 交付物清单

每轮 owner 至少要交出这 5 样东西：

1. 当前 phase 的 prompt 文件路径
2. 固定发送顺序
3. 发给 Worker A / Worker B / Worker C 的三段可复制文本
4. worker 回报后的 owner gate 规则
5. phase 结束时的收口动作：
   - `record`
   - `review`
   - `archive`（如满足 archive 规则）
   - `NOW / DOC_INDEX / TIMELINE`

少任何一项，交接班就会重新歪掉。

## 你每次派工前最少检查三件事

1. 这个 worker 的 handoff 有没有先给
2. 本轮 assignment 有没有明确 scope 和禁区
3. 时间戳和依赖顺序有没有写清
4. 如果会动正式文档，文档归属和目标状态有没有写清
5. 用户现在能不能直接复制你的文本发给 A / B / C

## Worker 回报后 owner 必做动作

worker 回报 `green | yellow | red` 后，owner 不得停在“收到”：

1. 审核 worker 结论是否仍在 write scope
2. 看当前代码 / 文档真相
3. 跑 owner 必做验证
4. 给出本轮 owner gate 结论
5. 如果 phase 关闭，补 `record / review / currentness`
6. 如果进入下一轮，先落新 phase prompt，再给用户可复制文本
