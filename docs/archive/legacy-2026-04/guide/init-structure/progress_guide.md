# progress.json / progress.md 指南

这两个文件由 `phasegate init` 创建，贯穿整个 PhaseGate 工作流。

---

## 两者的关系

| 文件 | 定位 | 读写方 |
|---|---|---|
| `progress.json` | **状态 source of truth** | PhaseGate CLI 机器读写 |
| `progress.md` | 人类可读的进度视图 | PhaseGate 自动生成，不要手动编辑状态区域 |

每次 CLI 更新状态时，两个文件同步更新，始终保持一致。

---

## progress.json

### 初始内容

```json
{
  "projectName": "PhaseGate",
  "currentPhase": 0,
  "requirements": [],
  "design": {
    "modules": [],
    "contracts": [],
    "reviewPassed": false
  },
  "modules": [],
  "codeReviewPassed": false,
  "blockers": []
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `projectName` | string | 项目名称，`init` 时从目录名读取 |
| `currentPhase` | number | 当前所处阶段（0-5） |
| `requirements` | string[] | Phase 0 生成的需求文件名列表 |
| `design.modules` | string[] | Phase 1 生成的设计书文件名列表 |
| `design.contracts` | string[] | Phase 1 生成的契约文件名列表 |
| `design.reviewPassed` | boolean | Phase 2 设计 review 是否通过 |
| `modules` | ModuleStatus[] | 各模块开发状态（Phase 3 填充） |
| `codeReviewPassed` | boolean | Phase 4 代码 review 是否通过 |
| `blockers` | string[] | 当前阻塞项列表 |

### ModuleStatus 结构

Phase 3 开始后，`modules` 数组中每条记录的结构：

```json
{
  "name": "progress-manager",
  "status": "in-progress",
  "workerPid": 12345,
  "startedAt": "2026-04-03T10:00:00Z",
  "completedAt": null,
  "error": null
}
```

`status` 取值：`pending` | `in-progress` | `done` | `failed`

### 何时不要手动编辑

`progress.json` 由 CLI 管理。以下情况**可以**手动编辑：
- 修复 CLI bug 导致的状态错误
- 强制回退阶段（将 `currentPhase` 减小）
- 清除错误的 blockers

手动编辑后执行 `phasegate status` 验证格式是否正确。

---

## progress.md

### 结构

文件分两个区域，由注释分隔：

```
<!-- ==================== Status Section ==================== -->

# PhaseGate Project Progress
...（当前状态，CLI 管理，不要手动修改）

<!-- ==================== Phase Summary ==================== -->
<!-- Append phase summaries below. Existing summaries should not be edited. -->

（每个 Phase 完成后追加总结，只追加不修改）
```

### Phase Summary 格式

每个阶段完成后，CLI 在文件末尾追加：

```markdown
## Phase 1 Summary — 2026-04-03

- 生成模块设计书 5 份
- 生成接口契约 3 份
- 设计 review：PASS
```

### 手动写入 progress.md 的规则

- **Status Section（注释之间的部分）**：不要手动编辑，CLI 会覆盖
- **Phase Summary 区域**：可以追加备注，但不要修改已有的 Summary 内容

---

## 常用查看命令

```bash
phasegate status      # 输出当前阶段和关键状态
phasegate progress    # 输出完整 progress.md 内容
```

直接读取文件也可以，但 `phasegate status` 会额外做格式校验。
