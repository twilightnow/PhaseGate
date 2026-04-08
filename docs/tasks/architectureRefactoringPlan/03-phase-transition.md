# M3 — Phase Transition Manager Refactoring

- Module: M3
- Stage: 1（数据模型与兼容层）
- Status: draft
- Depends on: M1, M2
- Blocks: M4

## Objective

1. 将默认推进路径从 `1→2→3→4→5` 改为 `1→3→4→5`
2. Phase 2 的 `resolve` 方法改为返回兼容提示而非推进到 Phase 3
3. Phase 4 的 gate 判断优先消费 `VerdictRecord`，保留文件检查作为 fallback
4. 使用 `ACTIVE_PHASE_SEQUENCE` 常量驱动 next phase 计算
5. 写入 `PhaseStateEntry` 到 progress.json

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/core/phase-transition-manager.ts` | 主要修改 |
| `src/core/phase-runtime.ts` | 可能新增辅助函数 |

---

## Detailed Changes

### 1. 使用 ACTIVE_PHASE_SEQUENCE 计算 nextPhase

**现状：** 各 `resolvePhaseX` 方法硬编码 `nextPhase: 2` / `nextPhase: 3` 等。

**目标：** 统一使用常量驱动：

```typescript
import { ACTIVE_PHASE_SEQUENCE } from '../types';

function getNextActivePhase(current: ActivePhaseId): ActivePhaseId | null {
  const idx = ACTIVE_PHASE_SEQUENCE.indexOf(current);
  if (idx < 0 || idx >= ACTIVE_PHASE_SEQUENCE.length - 1) return null;
  return ACTIVE_PHASE_SEQUENCE[idx + 1];
}
```

---

### 2. resolvePhase1 修改

**现状：** `resolvePhase1` 返回 `nextPhase: 2`。

**目标：** 改为 `nextPhase: 3`。

```typescript
private async resolvePhase1(cwd: string): Promise<PhaseTransitionResult> {
  await this.syncPhase1Outputs(cwd);
  
  // Mark design.reviewPassed = true to indicate Phase 1 embedded checks completed
  const progress = this.pm.read(cwd);
  progress.design.reviewPassed = true;  // new semantic: "Phase 1 embedded design checks done"
  progress.currentPhase = 3;
  this.pm.write(cwd, progress);

  return {
    phase: 1,
    nextPhase: 3,
    shouldContinue: true,
    stopReason: 'terminal',
    message: 'OK Phase 1 complete. Advancing to Phase 3 (Parallel Module Development).',
  };
}
```

---

### 3. resolvePhase2 — 改为 migrated no-op

**现状：**

```typescript
private async resolvePhase2(cwd: string): Promise<PhaseTransitionResult> {
  const passed = await this.checkPhase2Gate(cwd);
  // ... gate check and advance to 3 ...
}
```

**目标：** Phase 2 不再参与主流程，执行时返回 migration 提示并将当前阶段设为 3。

```typescript
private async resolvePhase2(cwd: string): Promise<PhaseTransitionResult> {
  // Phase 2 has been folded into Phase 1.
  // The design self-check constraints are now embedded in the Phase 1 prompt.
  // This phase is treated as a no-op for forward compatibility.
  const progress = this.pm.read(cwd);
  progress.currentPhase = 3;
  this.pm.write(cwd, progress);

  return {
    phase: 2,
    nextPhase: 3,
    shouldContinue: true,
    stopReason: 'terminal',
    message:
      '! Phase 2 (Design Review) has been folded into Phase 1. ' +
      'Design self-check constraints are now embedded in Phase 1. ' +
      'Advancing to Phase 3.',
  };
}
```

**注意：** `resolvePhase2` 仍然保留（不删除），供 legacy workspace 兼容处理。

---

### 4. resolvePhase4 — 优先消费 VerdictRecord

**现状：**
```typescript
private async resolvePhase4WithResult(cwd: string, output?: string): Promise<PhaseTransitionResult>
```

**目标：** 优先消费 `VerdictRecord`；若无结构化结果，回退到现有 artifact 检查。

```typescript
private async resolvePhase4WithResult(
  cwd: string,
  output?: string
): Promise<PhaseTransitionResult> {
  // Try to parse VerdictRecord from AI output first
  const verdict = output ? tryParseVerdict(output) : null;

  if (verdict) {
    // Record the verdict in progress.json
    this.pm.recordPhaseVerdict(cwd, 4, verdict);

    if (verdict.verdict === 'rejected') {
      return {
        phase: 4,
        nextPhase: null,
        shouldContinue: false,
        stopReason: 'gate_failed',
        message: `! Phase 4 gate rejected. P0 findings: ${
          verdict.findings.filter(f => f.level === 'P0').map(f => f.description).join('; ')
        }`,
      };
    }

    const progress = this.pm.read(cwd);
    progress.codeReviewPassed = true;
    progress.currentPhase = 5;
    this.pm.write(cwd, progress);

    return {
      phase: 4,
      nextPhase: 5,
      shouldContinue: true,
      stopReason: 'terminal',
      message: `OK Phase 4 lightweight review passed (verdict: ${verdict.verdict}). Advancing to Phase 5.`,
      verdict,
    };
  }

  // Fallback: legacy artifact-based gate check
  return this.resolvePhase4Legacy(cwd, output);
}
```

**`tryParseVerdict` 工具函数（替换 `phase-transition-manager.ts` 中的 `getPhase4Verdict`）：**

> **重要（来自 self-review F2）**：`phase-transition-manager.ts` 中已有 `getPhase4Verdict` 函数，做简单的 PASS/FAIL 关键字匹配。`tryParseVerdict` **替换**该函数，不是并列追加。`resolvePhase4WithResult` 中 `getPhase4Verdict(output)` 的调用改为 `tryParseVerdict(output)`。

```typescript
/**
 * 尝试从 AI 输出文本中提取结构化 VerdictRecord。
 * 查找 JSON code block：```json { "verdict": "...", "findings": [...] } ```
 * 如果解析失败，返回 null（回退到 legacy artifact 检查）。
 *
 * 替换原来的 getPhase4Verdict (PASS/FAIL keyword matching)，提供结构化判断能力。
 */
export function tryParseVerdict(output: string): VerdictRecord | null {
  const match = output.match(/```json\s*([\s\S]*?)\s*```/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]);
    if (
      typeof raw.verdict === 'string' &&
      ['accepted', 'conditional_pass', 'rejected'].includes(raw.verdict) &&
      Array.isArray(raw.findings)
    ) {
      return raw as VerdictRecord;
    }
  } catch {
    // parse failed, return null
  }
  return null;
}
```

---

### 5. resolvePhase3 — 写入 PhaseStateEntry

在现有 Phase 3 成功路径中，增加状态机记录：

```typescript
// After progress.currentPhase = 4, before write:
const states = progress.phaseStates ?? [];
states.push({ phaseId: 3, state: 'gate_passed', enteredAt: new Date().toISOString() });
progress.phaseStates = states;
```

---

### 6. PhaseTransitionResult 类型扩展

在 `phase-runtime.ts` 中：

```typescript
export interface PhaseTransitionResult {
  phase: ExecutablePhaseId;
  nextPhase: ExecutablePhaseId | null;
  shouldContinue: boolean;
  stopReason: PhaseStopReason;
  message: string;
  verdict?: VerdictRecord;   // 新增，仅 Phase 4/5 填充
}
```

---

## Acceptance Criteria

- [ ] 新建项目执行 `phasegate run` 推进路径为 `0→1→3→4→5`（不停在 Phase 2）
- [ ] 旧 workspace `currentPhase: 2` 的项目中 `phasegate run` 输出迁移提示并推进到 Phase 3
- [ ] Phase 4 resolve 逻辑在 output 包含 JSON verdict block 时，能正确记录 VerdictRecord
- [ ] Phase 4 resolve 逻辑在 output 不含 verdict 时，回退到 legacy artifact 检查（不 crash）
- [ ] `design.reviewPassed` 字段在 Phase 1 完成时被设为 true（语义：设计自检已完成）

---

## Test Coverage Required

- `src/core/__tests__/phase-transition-manager.test.ts`：
  - Phase 1 resolve 返回 `nextPhase: 3`
  - Phase 2 resolve 返回 migration 消息并推进到 Phase 3
  - Phase 4 resolve with VerdictRecord（accepted → gate passed）
  - Phase 4 resolve with VerdictRecord（rejected → gate failed）
  - Phase 4 resolve without verdict（回退到 legacy check）
  - 旧 workspace `currentPhase: 2` 的 end-to-end run 不崩溃
