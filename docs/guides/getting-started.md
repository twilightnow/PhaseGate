# 快速上手

- Type: guide
- Status: active
- Reader: both

## 前提条件

- Node.js 18+
- npm
- 支持的 AI CLI 适配器之一：`codex` 或 `claude-code`

## 典型设置

```bash
npm install
npm run build
phasegate init
```

在 `init` 期间，选择默认适配器或传入：

```bash
phasegate init --adapter codex
phasegate init --adapter claude-code
```

## 典型流程

1. 讨论或细化需求。

```bash
phasegate chat
phasegate chat --feature login
```

2. 查看待办列表和执行状态。

```bash
phasegate status
phasegate progress
```

3. 选择一个已批准的需求。

```bash
phasegate select login
```

4. 执行各阶段。

```bash
phasegate run
```

也可以一步完成选择和运行：

```bash
phasegate run --requirement login
```

5. 批量自动执行所有已批准需求（按优先级顺序）。

```bash
# 预览执行顺序（不实际运行）
phasegate loop --dry-run

# 自动运行全部 approved 需求
phasegate loop
```

`loop` 每完成一条需求后动态重新加载队列。遇到 `gate_failed` 时停止并保留当前需求状态，供人工处理后再次运行。

## 预期行为

- `chat` 仅处理 Phase 0
- `select` 将执行绑定到一个需求
- `run` 从活跃需求的当前阶段继续
- `progress.json` 是真实的状态来源
- 摘要和工作者报告写入 `scratchpad/`

## 常见问题

### `progress.json not found`

运行：

```bash
phasegate init
```

### `No active requirement is selected`

运行：

```bash
phasegate select <requirement>
```

或：

```bash
phasegate run --requirement <requirement>
```

## 相关

- [workspace-layout.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/workspace-layout.md)
- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
