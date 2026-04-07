# Getting Started

- Type: guide
- Status: active
- Reader: both
- Use when: 首次运行 PhaseGate，或需要快速回忆典型使用路径时
- Source of truth: 是
- Update when: 安装要求、基础命令或初始化流程变化时

## Purpose

提供最短路径的安装、初始化和日常使用指引。

## Scope

包含：环境准备、启动方式、典型命令流、AI 路由默认值、常见问题。

不包含：内部实现细节、完整验收清单。

## Environment

- Node.js 18+
- npm
- 至少一个可用的 AI CLI；当前已适配 `claude`（Claude Code）或 `codex`

## Run Commands

开发阶段：

```bash
npx tsx src/index.ts <command>
```

构建后：

```bash
npm run build
node dist/index.js <command>
```

全局链接后：

```bash
phasegate <command>
```

## Typical Flow

1. 初始化项目

```bash
phasegate init
```

2. 做 Phase 0 需求讨论

```bash
phasegate chat
phasegate chat --feature login
```

3. 推进后续阶段

```bash
phasegate run
```

4. 查看状态或进度

```bash
phasegate status
phasegate progress
```

5. 对指定模块做 review

```bash
phasegate review <module>
```

## Default AI Routing

`phasegate init` 默认写入以下角色路由：

- `chat` / `phase1` -> `architect`
- `phase2` / `phase4` / `phase5` -> `reviewer`
- `phase3.coordinator` -> `architect`
- `phase3.worker` -> `implementer`

默认 adapter 组合：

- `architect` -> `codex`
- `reviewer` -> `claude-code`
- `implementer` -> `codex`

如需调整，编辑 `.phasegate/phasegate.config.json` 中的 `aiProfiles` 和 `aiRouting`。

## Command Use Notes

- Phase 0 必须用 `chat`，不要用 `run`。
- 一般优先用 `phasegate run`，只在调试时使用 `--phase N`。
- `progress.json` 是机器状态来源，`progress.md` 是阅读视图。

## Common Problems

### `progress.json not found. Run phasegate init first.`

说明当前目录尚未初始化。先运行：

```bash
phasegate init
```

### `Gate failed: No requirements file found`

说明 Phase 0 没有生成有效需求文件。重新运行：

```bash
phasegate chat
```

### `Prompt file not found`

通常说明 `prompts/` 缺失，或运行目录不正确。

### `Unsupported runner "gemini"`

说明当前版本已经启用 adapter-based routing，但只适配 `claude-code` 和 `codex`。请把旧 `runner` 或 `aiProfiles.*.adapter` 改成其中之一。

### `Circular dependency: ...`

说明 `.phasegate/tasks/` 中存在循环依赖，需要调整模块设计。

## Related

- [`workspace-layout.md`](./workspace-layout.md)
- [`testing.md`](./testing.md)
- [`../core/workflow-phases.md`](../core/workflow-phases.md)
