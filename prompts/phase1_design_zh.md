# Phase 1：任务书生成

## 你的任务

读取需求，生成任务书和接口契约，为 Phase 2 评审提供输入。
非交互方式运行：完成全部任务、写入文件，然后输出 Phase 1 Summary。

---

## 开始前先读取

1. `.phasegate/requirements/` 下所有文件（需求）
2. 扫描 `src/` 目录结构（了解现有代码和模块布局）
3. `.phasegate/progress.json`（当前项目状态）
4. `.phasegate/tasks/` 下已有的任务书（避免重复或冲突）

---

## 执行步骤

### Step 1：范围评估

列出本次需求涉及的所有模块，对每个模块判断：

- **新增模块** / **大改**（实现逻辑变动 >100 行）/ **中改**（50~100 行）/ **小改**（<50 行）
- 是否涉及跨模块接口变更

### Step 2：粒度决策

根据评估结果，按下表决定任务书粒度：

| 情形 | 策略 |
|---|---|
| 新增模块 | 每个模块单独一份任务书 |
| 单模块大改 | 该模块单独一份任务书 |
| 单模块中改（有独立实现决策） | 该模块单独一份任务书 |
| 多模块中/小改（协同完成同一特性） | 合并为一份跨模块任务书 |
| 单模块中改（仅适配上游变更，无独立决策） | 并入触发方的任务书 |
| 纯接口变更（接口定义 + 消费方适配） | 合并为一份契约变更任务书 |

> **合并判断依据**：若拆分后每份文档实质内容不足 20 行，则应合并。

### Step 3：生成任务书

所有任务书输出到 `.phasegate/tasks/{name}.md`。
模板按需读取：`prompts/templates/task-book.md`

### Step 4：生成接口契约

仅为**跨模块接口**创建 `.phasegate/contracts/{InterfaceName}.md`。
模块内部类型不需要契约文件。已有契约文件只在接口定义变更时才覆盖更新。

契约模板按需读取：`prompts/templates/contract.md`

### Step 5：更新 progress

向 `.phasegate/progress.md` 追加 Phase 1 Summary。
Summary 模板按需读取：`prompts/templates/phase1-summary.md`

---

## 书写原则

所有文档的首要读者是 AI（Phase 2 reviewer、Phase 3 执行者），而非人类。

- **结构优先于叙述**：能用表格、列表表达的，不写段落；能用字段表达的，不写解释句
- **消除歧义**：每个字段的值必须是可执行的结论，不留"视情况而定"类的模糊表述
- **不写废话**：不加修辞性开场；Change Summary 就是一句功能陈述

---

## 语言规则

- 文档语言跟随 requirements 主语言；多语言混用时优先当前系统 locale。
- 同一次生成的所有文档保持同一种自然语言，不中英日混写。
- 代码、路径、TypeScript 标识符保持原样，不做翻译。
- 以下章节标题为解析锚点，固定英文，不翻译：
  `## Dependencies`、`## Status`、`## Definition`、`## Provider`、`## Consumers`

---

## Gate Conditions（结束前自检）

- [ ] 每份任务书的核心字段已填写，无模板占位符残留
- [ ] 每个跨模块接口均有对应契约文件，`frontmatter` 的 `consumers` 字段已填
- [ ] Phase 1 Summary 已追加到 `.phasegate/progress.md`
