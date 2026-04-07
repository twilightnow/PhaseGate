# PhaseGate 设计书：工作流阶段

> 目标工作流定义，含当前实现差距，更新时间：2026-04-07

## 1. 阶段总览

`ProjectProgress.currentPhase` 只允许 `0 | 1 | 2 | 3 | 4 | 5`：

| Phase | 名称 | 入口命令 | 当前实现状态 |
|---|---|---|---|
| 0 | Requirements Discussion | `phasegate chat` | 已实现 |
| 1 | Design Generation | `phasegate run` | 已实现 |
| 2 | Design Review | `phasegate run` | 已实现为“prompt 驱动” |
| 3 | Parallel Module Development | `phasegate run` | 已实现 |
| 4 | Code Review | `phasegate run` | 已实现为“prompt 驱动” |
| 5 | Acceptance | `phasegate run` | 已实现为“prompt 驱动” |

说明：

- Phase 0 不走 `run`，而是强制使用 `chat`
- Phase 3 有专门的 Orchestrator
- 从 Phase 1 开始，常规路径不要求用户逐阶段手动介入；统一由 `phasegate run` 依据 `currentPhase` 自动推进
- 默认 `phasegate run` 会在同一 CLI 会话里连续执行：每个 phase 完成后先过 gate、写回 `progress.json` / `progress.md`，再从磁盘重建下一 phase 的上下文
- 其余阶段本质上都是“读取上下文文件 + 执行 prompt”
- 跨阶段恢复/断点再开始是后续专题设计；本文件只定义正常推进路径与 Phase 3 内部恢复

## 2. Phase 0：需求讨论

入口：`phasegate chat [--feature <name>]`

实际流程：

1. 检查 `.phasegate/progress.json` 是否存在
2. 根据 `detectLocale()` 选择 prompt 文件
3. 调用 `runner.chat(...)` 进入交互式会话
4. 会话退出后执行 `checkPhase0Gate(cwd)`
5. Gate 通过则把 `currentPhase` 更新为 `1`

当前 gate 校验逻辑来自 [`src/core/phase-gate.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/phase-gate.ts)：

- `.phasegate/requirements/` 下至少要有一个 `.md`
- 会排除模板文件 `requirements.md`
- 要满足某一套 locale 所要求的章节
- 默认章节集合：
  - `en`: `Description / Scope / Acceptance Criteria`
  - `zh`: 中文章节
  - `ja`: 日文章节

输出产物：

- `.phasegate/requirements/{feature}.md`
- `.phasegate/progress.json.currentPhase = 1`

## 3. Phase 1：设计生成

入口：`phasegate run`

实际流程：

1. `PhaseExecutor.execute(1)` 读取 `prompts/phase1_design*.md`
2. 传入上下文文件：
   - `.phasegate/progress.md`
   - `docs/03_architecture_constraints.md`
3. AI 生成或更新 `.phasegate/design` 相关产物
4. 命令结束后执行 `syncPhase1Outputs()`
5. Gate 通过后推进到 Phase 2，并继续进入下一阶段

`syncPhase1Outputs()` 的真实行为：

- 扫描 `.phasegate/design/` 目录并把文件名同步到 `progress.design.modules`
- 扫描 `.phasegate/contracts/` 并解析 frontmatter
- 把 design module 名称同步到 `progress.modules`
- 自动把 `currentPhase` 设置为 `2`

注意：

- 代码当前扫描的是 `.phasegate/design/`
- 但 `init` 创建的是 `.phasegate/tasks/`
- 而 `review` / `dependency-graph` / `orchestrator` 读取的也是 `.phasegate/tasks/`

这说明当前实现里存在一处目录命名不一致：Phase 1 同步逻辑仍然停留在旧的 `design/` 命名，文档必须明确这一点。

## 4. Phase 2：设计评审

入口：`phasegate run`

目标流程：

1. `PhaseExecutor.execute(2)` 读取 `prompts/phase2_review.md`
2. 上下文仍然是：
   - `.phasegate/progress.md`
   - `docs/03_architecture_constraints.md`
3. 调用 runner 执行设计审查
4. 结构化判定 review 是否通过，并写回 `design.reviewPassed`
5. Gate 通过后推进到 Phase 3，并继续进入下一阶段

当前实现差距：

- Phase 2 没有专门的结构化 review executor
- 也没有在代码里自动更新 `design.reviewPassed`
- 它更像“把当前上下文交给 AI 完成设计审查”
- Phase 2 gate 通过后会自动推进到 Phase 3；若不是 `--phase 2` 调试模式，则会在同一次 `phasegate run` 中继续执行

另外还有一个辅助命令：`phasegate review <module>`

它会：

- 读取 `.phasegate/tasks/{module}.md`
- 读取全部 `.phasegate/contracts/*.md`
- 用独立 prompt 做一次模块级设计评审

## 5. Phase 3：并行模块开发

入口：`phasegate run`

Phase 3 是当前代码里最完整的一段流程。

### 5.1 启动前检查

[`createRunCommand()`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/commands/run.ts) 会先执行：

1. `ConstraintChecker.check(cwd)`
2. 若存在 violation，立即退出
3. 否则启动 `Orchestrator.run(cwd)`

但当前 `ConstraintChecker` 仍然是 stub，因此 Phase 3 实际上总会通过这一关。

### 5.2 DAG 构建

[`DependencyGraph.build()`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/dependency-graph.ts) 会：

- 扫描 `.phasegate/tasks/*.md`
- 扫描 `.phasegate/contracts/*.md`
- 从 task 文档的 `## Dependencies` 表格提取模块依赖
- 从 contract frontmatter 的 `consumers` 决定哪些 contract 要注入到哪个 worker
- 做循环依赖检查

### 5.3 波次执行

`getExecutionWaves()` 会做拓扑分层：

- 同一 wave 的模块可并行执行
- 后续 wave 必须等待上游依赖完成

`Orchestrator.run()` 的实际行为：

1. 读取 `progress.json`
2. 把 DAG 中缺失的模块补入 `progress.modules`
3. 跳过已经 `done` 的模块，实现断点恢复
4. 每个 wave 用 `Promise.all()` 并发执行 worker
5. 成功模块标记 `done`
6. 失败模块标记 `failed` 并写入 `blockers`
7. 下游依赖失败时标记 `blocked`

### 5.4 Worker 输入与输出

每个 worker 会收到：

- 当前模块 task 文件
- 与该模块相关的 contract 文件
- `docs/03_architecture_constraints.md`，如果存在

每个 worker 会输出 `WorkerReport`，并由 orchestrator 写入：

- `.phasegate/scratchpad/{module}/report.json`

### 5.5 Phase 3 收尾

目标行为：

- 全部 `done` 或 `blocked`，且没有 `failed` -> `currentPhase = 4`
- 只要有 `failed` -> 不推进，提示修复后重跑
- Phase 3 内部允许按模块状态断点续跑

说明：

- 这里的断点续跑只指 Phase 3 orchestrator 内部恢复
- `phasegate run` 在跨阶段场景下如何从中断点恢复，后续单独设计

## 6. Phase 4：代码评审

入口：`phasegate run`

目标流程与 Phase 2 类似：

- 加载 `prompts/phase4_code_review.md`
- 注入 `.phasegate/progress.md` 和架构约束文档
- 调用 runner 执行评审
- 写回 `codeReviewPassed`
- Gate 通过后推进到 Phase 5，并继续进入下一阶段

当前实现差距：

- 自动遍历实际源码文件
- 自动写回 `codeReviewPassed`
- 自动修复 review issue

## 7. Phase 5：验收

入口：`phasegate run`

目标流程：

- 加载 `prompts/phase5_acceptance.md`
- 注入 `progress.md` 和架构约束文档
- 由 AI 给出验收结果或建议
- 在可自动判定的情况下完成闭环；需要人工判断时再停下等待

当前实现差距：

- 代码里虽然有 `Orchestrator.retry()`，但 Phase 5 还没有把它真正串进自动验收闭环
- 也没有形成完整的自动推进终态

## 8. 当前设计与代码偏差

最重要的几个偏差如下：

1. Phase 1 同步逻辑读取 `.phasegate/design/`，但其他实现已经使用 `.phasegate/tasks/`
2. Phase 2 / 4 / 5 已改为 gate 驱动的自动推进闭环；CLI 不再只依赖 prompt 文本输出，而是由 transition 层负责写回状态并决定是否继续
3. 约束检查器设计得很完整，但当前是空实现
4. 部分旧文档把 `progress.*` 写在根目录，当前真实位置是 `.phasegate/`
5. 跨阶段恢复策略还没有独立设计，目前只有 Phase 3 内部恢复明确落地
