# PhaseGate 设计书 — 工作流各阶段详细设计

> 版本 0.1 | 2026年4月

---

## 阅读说明（AI）

本文档格式统一如下：

- **LOAD** — 进入该阶段前必须加载的文件列表（`[必须]` / `[可选]`）
- **STEPS** — 按顺序执行的步骤
- **WRITE** — 本阶段必须产出的文件
- **GATE** — 进入下一阶段前必须全部通过的检查项

---

## PHASE_0: Requirements Discussion（需求讨论）

**PARTICIPANTS:** User + AI

**LOAD:**
- `.phasegate/progress.md` [必须] — 确认当前状态为 PHASE_0

**STEPS:**
1. 按以下框架逐项提问，直到用户明确确认所有项目已清晰
2. 每项未回答时继续追问，不跳过

**提问框架（按序执行）:**

| # | 问题类型 | 示例 |
|---|---|---|
| 1 | 功能边界 | 这个功能做什么？明确不做什么？ |
| 2 | 数据 | 涉及哪些数据？关系是什么？ |
| 3 | 异常 | X 失败时如何处理？有哪些边界情况？ |
| 4 | 验收 | 怎样算完成？谁来验收？ |
| 5 | 约束 | 技术栈？性能要求？其他限制？ |

**WRITE:**

| 文件 | 操作 |
|---|---|
| `.phasegate/requirements/{feature-name}.md` | CREATE（使用下方模板） |
| `.phasegate/progress.md` | UPDATE — 标记 PHASE_0 完成 |

**需求文件模板：**
```markdown
# {feature-name}

## Description
{一段话描述}

## Scope
IN: ...
OUT: ...

## User Stories
- As {user}, I want {action} so that {benefit}

## Edge Cases
| Scenario | Handling |
|---|---|
| ... | ... |

## Acceptance Criteria
- [ ] criterion

## Constraints
- Tech: ...
- Performance: ...
```

**GATE → PHASE_1:**
- [ ] `.phasegate/requirements/{name}.md` 文件存在
- [ ] Description、Scope、Acceptance Criteria 字段均已填写
- [ ] 用户已口头确认需求无歧义

---

## PHASE_1: Design Book Generation（设计书生成）

**PARTICIPANTS:** AI（用户可介入）

**LOAD:**
- `.phasegate/requirements/{name}.md` [必须]
- `.phasegate/progress.md` [必须]
- 项目代码目录结构（扫描，不读取全部内容）[必须]
- `docs/03_architecture_constraints.md` [必须]

**STEPS:**
1. 解析需求文件，识别所需模块
2. 为每个模块生成设计书 `design/{module-name}.md`
3. 识别模块间依赖，生成接口契约 `contracts/{interface-name}.md`
4. 在 `progress.md` 模块列表中注册所有模块和契约

**WRITE:**

| 文件 | 操作 |
|---|---|
| `.phasegate/design/{module-name}.md` | CREATE per module（使用下方模板） |
| `.phasegate/contracts/{interface-name}.md` | CREATE per interface（使用下方模板） |
| `.phasegate/progress.md` | UPDATE — 填充模块列表 + 接口契约表 |

**模块设计书模板：**
```markdown
# {ModuleName}

## Responsibility
{一句话：这个模块只做什么}

## Out of Scope
- {明确不做的事}

## File Structure
```
src/{module-name}/
├── index.ts      # 对外导出（不含逻辑）
├── service.ts    # 业务逻辑
└── types.ts      # 类型定义
```

## Dependencies
| Interface | Direction |
|---|---|
| {InterfaceName} | CONSUMES |

## Constraints
- Max 500 lines per file
- No direct import of other modules' internal files
- All exported symbols must be typed

## Test Requirements
- Coverage ≥ 80%
- Must cover: {list scenarios}
```

**接口契约模板：**
```markdown
---
name: {InterfaceName}
description: {一句话描述此接口的用途，供 context 注入决策使用，要足够语义明确}
consumers: [{ModuleName}, ...]
---

# {InterfaceName}

## Status
draft | finalized

## Definition
```typescript
interface {InterfaceName} {
  method(param: Type): ReturnType;
}
```

## Provider
- {ModuleName}

## Consumers
- {ModuleName}

## Change Rule
定稿后不可单方面变更。变更需通知所有 Consumers，重新走 PHASE_2 review。
```

**frontmatter 说明：**

| 字段 | 用途 |
|---|---|
| `name` | 接口标识符，与文件名一致 |
| `description` | 供 orchestrator 决策是否注入此契约文件，必须写得语义明确 |
| `consumers` | orchestrator 按此字段过滤——只把契约注入实际依赖它的模块 agent，不全量注入 |

**WRITE:**

| 文件 | 操作 |
|---|---|
| `.phasegate/design/{module-name}.md` | CREATE per module（使用上方模板） |
| `.phasegate/contracts/{interface-name}.md` | CREATE per interface（使用上方模板，含 frontmatter） |
| `.phasegate/progress.md` | UPDATE — 填充模块列表 + 接口契约表 + 写入 Phase 1 Summary |

**Phase 1 Summary 格式（写入 `progress.md` 末尾）：**
```markdown
## Phase 1 Summary

### Current State
已生成模块设计书：.phasegate/design/module-a.md, .phasegate/design/module-b.md, ...
已生成接口契约：.phasegate/contracts/IFoo.md, .phasegate/contracts/IBar.md, ...

### Key Decisions
- {本阶段做出的关键设计决策}

### Outputs
- .phasegate/design/：{N} 个模块设计书
- .phasegate/contracts/：{N} 个接口契约

### Notes for Phase 2
- {需要在 review 阶段重点关注的事项}
```

**GATE → PHASE_2:**
- [ ] 每个识别到的模块都有对应 `.phasegate/design/*.md`
- [ ] 每个跨模块接口都有对应 `.phasegate/contracts/*.md`（含 frontmatter）
- [ ] `.phasegate/progress.md` 中模块列表和接口契约表均已填写
- [ ] Phase 1 Summary 已写入 `.phasegate/progress.md`

---

## PHASE_2: Design Review（双重 review）

**第一次 review — AI 自检**

**LOAD:**
- `.phasegate/progress.md` 中的 **Phase 1 Summary** 段 [必须] — 作为本阶段 context 锚点，替代重新加载全量需求文件
- `.phasegate/requirements/{name}.md` [必须]
- `.phasegate/design/*.md` [必须，全部]
- `.phasegate/contracts/*.md` [必须，全部]

**检查清单：**
- [ ] 每个模块职责唯一（单一职责）
- [ ] 模块边界清晰，无职责重叠
- [ ] 所有跨模块调用路径都有对应接口契约
- [ ] 文件结构符合设计书规范
- [ ] 异常场景在需求文件中均有对应处理
- [ ] 验收标准可被明确验证

**第二次 review — 独立 AI（空 context）**

**LOAD（只给这些，不给需求文件）:**
- `.phasegate/design/*.md` [必须]
- `.phasegate/contracts/*.md` [必须]

**检查问题：**
- 设计能否被独立实现，不依赖隐性知识？
- 接口扩展后是否会破坏现有 Consumer？
- 是否存在循环依赖风险？

**WRITE:**

| 文件 | 操作 |
|---|---|
| `.phasegate/design/*.md` | UPDATE — 修复 review 发现的问题 |
| `.phasegate/contracts/*.md` | UPDATE — 修复契约定义问题 |
| `.phasegate/progress.md` | UPDATE — 标记 review 通过 + 写入 Phase 2 Summary |

**Phase 2 Summary 格式（写入 `progress.md` 末尾）：**
```markdown
## Phase 2 Summary

### Current State
设计书 review 通过。所有模块职责清晰，接口契约完整，无循环依赖。

### Key Decisions
- {review 过程中做出的设计调整}

### Outputs
- 所有 .phasegate/design/*.md 已定稿
- 所有 .phasegate/contracts/*.md 已定稿（状态改为 finalized）

### Notes for Phase 3
- {开发阶段需要注意的依赖顺序或特殊约束}
```

**GATE → PHASE_3:**
- [ ] 第一次 review 无阻断性问题
- [ ] 第二次 review 无阻断性问题
- [ ] 所有问题已修复并重新确认
- [ ] Phase 2 Summary 已写入 `.phasegate/progress.md`

---

## PHASE_3: Module Development（模块开发）

**PARTICIPANTS:** Coordinator Agent + Fork Worker Agents（全自动，无人工介入）

---

### Coordinator Agent

**LOAD:**
- `.phasegate/progress.md` 中的 **Phase 2 Summary** 段 [必须] — context 锚点
- `.phasegate/progress.md` 模块列表 + 接口契约表 [必须，只读]

**STEPS:**
1. 从 Phase 2 Summary 读取模块列表
2. 调用 `dependency-graph` 构建 DAG，计算 execution waves
3. 逐 wave 并发 fork 模块 agent（同一 wave 内无依赖，全部并发启动）
4. 等待本 wave 所有 worker 完成（成功/失败均等）
5. 解析各 worker 的标准报告，更新 `progress.md`
6. 某模块失败 → 其 downstream 标记 `blocked`，跳过；继续执行其余 wave
7. 所有 wave 结束后写入 Phase 3 Summary

**Fork 纪律（必须遵守）：**
- **Don't peek**：不在 worker 完成前读取其输出文件
- **Don't race**：等通知到达，不预测 worker 结果
- **Directive only**：fork prompt 只写指令，不写背景（背景已继承 context）

---

### Fork Worker Agent（per module）

每个 worker 是独立启动的 AI CLI 子进程，全新 context，不继承 Coordinator 的任何上下文。Coordinator 在启动时负责计算并注入固定的文件集合。

**LOAD（由 Coordinator 在启动子进程时注入，固定集合）:**
- `.phasegate/design/{this-module}.md` [必须]
- `.phasegate/contracts/{related-interfaces}.md` [必须] — 通过契约 frontmatter 的 `consumers` 字段过滤，只注入本模块实际依赖的契约
- `docs/03_architecture_constraints.md` [必须]

**不加载（硬性约束）：**
- 其他模块的实现代码
- 需求文件 / review 历史 / Phase Summary
- 无关的接口契约文件

**STEPS（per module）:**
1. 读取设计书，确认职责边界和 Out of Scope
2. 读取关联契约，确认方法签名
3. 先写测试（TDD），再写实现
4. 运行测试，修复直到全绿
5. 验证架构约束（行数、边界、导出规范）
6. 将结果写入标准报告文件，通知 Coordinator

**WRITE（per module worker）:**

| 文件 | 操作 |
|---|---|
| `src/{module-name}/` | CREATE — 实现代码 |
| `.phasegate/scratchpad/{module-name}/report.md` | CREATE — 标准报告（格式见下） |

**Worker 标准报告格式：**
```
Scope: {模块名} — {一句话职责复述}
Result: done | failed
Key files: src/{module-name}/index.ts, src/{module-name}/service.ts, ...
Files changed:
  - src/{module-name}/index.ts
  - src/{module-name}/service.ts
  - src/{module-name}/service.test.ts
Issues:
  - {问题描述（如有）}
```

---

**Phase 3 Summary 格式（Coordinator 写入 `progress.md` 末尾）：**
```markdown
## Phase 3 Summary

### Current State
已完成：module-a, module-b, module-c
失败：module-d（原因：{error}）
Blocked：module-e（下游依赖 module-d 失败）

### Outputs
- src/ 下各模块实现代码
- .phasegate/scratchpad/ 各模块标准报告

### Notes for Phase 4
- module-d 失败，Phase 4 review 只覆盖已完成模块
- {其他注意事项}
```

**GATE → PHASE_4:**
- [ ] 所有模块测试全绿（failed/blocked 模块除外）
- [ ] 所有完成模块覆盖率 ≥ 80%
- [ ] `.phasegate/progress.md` 模块列表状态已更新（done/failed/blocked）
- [ ] Phase 3 Summary 已写入 `.phasegate/progress.md`

---

## PHASE_4: Code Review（双重 review）

**第一次 review — AI 对照设计书检查**

**LOAD:**
- `.phasegate/progress.md` 中的 **Phase 3 Summary** 段 [必须] — 确认哪些模块需要 review，哪些 blocked
- `.phasegate/design/{module}.md` [必须]
- `.phasegate/contracts/*.md` [必须]
- 对应模块的实现代码 [必须]
- `.phasegate/scratchpad/{module}/report.md` [可选] — 了解 worker 自述的 issues

**检查项：**
- [ ] 实现职责与设计书 Responsibility 一致
- [ ] 无 import 其他模块内部文件（只通过 index.ts 访问）
- [ ] 单文件行数 ≤ 500
- [ ] 接口实现与 contracts 定义一致
- [ ] 测试覆盖率 ≥ 80%

**第二次 review — 独立 AI（空 context）**

**LOAD（只给这些）:**
- `.phasegate/design/{module}.md` [必须]
- 对应模块的实现代码 [必须]

**检查问题：**
- 不看历史，能否理解这段代码在做什么？
- 是否有隐藏的副作用或全局状态依赖？
- 未来加功能时需要修改哪些地方？（是否扩展友好）

**WRITE:**

| 文件 | 操作 |
|---|---|
| 各模块实现代码 | UPDATE — 修复 review 发现的问题 |
| `.phasegate/progress.md` | UPDATE — 标记 review 通过 + 写入 Phase 4 Summary |

**Phase 4 Summary 格式（写入 `progress.md` 末尾）：**
```markdown
## Phase 4 Summary

### Current State
代码 review 通过。所有实现与设计书一致，无架构约束违反。

### Key Decisions
- {review 过程中的修复决策}

### Outputs
- 所有模块实现代码已修复并确认

### Notes for Phase 5
- {验收阶段需要特别核验的点}
```

**GATE → PHASE_5:**
- [ ] 两次 review 均无阻断性问题
- [ ] 所有问题已修复
- [ ] Phase 4 Summary 已写入 `.phasegate/progress.md`

---

## PHASE_5: Acceptance（验收）

**PARTICIPANTS:** AI（自动验证）+ User（必须人工参与的部分）

Phase 5 分两个子阶段：AI 先跑完能自动验证的，通过后出人工验收指导书。

---

### PHASE_5A: AI Auto-verification（AI 自动验证）

**LOAD:**
- `.phasegate/requirements/{name}.md` → Acceptance Criteria 列表
- `.phasegate/progress.md` 中的 Phase 3 Summary + Phase 4 Summary
- 各模块测试报告（`.phasegate/scratchpad/*/report.md`）

**STEPS:**
1. 解析 Acceptance Criteria，识别可自动验证的条目
2. 运行所有模块测试，确认全绿
3. 运行 constraint-checker，确认无架构约束违反
4. 逐条自动验证可检查的 acceptance criteria（功能性测试、边界条件等）
5. 输出验证报告

**自动验证结果处理：**

| 结果 | 操作 |
|---|---|
| 发现 bug | **自动触发自修正循环**：针对失败模块重走 Phase 3（不重置整个项目） |
| 自修正后仍失败 | 暂停，报告人工介入，说明失败原因和已尝试的修复 |
| 所有可自动验证项通过 | 进入 PHASE_5B |

**自修正循环（bug 时）：**
```
发现 bug（测试失败 / 约束违反）
    ↓
定位到具体模块
    ↓
重新 fork 该模块的 worker（注入原始设计书 + 失败信息）
    ↓
重跑测试
    ↓
通过 → 继续 PHASE_5A 验证
失败（超过 N 次）→ 升级为人工介入
```

---

### PHASE_5B: Human Verification（人工验收）

**WRITE（AI 先输出）:**
- `acceptance-guide.md` — 人工验收指导书（见下方格式）

**人工验收指导书格式：**
```markdown
# {project-name} 验收指导书

## AI 自动验证结果
- [x] 所有单元测试通过（{N} 个用例）
- [x] 架构约束检查通过
- [x] {可自动验证的 acceptance criteria 条目}

## 需要人工验证的项目

### 1. {acceptance criteria 条目}
**验证方式：** {具体操作步骤}
**预期结果：** {应该看到什么}
**验收标准：** {怎样算通过}

### 2. ...
```

**STEPS（人工）：**
1. 阅读指导书，按步骤逐条验证
2. 每条标记 通过 / 不通过 + 原因

**结果处理：**

| 结果 | 操作 |
|---|---|
| 全部通过 | 完成，更新 `.phasegate/progress.md` 标记 PHASE_DONE |
| 发现 bug | 报告给 AI，触发自修正循环（同 PHASE_5A） |
| 发现设计问题 | **开新 Task**，不回滚当前项目 |

**设计问题 → 新 Task 规则：**

不回滚整个项目，而是针对有问题的部分创建新的子任务：
```
识别受影响的模块和接口契约
    ↓
新建 .phasegate/requirements/{fix-name}.md 描述问题
    ↓
对受影响部分重走 Phase 1（设计书修改）→ Phase 2（review）→ Phase 3（重新开发）
    ↓
完成后回到 Phase 5 重新验收
```
