# M2 — Progress Manager Refactoring

- Module: M2
- Stage: 1（数据模型与兼容层）
- Status: draft
- Depends on: M1
- Blocks: M3

## Objective

将 `ProgressManager` 从"进度记录读写器"升级为：

1. 能够写入和读取 `PhaseStateEntry[]`（状态机基础）
2. 能够对旧 workspace（`currentPhase: 2`）自动迁移
3. 抽取 `normalizeProgress` 使其可以处理 M1 新增字段
4. 新增工具方法 `recordPhaseVerdict` 和 `getPhaseState`

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/core/progress-manager.ts` | 主要修改 |
| `src/core/phase-runtime.ts` | 可能新增 `isActivePhase` 辅助函数 |

---

## Detailed Changes

### 1. normalizeProgress 扩展

**现状：** `normalizeProgress` 对 `currentPhase` 的处理：

```typescript
currentPhase:
  typeof candidate.currentPhase === 'number' &&
  candidate.currentPhase >= 0 &&
  candidate.currentPhase <= 5
    ? (candidate.currentPhase as PhaseId)
    : 0,
```

**目标：** 增加迁移逻辑，处理旧 workspace 中 `currentPhase: 2` 的情况。

```typescript
// 迁移：Phase 2 已折叠进 Phase 1，旧 workspace 迁移到 Phase 1
// 运行时会重新判断是否需要从 Phase 1 重新推进
function migrateCurrentPhase(raw: unknown): PhaseId {
  if (typeof raw !== 'number') return 0;
  if (raw === 2) {
    // Phase 2 is migrated; reset to Phase 1 so user can re-run Phase 1 → Phase 3
    return 1;
  }
  if (raw >= 0 && raw <= 5) return raw as PhaseId;
  return 0;
}
```

**同时新增：** 对 `phaseStates` 字段的 parse（可选，格式错误时静默忽略）。

**对 `design.reviewPassed` 的处理：**
- 保留字段，语义注释更新为：`"true = Phase 1 embedded design checks completed"`
- 不删除字段（兼容层），M3 中 gate 判断时调整语义

---

### 2. 新增 recordPhaseVerdict 方法

**目标：** Phase 4 / Phase 5 的结构化裁决可以被写入 progress.json。

```typescript
/**
 * 将 VerdictRecord 写入 progress.json 的对应阶段状态。
 * 同时更新 phase4Verdict（阶段专属字段，便于快速读取）。
 */
recordPhaseVerdict(cwd: string, phaseId: 4 | 5, verdict: VerdictRecord): void {
  const progress = this.read(cwd);
  if (phaseId === 4) {
    progress.phase4Verdict = verdict;
  }
  // 同时更新 phaseStates
  const states = progress.phaseStates ?? [];
  const idx = states.findIndex(s => s.phaseId === phaseId);
  const entry: PhaseStateEntry = {
    phaseId,
    state: verdict.verdict === 'rejected' ? 'gate_failed' : 'gate_passed',
    enteredAt: new Date().toISOString(),
    verdict,
  };
  if (idx >= 0) states[idx] = entry;
  else states.push(entry);
  progress.phaseStates = states;
  this.write(cwd, progress);
}
```

---

### 3. 新增 getPhaseState 方法

```typescript
/**
 * 读取指定 phase 的状态机状态。
 * 如果 phaseStates 不存在或没有该 phase 记录，返回 undefined。
 */
getPhaseState(cwd: string, phaseId: PhaseId): PhaseStateEntry | undefined {
  const progress = this.read(cwd);
  return progress.phaseStates?.find(s => s.phaseId === phaseId);
}
```

---

### 4. markPhaseMigrated 方法（兼容层）

当检测到旧 workspace 的 `currentPhase` 被从 `2` 迁移到 `1` 时，写入一条 migration 记录：

```typescript
private maybeRecordPhase2Migration(progress: ProjectProgress): void {
  const hasRecord = progress.phaseStates?.some(s => s.phaseId === 2);
  if (hasRecord) return;
  const states = progress.phaseStates ?? [];
  states.push({
    phaseId: 2,
    state: 'migrated',
    enteredAt: new Date().toISOString(),
  });
  progress.phaseStates = states;
}
```

在 `normalizeProgress` 调用后，如果发现原始 `currentPhase` 为 `2` 则调用此方法。

---

### 5. ProjectProgress 新字段接入

需要在 `ProgressManager.write` 的序列化和 `normalizeProgress` 的反序列化中处理：

- `phase4Verdict?: VerdictRecord`
- `phaseStates?: PhaseStateEntry[]`

---

## Acceptance Criteria

- [ ] 旧 workspace JSON（`currentPhase: 2`）被 `pm.read()` 读取后，`progress.currentPhase` 变为 `1`
- [ ] 被迁移的 workspace 中，`phaseStates` 包含 `{ phaseId: 2, state: 'migrated' }` 记录
- [ ] `phase4Verdict` 字段可正确写入并读取
- [ ] `normalizeProgress` 对所有新字段使用防御性 parse，不会在字段缺失时 throw
- [ ] `npm run build` 无错误

---

## Test Coverage Required

- `src/core/__tests__/progress-manager.test.ts`（新增或修改）：
  - 旧 workspace `currentPhase: 2` 被正确迁移
  - `recordPhaseVerdict` 写入后可被 `getPhaseState` 读取
  - 旧 progress.json（无 `phaseStates` 字段）不会导致 read 报错
