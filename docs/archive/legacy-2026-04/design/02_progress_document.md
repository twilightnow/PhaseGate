# PhaseGate 设计书：进度文档

> 基于当前代码实现整理，更新时间：2026-04-07

## 1. 设计原则

当前实现明确区分两类进度文件：

- `.phasegate/progress.json`
  - 单一事实源
  - 命令和 orchestrator 都以它为准
- `.phasegate/progress.md`
  - 供人类和 AI 阅读
  - 由 `ProgressManager.write()` 自动同步生成

结论：不要把 `progress.md` 当状态写入源。

## 2. `progress.json` 真实结构

类型定义来自 [`src/types.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/types.ts)：

```ts
type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;
type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';
type ModuleRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';
type ContractStatus = 'draft' | 'finalized';
```

核心结构：

```json
{
  "projectName": "PhaseGate",
  "locale": "zh",
  "currentPhase": 0,
  "requirements": [],
  "design": {
    "modules": [],
    "contracts": [],
    "reviewPassed": false
  },
  "modules": [],
  "codeReviewPassed": false,
  "blockers": []
}
```

字段语义：

| 字段 | 含义 |
|---|---|
| `projectName` | 项目名，初始化时取当前目录名 |
| `locale` | 本地语言，用于 `progress.md` 文本和 prompt 选择 |
| `currentPhase` | 当前阶段编号 |
| `requirements[]` | Phase 0 产物列表 |
| `design.modules[]` | Phase 1 同步出的设计模块 |
| `design.contracts[]` | Phase 1 同步出的契约列表 |
| `design.reviewPassed` | Phase 2 gate 通过后自动写为 `true`；Phase 1 重新生成设计后会重置为 `false` |
| `modules[]` | Phase 3 运行时模块状态 |
| `codeReviewPassed` | Phase 4 gate 通过后自动写为 `true`；Phase 1 重新生成设计后会重置为 `false` |
| `blockers[]` | 失败原因文本集合 |

## 3. `progress.md` 真实结构

`progress.md` 由 [`ProgressManager`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/progress-manager.ts) 自动维护，分成两块：

1. Status Section
2. Phase Summary Section

对应的锚点注释：

```md
<!-- ==================== Status Section ==================== -->
<!-- ==================== Phase Summary ==================== -->
```

### 3.1 Status Section

这一段会在每次 `write()` 时整体重建，包含：

- 标题
- 当前阶段
- Requirements
- Design
- Module Development
- Code Review
- Blockers

这一段不应该手改。

### 3.2 Phase Summary Section

这一段是 append-only 设计：

- `appendPhaseSummary()` 会把摘要直接追加到尾部
- `write()` 在重建状态区时会保留已有 Summary 区

因此它的职责是：

- 给下一阶段 AI 提供压缩后的上下文
- 保留阶段性决策，而不是展示实时状态

## 4. `ProgressManager` 的真实职责

[`src/core/progress-manager.ts`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/progress-manager.ts) 当前提供这些能力：

- `read(cwd)`
  - 读取 `.phasegate/progress.json`
- `write(cwd, progress)`
  - 写回 json
  - 同步刷新 `progress.md`
- `updatePhase(cwd, phase)`
  - 更新当前阶段
- `markModuleDone(cwd, moduleName)`
  - 标记模块完成
- `markModuleFailed(cwd, moduleName, error)`
  - 标记失败并写入 `blockers`
- `markModuleBlocked(cwd, moduleName, blockedBy)`
  - 标记阻塞依赖
- `appendPhaseSummary(cwd, phase, summary)`
  - 在 `progress.md` 追加阶段摘要

## 5. 状态写入时机

当前代码里几个关键写入点：

| 场景 | 写入内容 |
|---|---|
| `init` | 初始化整份 `progress.json` |
| `chat` gate 通过 | `currentPhase = 1` |
| `run` Phase 1 收尾 | 同步 `design/modules/contracts`，并推进到 Phase 2 |
| `Orchestrator.run()` 期间 | 逐个模块标记 `done/failed/blocked` |
| Phase 3 成功收尾 | 推进到 Phase 4 |

## 6. 本地化行为

`progress.md` 的标题和章节标题不是固定英文，而是由 `locale` 决定。

当前内置：

- `zh`
- `ja`
- `en`

语言来源：

1. `detectLocale()`
2. 初始化时写入 `progress.locale`
3. 后续 `ProgressManager` 按这个字段渲染 markdown

## 7. 与旧设计的差异

旧文档里最常见的错误有三类：

1. 把 `progress.json` / `progress.md` 写在项目根目录
2. 把 `progress.md` 当成人工维护文件
3. 认为 Phase Summary 会被自动结构化生成并强校验

当前代码里的真实情况是：

- 文件位置固定在 `.phasegate/`
- `progress.md` 主要由程序维护
- Summary 追加接口已经有，但还没有被所有阶段系统性使用
