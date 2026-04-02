
# PhaseGate

一套工程化的 AI 全自动编码流程工具。通过阶段隔离 context、契约先行、Fork Worker 编排，让 AI 产出可维护、有架构的代码。

## 核心理念

- **按阶段隔离 context** — 每个阶段完成后清零，避免 context 累积导致质量下降
- **文件即记忆** — 设计书、接口契约、进度文档承载跨阶段信息，AI 每次只读它需要的部分
- **Phase Summary 传递** — 每个阶段产出结构化 Summary，下一阶段只加载 Summary 作为 context 锚点
- **契约先行** — 先定接口，再写实现，支持模块并行开发
- **Fork Worker 编排** — Phase 3 由 Coordinator Agent 自动调度：构建依赖 DAG → 按 wave 并发 fork 模块 worker → 断点续跑
- **双重 review** — 自我 review + 独立 AI review，避免确认偏误
- **自动验收** — AI 先跑完能自动验证的部分，再出人工验收指导书，发现 bug 自动触发自修正循环

## 工作流

```
Phase 0: 需求讨论  →  Phase 1: 设计书生成  →  Phase 2: 设计书 review
                                                      ↓
Phase 5: 验收      ←  Phase 4: 代码 review  ←  Phase 3: 模块并行开发
```

Phase 3 内部由 Coordinator Agent 全自动编排，无需人工介入：

```
Coordinator
    ├── fork → module-A（独立子进程，注入设计书 + 相关契约）
    ├── fork → module-B
    └── fork → module-C
```

## 文档

| 文档 | 内容 |
|---|---|
| [docs/00_overview.md](docs/00_overview.md) | 总纲：背景、定位、核心原则 |
| [docs/01_workflow_phases.md](docs/01_workflow_phases.md) | 工作流各阶段详细设计 |
| [docs/02_progress_document.md](docs/02_progress_document.md) | 进度文档规范（progress.json + progress.md） |
| [docs/03_architecture_constraints.md](docs/03_architecture_constraints.md) | 架构约束（硬规则）|
| [docs/04_product_roadmap.md](docs/04_product_roadmap.md) | 产品形态分阶段规划 |
| [docs/05_cli_design.md](docs/05_cli_design.md) | CLI 模块设计（接口、依赖、build order）|

## 当前状态

版本 0.1 — Phase 2（CLI 工具开发）Step 1。

基础设施（package.json、tsconfig、入口、全局类型）已完成，`phasegate init` 命令开发中。
