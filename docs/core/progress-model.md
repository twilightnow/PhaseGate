# PhaseGate 进度模型

- Type: core
- Status: active
- Reader: both
- Use when: 需要了解持久化执行状态时
- Source of truth: 当前实现

## 目的

PhaseGate 将需求积累与活跃执行分开。
待办列表保存在 `.phasegate/requirements/` 中。
执行状态仅保存在 `.phasegate/progress.json` 中。

## 权威状态

`progress.json` 是唯一的权威状态文件。
`progress.md` 是每次写入时自动同步生成的可读快照，仅供人工浏览，不作为执行依据。

关键字段：

```json
{
  "projectName": "demo",
  "locale": "en",
  "currentPhase": 1,
  "activeRequirement": null,
  "requirements": [],
  "design": {
    "modules": [],
    "contracts": [],
    "reviewPassed": false
  },
  "modules": [],
  "codeReviewPassed": false,
  "blockers": [],
  "phase4Verdict": null,
  "phaseStates": []
}
```

## 语义说明

- `activeRequirement`
  - 当前绑定到执行的唯一需求。
  - `null` 表示执行处于空闲状态。
- `currentPhase`
  - 活跃需求的执行本地阶段。
  - `0` 表示没有活跃执行。
  - 有效的活跃值：`1`、`3`、`4`、`5`。遗留值 `2` 在读取时迁移为 `1`。
- `requirements[]`
  - 从 `.phasegate/requirements/*.md` 发现的待办条目。
  - 状态值：`draft`、`approved`、`selected`、`implemented`、`archived`。
  - `priority`（可选）：`high` / `normal` / `low`，缺省视为 `normal`。
    - 存储在需求文件 frontmatter（`priority: high`），由 `loop` / `run` 启动时懒同步写入。
    - 变更方式：直接编辑 `.md` 文件；下次 loop/run 启动时自动同步。
  - `approvedAt`（可选）：ISO-8601 时间戳，需求首次变为 `approved` 时写入，重复同步不覆盖。
- `design`
  - Phase 1 输出（任务书、合约）。当嵌入的 Phase 1 自检通过时，`reviewPassed` 被设为 `true`。
- `modules`
  - Phase 3 编排期间使用的运行时模块状态。
- `codeReviewPassed`
  - 遗留的 Phase 4 门控结果标志（布尔值）。已被 `phase4Verdict` 取代。
- `phase4Verdict`
  - Phase 4 门控写入的结构化 `VerdictRecord`。格式：
    ```json
    {
      "verdict": "accepted" | "conditional_pass" | "rejected",
      "reviewedBy": "phase4" | "phase5" | "manual",
      "timestamp": "ISO-8601 (可选)",
      "findings": [{ "level": "P0" | "P1" | "P2", "description": "...", "relatedModule": "...", "resolved": true }],
      "residualRisks": ["carried-forward risks"],
      "confidenceLevel": "high" | "medium" | "low" (可选)
    }
    ```
- `phaseStates[]`
  - 每阶段执行状态条目。格式：`{ phaseId, state, enteredAt, verdict? }`。
  - `enteredAt` 为必填 ISO-8601 时间戳。`verdict` 在阶段门控写入时一并存入。
  - 用于记录迁移事件（例如 `{phaseId: 2, state: 'migrated'}`）和阶段裁决。
- `blockers`
  - 已知的阻塞性运行时问题。

## 生命周期规则

- `phasegate chat` 可以在不启动执行的情况下添加或修改需求文档。
- `phasegate select <requirement>` 将一个已批准的需求标记为活跃。
- `phasegate run` 仅执行已选择的需求。
- 完成 Phase 5 后，将制品归档，将活跃需求标记为 `implemented`，并将执行重置为空闲。

## 相关

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [workspace-layout.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/workspace-layout.md)
- [progress-manager.ts](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/src/core/progress-manager.ts)
