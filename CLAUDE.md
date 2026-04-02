# PhaseGate — Claude Code 工作指南

## 项目简介

PhaseGate 是一套工程化的 AI 全自动编码流程 CLI 工具。核心机制：阶段隔离 context + 文件外化记忆 + Fork Worker 并发编排。

技术栈：Node.js + TypeScript + commander + fs-extra + chalk。模块系统：CommonJS。

## 关键文档（遇到不确定的地方先读对应文档）

| 问题 | 读这个 |
|---|---|
| 整体架构和设计原则 | docs/00_overview.md |
| 工作流各阶段如何运作 | docs/01_workflow_phases.md |
| progress.json / progress.md 格式 | docs/02_progress_document.md |
| 架构硬规则 | docs/03_architecture_constraints.md |
| 模块接口、依赖关系、build order | docs/05_cli_design.md |
| 当前开发进度 | progress.md |

## 文件写入规则

**修改任何文件后，同步更新以下位置：**

| 修改内容 | 需要同步更新 |
|---|---|
| 新增或修改模块接口 | docs/05_cli_design.md 对应模块章节 + 接口契约状态表 |
| 新增模块文件 | progress.md 模块开发状态表（状态改为 in-progress） |
| 模块开发完成 | progress.md 状态改为 done；progress.json 同步更新 |
| 修改工作流设计 | docs/01_workflow_phases.md |
| 修改进度文档格式 | docs/02_progress_document.md |
| 修改架构规则 | docs/03_architecture_constraints.md |
| 任何影响 README 的变更 | readme.md |

**progress.json 是状态的 source of truth**，progress.md 是展示用，两者需保持一致。

## 架构约束（硬规则，不可违反）

- 单文件不超过 500 行
- 模块只通过 index.ts 对外导出，禁止跨模块直接 import 内部文件
- 禁止循环依赖
- 测试覆盖率 ≥ 80%
- `src/commands/` 里的文件不含业务逻辑，只做 CLI 解析 + 调用 core
- `src/core/` 里的文件不做任何 CLI 输出（console.log 只在 commands 层）

## 项目目录结构

```
src/
├── index.ts              # CLI 入口，只注册命令
├── types.ts              # 全局类型，不含逻辑
├── commands/             # 每文件一个命令
└── core/                 # 核心业务逻辑
    ├── progress-manager.ts   # progress.json 读写
    ├── ai-runner.ts          # AI CLI 子进程调用
    ├── dependency-graph.ts   # DAG 构建
    ├── orchestrator.ts       # Fork Worker 编排
    └── constraint-checker.ts # 架构约束检查
.phasegate/               # PhaseGate 项目目录（纳入 git，设计书有保存价值）
├── requirements/         # 需求文档（init 时含模板文件）
├── design/               # 模块设计书（Phase 1 自动生成）
├── contracts/            # 接口契约（Phase 1 自动生成）
├── progress.json         # 项目状态（source of truth）
├── progress.md           # 项目进度（human-readable）
├── phasegate.config.json # 配置
└── scratchpad/           # 各模块 worker 工作目录（运行时，可 gitignore）
```

## Build Order

```
types.ts
    ↓
progress-manager / ai-runner / dependency-graph / constraint-checker  （可并行）
    ↓
orchestrator
    ↓
commands/*  （可并行）
    ↓
index.ts
```

## 当前任务

`commands/init.ts` 开发中（已有实现，待验证）。下一步：core 四个模块并行开发。
