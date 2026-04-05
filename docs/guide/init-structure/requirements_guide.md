# requirements/ 目录指南

`.phasegate/requirements/` 存放项目的需求文档，是 Phase 0（需求确认）的输入和输出目录。

---

## 初始化后的内容

`phasegate init` 生成一个空白模板：

```
requirements/
└── requirements.md    ← 空白模板，供用户可选填写
```

---

## requirements.md 模板说明

模板结构如下，各字段用途：

```markdown
# {feature-name}
```
将 `{feature-name}` 替换为功能/模块名称，例如 `user-auth`、`payment-flow`。

---

### Description
用 1-3 句话描述这个功能做什么、为什么需要它。**写给 AI 看，要具体不要模糊。**

- 好：`读写 .phasegate/progress.json，提供模块状态的增删改查接口`
- 差：`管理项目进度，提升开发效率`

---

### Scope

```markdown
IN: ...
OUT: ...
```

- `IN`：明确列出包含的功能点
- `OUT`：明确排除的内容 — **这是防止 AI 过度实现的关键字段**

示例：
```markdown
IN: 读取、写入、更新单个模块状态；初始化空 progress.json
OUT: 不处理 progress.md 的生成（由单独模块负责）
```

---

### User Stories
可选字段。保留 1-2 条核心场景即可，PhaseGate 主要靠 Scope + AC 驱动。

---

### Edge Cases

| Scenario | Handling |
|---|---|
| 文件不存在 | 返回空对象，不抛出异常 |
| 并发写入 | 后写覆盖，记录警告 |

列出异常路径。这些内容直接影响 AI 生成代码的健壮性。

---

### Acceptance Criteria

每条标准必须**可验证**，格式建议 `输入X → 输出Y`：

```markdown
- [ ] readProgress() 在文件不存在时返回空对象而非抛出
- [ ] writeProgress() 写入后可被 readProgress() 完整读回
- [ ] updateModuleStatus(name, status) 只更新目标字段，不覆盖其他字段
```

**这是 Phase 5 验收的直接依据。**

---

### Constraints

记录技术和性能约束：
```markdown
- Tech: CommonJS 模块；不引入第三方 IO 库
- Performance: 单次读写 < 50ms（本地文件系统）
```

---

## Phase 0 执行流程

```
（可选）用户填写 requirements.md 草稿
    ↓
phasegate chat [--feature <name>]
    ↓ Claude 读取草稿 → 讨论 → 生成 requirements/{name}.md
    ↓ 用户退出会话（Ctrl+C / exit）
    ↓ Gate 检查自动运行
```

### Gate 检查条件

退出 Claude 会话后，PhaseGate 自动验证：

1. `requirements/` 下存在**至少一个非模板** `.md` 文件
2. 每个需求文件包含 `## Description`、`## Scope`、`## Acceptance Criteria`

Gate 失败时列出具体问题；修复后重新执行 `phasegate chat`。

---

## Phase 0 结束后的目录状态

```
requirements/
├── requirements.md          ← 原始模板（保留）
├── user-auth.md             ← AI 与用户讨论后生成
└── payment-flow.md          ← 可有多个需求文件
```

多个特性可对应多个需求文件，文件名即特性名。
