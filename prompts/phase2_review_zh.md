# Phase 2：设计书评审

## 你的任务

对 Phase 1 生成的所有模块设计书和接口契约执行双轮评审。
非交互方式运行：完成两轮评审、尽可能修正问题，并且只要没有遗留 `P0` 级问题就允许通过 Phase 2。

---

## 开始前先读取

### Pass 1（AI 自检 — 对照需求）
1. `.phasegate/progress.md` — 确认当前阶段为 PHASE_2；加载 **Phase 1 Summary** 块作为上下文锚点
2. `.phasegate/requirements/*.md` — 所有已确认的需求（Scope、Acceptance Criteria、Edge Cases）
3. `.phasegate/tasks/*.md` — 所有模块设计书
4. `.phasegate/contracts/*.md` — 所有接口契约

### Pass 2（独立评审 — 空白上下文）
**只**加载以下内容，不加载需求、progress 或阶段摘要：
1. `.phasegate/tasks/*.md`
2. `.phasegate/contracts/*.md`

---

## Pass 1：AI 自检

按顺序逐一检查每份设计书和契约，完成以下所有检查项。

### 模块设计书（`.phasegate/tasks/*.md`）
- [ ] `Responsibility` 是只描述一个关注点的单句话
- [ ] `Out of Scope` 存在且非空
- [ ] 没有两个模块的职责存在重叠
- [ ] `File Structure` 包含 `index.ts`（仅 export）、`service.ts`（逻辑）、`types.ts`（本地类型）
- [ ] `Dependencies` 表中的每个接口在 `.phasegate/contracts/` 中都有对应的契约文件
- [ ] `Constraints` 中包含 500 行限制、禁止跨模块内部 import、已类型化 export 的要求
- [ ] `Test Requirements` 中注明覆盖率 ≥ 80% 并列出与需求对应的关键场景

### 接口契约（`.phasegate/contracts/*.md`）
- [ ] 每个契约文件包含含 `name`、`description`、`consumers` 字段的 YAML frontmatter
- [ ] `description` 在语义上足够明确，供 orchestrator 判断哪些模块需要注入该契约
- [ ] `consumers` 与所有设计书的 `Dependencies` 表一致（无错配）
- [ ] `Provider` 模块已命名
- [ ] `Definition` 块包含有效且完整类型化的 TypeScript 接口
- [ ] `Status` 为 `draft`
- [ ] `Change Rule` 章节存在

### 交叉验证（需求 ↔ 设计书）
- [ ] 需求中的每条 Acceptance Criteria 至少映射到某个模块的 `Responsibility`
- [ ] 需求中的每条 Edge Case 在某个模块的 `Responsibility` 中被处理，或在 `Out of Scope` 中明确排除
- [ ] 不存在循环依赖：追踪每条 `Dependencies` 链，确认没有 A → B → … → A 的环

---

## Pass 2：独立评审

只读取 `.phasegate/tasks/*.md` 和 `.phasegate/contracts/*.md`，不加载其他上下文。

Pass 2 以复核确认为主，但**不是只读检查**。如果 Pass 2 发现剩余问题，应在合理范围内直接修正对应的设计书或契约，然后重新检查受影响项。只有未解决的 `P0` 级问题才会阻断 Phase 2 通过。

对每份模块设计书，回答以下问题：
1. 仅凭设计书和注入的契约，能否独立实现这个模块？
2. 消费方契约中的每个方法签名，从契约定义本身是否能自明地理解？
3. 向契约中添加新的 Consumer 是否会破坏现有 Consumer？
4. 是否存在 `Dependencies` 表中未列出的隐式运行时依赖？

---

## 判定

两轮完成后，先给每个问题标注严重级别：

- `P0`：会导致 Phase 3 无法安全继续，必须在通过前修正
- `P1`：重要质量/正确性问题；本轮应尽量修正，但单独存在不阻断推进
- `P2`：轻微清晰度或可维护性问题；记录后可继续推进

然后立即输出以下之一：

```
PASS — 双轮评审完成，无遗留 P0 问题。
```

或

```
FAIL — 发现 P0 级问题：
  1. [Pass 1 | P0 | tasks/module-a.md] 缺少 `Out of Scope` 章节
  2. [Pass 1 | P0 | contracts/IFoo.md] `consumers` 列出了 moduleB，但 tasks/module-b.md 中没有对应的依赖项
  3. [Pass 2 | P0 | tasks/module-c.md] 不依赖 module-a 的 schema 隐式知识无法实现
  ...
```

---

## FAIL 时：修复并重新检查

1. 先在对应的 `.phasegate/tasks/` 或 `.phasegate/contracts/` 文件中修复每个 `P0` 问题。
2. 对 `P1/P2` 问题，在当前会话中合理可修的前提下尽量修正；若暂不修正，必须在 Summary 中记录。
3. 只重新检查被违反的项目。除非修复有连锁影响，否则不重新运行完整检查清单。
4. 这条规则同时适用于 Pass 1 和 Pass 2 发现的问题。Pass 2 发现的问题也应在合理范围内修正，不能只报告不处理。
5. 重复直到不存在遗留 `P0` 问题、判定为 PASS。

---

## 输出（PASS 时）

1. 在每个 `.phasegate/contracts/*.md` 文件中设置 `Status: finalized`（替换 `draft`）。
2. 向 `.phasegate/progress.md` 追加 Phase 2 Summary：

```markdown
## Phase 2 Summary

### Current State
设计书评审通过。所有模块职责明确，契约完备，无循环依赖。

### Issues Fixed
- {每个阻断性问题及解决方式的简短描述，或 "none"}

### Remaining Non-P0 Issues
- {留待后续处理的 P1/P2 问题，或 "none"}

### Outputs
- .phasegate/tasks/*.md：全部定稿
- .phasegate/contracts/*.md：全部定稿（Status: finalized）

### Notes for Phase 3
- {执行 wave 顺序提示，例如："module-c 依赖 module-a，必须在 wave 1 中开发"}
- {Coordinator 应遵守的特殊约束}
```

---

## 阶段检查（结束会话前确认）

- [ ] Pass 1 检查清单：所有设计书和契约中无剩余 `P0` 问题
- [ ] Pass 2 检查清单：所有设计书中无剩余 `P0` 问题
- [ ] 所有 `.phasegate/contracts/*.md` 已设置 `Status: finalized`
- [ ] Phase 2 Summary 已追加到 `.phasegate/progress.md`

---

## 结束行为（严格遵守）

阶段检查通过后：
- 报告已定稿的设计书和契约列表
- `phasegate run` 将自动检测所有契约已定稿，推进到 Phase 3，并在用户未显式执行 `phasegate run --phase 2` 时于同一 CLI 会话内继续执行
- **禁止**生成任何代码、脚手架或实现桩代码
- **禁止**询问"是否开始构建？"或任何类似引导
- 控制权交还给用户，等待用户的下一个指令
