# Workspace Layout

- Type: guide
- Status: active
- Reader: both
- Use when: 需要确认 `.phasegate/` 各目录和文件的职责时
- Source of truth: 是
- Update when: `init` 生成内容、工作区布局或文件职责发生变化时

## Purpose

把原先分散的初始化结构说明合并成一份稳定指南。

## Scope

包含：`.phasegate/` 目录树、各文件职责、默认配置和使用边界。

不包含：详细阶段流程、长篇模板示例。

## Layout

```text
.phasegate/
  requirements/
    requirements.md
    {feature}.md
  tasks/
  contracts/
  scratchpad/
  progress.json
  progress.md
  phasegate.config.json
```

## File Responsibilities

### `requirements/`

- Phase 0 的输入与输出目录
- `init` 会生成一个基础模板
- 可包含 `requirements.md` 和按功能拆分的需求文档

### `tasks/`

- Phase 1 生成的模块任务文档
- Phase 3 会从中解析模块依赖关系

### `contracts/`

- Phase 1 生成的接口契约文档
- Phase 2 gate 会检查其 `## Status` 是否全部为 `finalized`

### `scratchpad/`

- Phase 3 worker 的临时产物目录
- 典型输出是每个模块的 `report.json`

### `progress.json`

- 机器状态单一事实源

### `progress.md`

- 阅读视图
- 由 `ProgressManager` 自动同步

### `phasegate.config.json`

- 项目级配置
- `init` 时自动生成

默认配置：

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

## Runner Values

- `claude`
- `gemini`
- `codex`
- `openai`
- `chatgpt`

其中 `openai` 和 `chatgpt` 当前都映射到 `codex` CLI。

## Related

- [`getting-started.md`](./getting-started.md)
- [`../core/progress-model.md`](../core/progress-model.md)
- `src/commands/init.ts`
