# PhaseGate 设计书：架构约束

> 基于当前代码实现整理，更新时间：2026-04-07

## 1. 当前代码里的真实约束

虽然项目有“架构约束”这一概念，但当前真正被代码落实的约束并不多，主要分成三层。

## 2. 工作区与文件边界

### 2.1 工作区必须在 `.phasegate/`

当前命令实现默认把所有流程文件都放在 `.phasegate/`：

- requirements
- tasks
- contracts
- scratchpad
- progress
- config

这意味着：

- CLI 不依赖外部数据库
- PhaseGate 状态天然跟项目目录绑定
- 可以直接用 git 跟踪这些中间资产

### 2.2 运行时源数据只认 `progress.json`

这是一条实际生效的约束：

- `status/run/chat/orchestrator` 读的都是 `.phasegate/progress.json`
- `progress.md` 只是投影视图

## 3. 模块编排约束

### 3.1 依赖从 task 文档中解析

[`DependencyGraph.parseDesignDependencies()`](/c:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/dependency-graph.ts) 会读取 task 文档中的 `## Dependencies` 表格。

因此 task 文档至少要满足：

- 有 `Dependencies` 章节
- 依赖表格首列是模块名

否则：

- 会被视为无依赖模块
- 影响 Phase 3 的分波次结果

### 3.2 合同注入依赖 frontmatter

contract 文档 frontmatter 当前最关键的是：

```yaml
name: FooContract
description: ...
consumers:
  - ModuleA
  - ModuleB
```

实际用途：

- `consumers` 决定哪个 worker 会拿到这份 contract
- 如果 `consumers` 为空，当前实现会把这份 contract 注入给所有模块

### 3.3 禁止循环依赖

`DependencyGraph.build()` 在返回 DAG 前会执行 `validateNoCycles()`。

也就是说，下面这类情况会直接中断 Phase 3：

- `A -> B -> A`
- `A -> B -> C -> A`

## 4. 调度与失败传播约束

### 4.1 同一 wave 并发，不跨 wave 抢跑

`Orchestrator.run()` 的实际规则：

- 同一 wave 用 `Promise.all()` 并发执行
- 只有当前 wave 结束后才会进入下一 wave

### 4.2 失败会阻断下游

如果一个模块失败：

- 当前模块标记为 `failed`
- 错误文本追加到 `progress.blockers`
- 依赖它的后续模块会被标记为 `blocked`

这是当前实现里非常明确的一条运行时约束。

### 4.3 断点恢复依赖 `done` 状态

重跑 Phase 3 时：

- `progress.modules.status === 'done'` 的模块会被跳过
- 其余模块重新参与 DAG 波次计算

这要求 `progress.json` 始终保持可信。

## 5. AI runner 约束

### 5.1 允许的 runner

当前只支持三类 runner：

- `claude`
- `gemini`
- `codex`

别名：

- `openai -> codex`
- `chatgpt -> codex`

### 5.2 配置优先级

`createRunner()` 会按顺序找配置：

1. `.phasegate/phasegate.config.json`
2. 项目根 `phasegate.config.json`
3. 默认 `claude`

### 5.3 上下文注入方式

`run()` / `fork()` 会先把文件内容拼成：

```text
--- FILE: xxx ---
...

--- TASK ---
...
```

这意味着约束文档是否能生效，取决于：

- 文件路径是否被传入
- AI 是否遵守该 prompt

## 6. 当前尚未落地的约束

下面这些约束在设计里是合理的，但当前代码没有真正执行：

### 6.1 文件行数限制

`init` 生成的默认配置里有：

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80
}
```

但当前 `ConstraintChecker.check()` 直接返回：

```ts
{ passed: true, violations: [] }
```

所以“500 行限制”目前只是设计目标，不是有效约束。

### 6.2 覆盖率限制

同理，`minTestCoverage = 80` 还没有真实校验逻辑。

### 6.3 import 边界限制

文档里经常描述“不允许跨模块内部文件直连 import”，但当前代码没有静态分析或 AST 检查器来执行这件事。

## 7. 对设计书的建议写法

为了和代码保持一致，后续文档应区分两类约束：

- 已执行约束
  - 目录位置
  - DAG 无环
  - wave 顺序
  - 失败阻断
  - runner 选择
- 目标约束
  - 行数限制
  - 覆盖率门槛
  - import 边界
  - contract schema 完整校验
