# Phase 4：代码评审

## 你的任务

对 Phase 3 中成功完成的所有模块执行双轮代码评审。
非交互方式运行：完成两轮评审、尽可能修正问题、运行测试确认无回归，并且只要没有遗留 `P0` 级问题就允许通过 Phase 4。

---

## 首先确认评审范围

1. 读取 `.phasegate/progress.md` — 加载 **Phase 3 Summary** 块；提取 `done` 模块列表
2. 标记为 `failed` 或 `blocked` 的模块不在范围内——完全跳过
3. 若 `done` 模块数量为零，则无需评审；写入说明该情况的 Phase 4 Summary 后终止

---

## 每个模块的读取文件

### Pass 1（设计符合性检查）
对每个 `done` 模块：
- `.phasegate/tasks/{module}.md` — 设计书
- `.phasegate/contracts/*.md` — 该模块提供或消费的所有契约（通过 `consumers` frontmatter 确认）
- `src/{module-name}/` — 所有源文件（index、service、types、tests）
- `.phasegate/scratchpad/{module-name}/report.md` — [可选] worker 自述的 issues

### Pass 2（独立可读性检查）
对每个 `done` 模块——**只**加载以下内容：
- `.phasegate/tasks/{module}.md` — 设计书
- `src/{module-name}/` — 所有源文件

Pass 2 不加载契约、progress 历史或 Phase Summary。

---

## Pass 1：设计符合性评审

对每个 `done` 模块独立运行以下检查清单。

### 职责 & 范围
- [ ] 实现只做 `Responsibility` 中说明的事——不超出
- [ ] 实现没有做 `Out of Scope` 中列出的任何事

### 架构约束
- [ ] 每个源文件 ≤ 500 行（逐文件手动统计行数）
- [ ] `index.ts` 只包含 re-export（`export { ... } from './...'`）——无函数体、无类定义
- [ ] 没有 `import` 路径指向其他模块的内部文件（例如：`../other-module/service` 是违规；`../other-module` 或 `../other-module/index` 可接受）
- [ ] 所有导出符号有明确的 TypeScript 类型（无隐式 `any`，无未类型化的 export）

### 契约符合性
- [ ] 消费的契约中每个方法都以正确的签名和参数类型调用
- [ ] 提供的契约中每个方法都以正确的签名和返回类型完整实现
- [ ] 通过 `index.ts` export 的方法中，没有任何契约未声明的额外方法（未文档化的公共 API）

### 测试质量
- [ ] 测试覆盖率 ≥ 80%（带覆盖率运行测试并确认报告）
- [ ] 设计书 `Test Requirements` 中列出的所有场景至少有一个测试用例
- [ ] 测试覆盖每个场景的至少一个负面/边界情况——不仅限于正常路径
- [ ] 没有被跳过的测试或含空断言的测试

---

## Pass 2：独立可读性评审

假设你从未见过需求或设计历史。只读设计书和实现代码。

Pass 2 以复核确认为主，但**不是只读检查**。如果 Pass 2 发现剩余问题，应在合理范围内直接修正对应源码、重新运行必要测试，并重新检查受影响项。只有未解决的 `P0` 级问题才会阻断 Phase 4 通过。

对每个模块，回答以下问题：
1. 不查阅任何外部文档，只读代码是否能理解其意图？
2. 是否存在对共享/全局状态的隐藏副作用或修改？
3. 所有错误路径是否都被明确处理？（无静默 `catch` 块，无被吞掉的异常）
4. 下个月一位新开发者为该模块添加功能，需要修改哪些文件——这是合理的变更面吗？

任何揭示可读性或可维护性问题的回答都应标记问题，并分类为 `P0`、`P1` 或 `P2`。

---

## 判定

两轮完成后，先给每个问题标注严重级别：

- `P0`：会导致 Phase 5 无法安全继续，必须在通过前修正
- `P1`：重要质量/正确性问题；本轮应尽量修正，但单独存在不阻断推进
- `P2`：轻微清晰度或可维护性问题；记录后可继续推进

然后立即输出：

```
PASS — 双轮评审完成，所有被评审模块无遗留 P0 问题。
```

或

```
FAIL — 发现 P0 级问题：
  1. [Pass 1 | P0 | module-a/service.ts] 文件有 523 行（超过 500 行限制）
  2. [Pass 1 | P0 | module-b/service.ts:L88] 直接 import '../other-module/service'（内部 import 违规）
  3. [Pass 1 | P0 | module-c] 测试覆盖率 71%（低于 80% 阈值）
  4. [Pass 2 | P0 | module-d/service.ts:L44] 外部调用的错误被空 catch 块静默吞掉
  ...
```

---

## FAIL 时：修复并重新检查

1. 先在对应的源文件中修复每个 `P0` 问题。
2. 对 `P1/P2` 问题，在当前会话中合理可修的前提下尽量修正；若暂不修正，必须在 Summary 中记录。
3. 每次修复后重新运行测试，确认无回归。
4. 只重新检查被违反的具体检查清单项——确认它们现在通过。
5. 这条规则同时适用于 Pass 1 和 Pass 2 发现的问题。Pass 2 发现的问题也应在合理范围内修正，不能只报告不处理。
6. 重复直到不存在遗留 `P0` 问题、判定为 PASS。

---

## 输出（PASS 时）

向 `.phasegate/progress.md` 追加 Phase 4 Summary：

```markdown
## Phase 4 Summary

### Current State
代码评审通过。所有已完成模块的实现符合设计书，无架构约束违规。

### Coverage
- {module-name}: {N}% 覆盖率
- ...

### Issues Fixed
- {每个阻断性问题及解决方式的简短描述，或 "none"}

### Remaining Non-P0 Issues
- {留待后续处理的 P1/P2 问题，或 "none"}

### Modules Skipped（未评审）
- {module-name}: Phase 3 中 failed — {来自 Phase 3 Summary 的原因}
- {module-name}: Phase 3 中 blocked — {原因}

### Notes for Phase 5
- {可能需要额外人工核验的具体验收标准}
- {验收评审员应重点探查的已知技术债务或边界情况}
```

---

## 阶段检查（结束会话前确认）

- [ ] Pass 1 检查清单：所有已完成模块无遗留 `P0` 问题
- [ ] Pass 2 检查清单：所有已完成模块无遗留 `P0` 问题
- [ ] 修复后所有测试通过（运行完整测试套件；确认零测试失败）
- [ ] Phase 4 Summary 已追加到 `.phasegate/progress.md`

---

## 结束行为（严格遵守）

阶段检查通过后：
- 报告哪些模块通过了评审，哪些被跳过（failed/blocked）
- `phasegate run` 将自动检测 progress.md 中的 Phase 4 Summary，推进到 Phase 5，并在未显式执行 `phasegate run --phase 4` 时于同一 CLI 会话内继续执行
- **禁止**开始验收测试、生成验收指南或为 Phase 5 运行 constraint-checker
- 控制权交还给用户，等待用户的下一个指令
