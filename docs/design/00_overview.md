# PhaseGate 设计书 — 总纲

> 版本 0.1 | 2026年4月

---

## AI 快速参考

> **本节位 AI 读者。人工读者可跳过。**

| 问题 | 答案 |
|---|---|
| 这是什么工具？ | 工程化 AI 编码流程管理工具，带阶段隔离的 CLI | 
| 关键设计原则 | 文件外化记忆 + 阶段隔离 context + 契约先行 + Fork Worker 编排 |
| 工作流入口 | [01_workflow_phases.md](./01_workflow_phases.md) |
| 进度文件格式 | [02_progress_document.md](./02_progress_document.md) |
| 架构约束 | [03_architecture_constraints.md](./03_architecture_constraints.md) |
| CLI 模块设计 | [05_cli_design.md](./05_cli_design.md) |
| 不明白的术语 | 见下方「术语表」 |

**术语表：**

| 术语 | 定义 |
|---|---|
| Phase | 工作流中的一个阶段（PHASE_0 到 PHASE_5）|
| context | AI 当前 session 中加载的文档集合 |
| context 隔离 | 每个 Phase 结束后清空 context，下一个 Phase 重新加载 |
| 文件外化记忆 | 所有跨 Phase 信息写入文件，不依赖 AI 内存 |
| 契约先行 | 先确定接口定义，再写实现 |
| GATE | 进入下一 Phase 的前置条件检查项 |
| 双重 review | Phase_2/Phase_4 的两次验查（AI 自检 + 独立空 context AI）|

---

## 目录

| 文档 | 内容 |
|---|---|
| [00_overview.md](./00_overview.md) | 总纲（本文档）：背景、定位、核心原则、流程概览 |
| [01_workflow_phases.md](./01_workflow_phases.md) | 工作流各阶段详细设计（阶段0 ～ 阶段5） |
| [02_progress_document.md](./02_progress_document.md) | 进度文档规范 |
| [03_architecture_constraints.md](./03_architecture_constraints.md) | 架构约束（硬规则） |
| [04_product_roadmap.md](./04_product_roadmap.md) | 产品形态分阶段规划 |
| [05_cli_design.md](./05_cli_design.md) | CLI モジュール設計（インターフェース、依存関係、ビルド順） |

---

## 一、背景与动机

### 现有工具的问题

当前主流 AI 编码代理（Octopus、OpenHands、Devin、Copilot Workspace 等）存在共同缺陷：

**context 累积问题** 所有阶段在同一个 context 里执行，越到后期 context 越大，模型推理质量下降，容易出错，出错后返工成本高。主流解法是压缩摘要（有损）或依赖超大 context 窗口（昂贵），没有从根本上解决。

**缺少设计书层** 从需求直接跳到写代码，没有模块划分、接口定义、职责边界。AI 默认选最省事的方式组织代码——几千行写到一个文件，完全不考虑可维护性和扩展性。

**使用方式不明确** 终端命令、复杂配置、需要理解框架概念，普通开发者学习成本高，不够傻瓜式。

**需求建立阶段缺失** 需求讨论没有结构化承载，AI 不能主动澄清歧义，导致后期频繁返工。

### 核心洞察

好的工程设计原则对 AI 和对人的作用是一样的：

- 上下文太多 → 推理质量下降
- 职责不清晰 → 输出结构混乱
- 依赖关系模糊 → 模块间耦合严重

**用文件外化 AI 的记忆，按阶段隔离 context，是从根本上解决这些问题的方法。**

---

## 二、产品定位

### 一句话描述

一套工程化的 AI 全自动编码流程工具，让普通开发者通过结构化的阶段流程，得到可维护、有架构、可扩展的代码。

### 目标用户

**主要：个人开发者 / 独立开发者**

- 希望 AI 全程代劳，自己只参与需求和验收
- 没有精力维护复杂框架配置
- 在意代码质量，不只是功能实现

**次要：小团队开发者**

- 需要统一的 AI 编码规范
- 希望 AI 产出的代码能被团队维护

### 不是什么

- 不是编辑器（不做代码编辑功能）
- 不是 AI 模型（依赖现有 CLI 工具执行）
- 不是企业级平台（不做权限管理、审计日志等）

---

## 三、核心设计原则

**解耦合** 需求、设计、实现、review 四个阶段完全分离，每个阶段有独立的 context，完成后清零。

**文件即记忆** 所有跨阶段需要传递的信息都外化到文件——设计书、接口契约、进度文档。AI 每次启动只读它需要的那一部分，不背负历史包袱。

**Phase Summary 传递** 每个阶段完成后写入结构化 Summary，下一阶段只加载 Summary 作为 context 锚点，不重新加载全量历史（来自 Claude Code compaction 设计）。

**契约先行** 先定接口，再写实现。模块之间通过接口契约通信，不直接依赖对方内部实现，支持并行开发。

**按需注入 context** 契约文件携带 frontmatter（`consumers` 字段），orchestrator 按需注入——每个模块 worker 只加载自己实际依赖的契约，不全量加载（来自 Claude Code 记忆选择性注入设计）。

**Fork Worker 编排** Phase 3 模块开发由 Coordinator Agent 自动调度：构建依赖 DAG → 按 wave 并发 fork worker → 等待完成 → 解析标准报告 → 触发 downstream。无需人工介入（来自 Claude Code Coordinator 模式）。

**双重 review** 每个关键阶段做两次 review——先自我 review，再起一个空 context 的 AI 做独立 review。两次都不继承历史，避免确认偏误。

**Scratchpad 隔离** 每个模块 worker agent 有独立的 `.phasegate/scratchpad/{module}/` 工作目录，与项目目录完全隔离（来自 Claude Code scratchpad 设计）。

**工具无关** 底层执行依赖 Claude Code、Gemini CLI、Codex 等现有 CLI 工具，本工具只做调度和流程管理，不绑定特定模型。

**傻瓜式优先** UI 引导操作，不需要记命令，不需要理解框架概念，安装即用。

---

## 四、完整工作流概览

```
阶段0：需求讨论
    ↓
阶段1：需求确认 & 设计书生成
    ↓
阶段2：设计书 review（双重）
    ↓
阶段3：模块并行开发 + 测试
    ↓
阶段4：代码 review（双重）
    ↓
阶段5：你来验收
```

每个阶段完成后 context 清零，下一阶段只读必要文件。

各阶段的详细设计参见 [01_workflow_phases.md](./01_workflow_phases.md)。
