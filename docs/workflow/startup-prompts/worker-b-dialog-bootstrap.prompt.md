# Worker B Dialog Bootstrap Prompt

Use the block below as the first message when opening a brand-new dialog for Worker B.
Do not shorten it.
Do not skip the handoff step.

```text
你现在是这个项目的 Worker B。先不要直接开工，先按顺序完整阅读下面文件，并严格服从其要求后再开始判断：

1. /Users/lijiabo/Documents/New project/docs/workflow/teams/engineering/mobile-architecture/workers/worker-b/cleanroom-handoff.prompt.md
2. /Users/lijiabo/Documents/New project/docs/workflow/governance/document-state-system-design-v1.md
3. /Users/lijiabo/Documents/New project/docs/workflow/governance/team-collaboration-decision-sop.md
4. /Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md
5. /Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md
6. /Users/lijiabo/Documents/New project/docs/initiatives/mobile/README.md
7. /Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md

读完后你的第一条回复不要开始实现，先只输出：
1. 你对当前项目局面的判断
2. 你的默认工作边界
3. 你不会擅自改动哪些层
4. 如果本轮触及正式文档，你会如何区分 `docs/workflow/` 和 `docs/initiatives/`
5. 你当前处于 waiting for assignment 状态
6. 当前绝对时间（Asia/Shanghai）

后续我会再给你本轮 assignment。收到 assignment 后，以 handoff 作为长期约束，以 assignment 作为当前任务真相。
在收到 assignment 前，不允许进入实现。
```
