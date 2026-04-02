# PhaseGate 设计书 — 架构约束（硬规则）

> 版本 0.1 | 2026年4月

---

## 阅读说明（AI）

本文档定义不可谈判的硬性规则。

- **Phase 2（文档阶段）**：所有规则为 ℹ️ **手动检查**。AI 自行对照检清单确认。
- **Phase 3（CLI 工具）**：规则将由 `constraint-checker` 模块 ✅ **自动检查**。

违反任意一条 → 强制返工 → 重新检查 → 通过才继续。

---

## 文件级别

| 规则 | 说明 |
|---|---|
| 单文件行数上限 | 不超过 500 行（可在项目配置中调整） |
| 单一职责 | 一个文件只做一件事 |
| 禁止循环依赖 | 模块之间不允许产生 A→B→A 的依赖环 |

---

## 模块级别

| 规则 | 说明 |
|---|---|
| 接口访问 | 模块只能通过接口契约访问其他模块，禁止跨模块直接 import 内部文件 |
| 统一导出 | 每个模块必须有 `index` 文件做统一对外导出 |
| 契约一致 | 模块实现必须与接口契约保持一致，契约变更须通知所有依赖方 |

---

## 测试

| 规则 | 说明 |
|---|---|
| 单元测试覆盖率 | 不低于 80% |
| 接口方法覆盖 | 接口的所有方法必须有对应测试用例 |

---

## Agent 隔离（Phase 3）

| 规则 | 说明 |
|---|---|
| Worker 写入范围 | 每个模块 worker agent 只能写入 `src/{own-module}/` 和 `.phasegate/scratchpad/{own-module}/`，不得写入其他模块目录 |
| Scratchpad 用途 | `.phasegate/scratchpad/{module}/` 只存放该模块 worker 的中间产物和报告，不存放最终代码 |
| Context 边界 | Worker agent 不加载其他模块的实现代码，不加载需求文件，不加载 Phase Summary，只读自己的设计书和相关契约 |
| Don't peek | Coordinator 在 fork worker 完成前不读取 scratchpad 目录 |

---

## 文件目录

| 规则 | 说明 |
|---|---|
| `.phasegate/` | PhaseGate 运行时目录，不提交到 git（加入 `.gitignore`） |
| `contracts/*.md` | 必须包含 frontmatter（`name`, `description`, `consumers` 字段），否则 orchestrator 无法正确过滤 context |

---

## 违规处理流程

```
检测到违规
    ↓
强制停止当前阶段
    ↓
生成违规报告（具体文件、行数、规则编号）
    ↓
返工修复
    ↓
重新自动检查
    ↓
全部通过 → 继续下一阶段
```

---

## 配置项（`phasegate.config.json`）

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80
}
```

仅以上两项可在项目级配置中调整，其余规则不可关闭。

---

## 手动检查清单（Phase 2 使用）

**PHASE_2（Design Review）时对设计书执行：**
- [ ] `design/` 下所有文件：明确 Responsibility + Out of Scope
- [ ] 没有模块 A 同时出现在另一个模块的 Responsibility 中
- [ ] `contracts/` 下每个契约都有 Provider + 至少一个 Consumer
- [ ] 每个契约文件包含完整 frontmatter（`name`, `description`, `consumers`）
- [ ] `contracts/` 的 `consumers` 字段与 `design/*.md` 的 Dependencies 表一致
- [ ] 不存在 A→B→A 形式的依赖环

**PHASE_4（Code Review）时对实现代码执行：**
- [ ] 逐文件只数行数，确认 ≤ 500 行
- [ ] grep 内部 import，确认没有跨模块直接引用
- [ ] 运行测试，确认覆盖率报告 ≥ 80%
