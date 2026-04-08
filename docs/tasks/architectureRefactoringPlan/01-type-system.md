# M1 — Type System Refactoring

- Module: M1
- Stage: 1（数据模型与兼容层）
- Status: draft
- Depends on: 无
- Blocks: M2, M3, M4, M5

## Objective

为整个重构提供正确的类型基础：

1. 将 `PhaseId` 扩展为兼容两种视角（外部编号不变 / 内部 Phase 2 变为 no-op）
2. 引入结构化 `VerdictRecord`，让 gate 判断可被机器消费
3. 扩展 `WorkerReport` 为 `WorkerReviewBundle`，承载 Phase 3 自审信息
4. 引入显式状态机类型 `PhaseExecutionState`

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/types.ts` | 主要修改 |
| `src/core/phase-runtime.ts` | 补充新类型或引用调整 |

---

## Detailed Changes

### 1. PhaseId 与 ExecutablePhaseId

**现状：**
```typescript
export type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;
// phase-runtime.ts
export type ExecutablePhaseId = Exclude<PhaseId, 0>;  // 1 | 2 | 3 | 4 | 5
```

**目标：**

保留 `PhaseId` 数字范围不变——旧 progress.json 仍可读取。

增加一个用于执行路由的内部类型：

```typescript
/**
 * Phases that can be actively executed in the run loop.
 * Phase 2 is retained as a type value but treated as no-op / migrated in runtime.
 */
export type ExecutablePhaseId = 1 | 2 | 3 | 4 | 5;

/**
 * Phases in the default auto-advance path (Phase 2 excluded).
 * Used by PhaseTransitionManager to determine next phase.
 */
export type ActivePhaseId = 1 | 3 | 4 | 5;
```

**新增常量：**

```typescript
/** Ordered list of phases in the default auto-advance path. */
export const ACTIVE_PHASE_SEQUENCE: ReadonlyArray<ActivePhaseId> = [1, 3, 4, 5];
```

**验收：**
- `phase-transition-manager.ts` 中决定 nextPhase 的地方改用 `ACTIVE_PHASE_SEQUENCE`
- 所有 switch/case 对 Phase 2 的处理不删除，只标注 `// Phase 2: no-op / migrated`

---

### 2. VerdictRecord（结构化裁决）

**目标：** 让 review / acceptance 输出可被 gate 逻辑消费，而不只是自然语言段落。

新增类型：

```typescript
export type VerdictLevel = 'accepted' | 'conditional_pass' | 'rejected';

export interface VerdictFinding {
  level: 'P0' | 'P1' | 'P2';
  description: string;
  relatedModule?: string;
  resolved: boolean;
}

export interface VerdictRecord {
  verdict: VerdictLevel;
  reviewedBy: 'phase4' | 'phase5' | 'manual';
  timestamp?: string;
  findings: VerdictFinding[];
  residualRisks: string[];
  confidenceLevel?: 'high' | 'medium' | 'low';
}
```

**使用位置：**
- `ProjectProgress` 新增可选字段 `phase4Verdict?: VerdictRecord`
- `PhaseTransitionResult` 增加可选字段 `verdict?: VerdictRecord`
- Phase 4 gate 逻辑优先消费 `phase4Verdict`，保留现有文件检查作为 fallback

**兼容性：**
- `phase4Verdict` 字段可选，旧 progress.json 不含此字段时 gate 退回到原有文件检查逻辑
- normalizeProgress 需要增加对此字段的 parse 逻辑

---

### 3. WorkerReport → WorkerReviewBundle 扩展

**现状：**
```typescript
export interface WorkerReport {
  scope: string;
  result: 'done' | 'failed';
  keyFiles: string[];
  filesChanged: string[];
  issues: string[];
}
```

**目标：** 保持向后兼容的前提下，扩展必填 / 可选字段。

```typescript
export interface WorkerReport {
  scope: string;
  result: 'done' | 'failed';
  keyFiles: string[];
  filesChanged: string[];         // 保留原字段（ = changedFiles 别名）
  issues: string[];               // 保留原字段（ = selfReviewFindings 别名）

  // Phase 3 review bundle 扩展字段（渐进必填，初期可选）
  implementationSummary?: string; // 简短文字描述本次实现
  changedFiles?: string[];        // 替代 filesChanged 的规范字段名
  testsRun?: string[];            // 执行的测试命令列表
  testSummary?: string;           // 测试结果一行摘要
  selfReviewFindings?: string[];  // 实现者自审发现（替代 issues）
  knownRisks?: string[];          // 已知风险点
  publicSurfaceChanged?: boolean; // public API / schema 是否有变动
  recommendedReviewScope?: string[]; // 建议 Phase 4 重点审查的范围
}
```

**使用位置：**
- `src/core/orchestrator.ts` 的 `ModuleRunResult.report` 使用扩展后字段
- `src/core/phase-artifact-builder.ts` 的 Phase 4 Summary 生成时优先读取新字段

**迁移策略：**
- 首期所有新字段均可选，不破坏已有 worker report JSON
- Stage 3（Prompt 重构）后，Phase 3 worker prompt 明确要求输出这些字段
- Stage 4 可视情况将 `implementationSummary` / `changedFiles` / `selfReviewFindings` / `knownRisks` 改为必填

---

### 4. PhaseExecutionState（显式状态机）

**目标：** 让 progress.json 从"进度记录"升级为"可恢复状态机"的基础。

```typescript
export type PhaseExecutionState =
  | 'idle'              // 未开始执行
  | 'running'           // 正在执行
  | 'awaiting_gate'     // 执行完毕，等待 gate 判断
  | 'gate_passed'       // gate 通过，可推进
  | 'gate_failed'       // gate 未通过，需重试或修复
  | 'terminal'          // 该阶段已终结（Phase 5 accepted）
  | 'migrated';         // 该阶段已迁移（Phase 2 folded）

export interface PhaseStateEntry {
  phaseId: PhaseId;
  state: PhaseExecutionState;
  enteredAt?: string;       // ISO timestamp
  verdict?: VerdictRecord;
  failureReason?: string;
}
```

**在 ProjectProgress 中的位置：**
```typescript
export interface ProjectProgress {
  // ... 现有字段 ...
  phaseStates?: PhaseStateEntry[];   // 可选，逐步迁移
}
```

**初期仅写入，不作为主路径判断依据**（确保兼容性），M2 中实现完整状态机读写。

---

## Acceptance Criteria

- [ ] `npm run build` 无类型错误
- [ ] `WorkerReport` 新字段均为可选，现有 report JSON 仍可 parse
- [ ] `VerdictRecord` 可通过 normalizeProgress 反序列化
- [ ] 测试文件可正常编译（修改涉及的 import / fixture 类型）
- [ ] `ACTIVE_PHASE_SEQUENCE` 常量已导出并在 `phase-transition-manager.ts` 中使用

---

## Implementation Notes

- 优先改 `src/types.ts`，其他文件跟随改
- 不要在本 module 内改运行时逻辑，只改类型定义和常量
- 如需新增 runtime 辅助函数（如 `isActivePhase(id)`），放在 `src/core/phase-runtime.ts`
