# M8 — Tests Update

- Module: M8
- Stage: 4（CLI、测试、文档收尾）
- Status: draft
- Depends on: M1, M2, M3, M4, M5
- Blocks: 无

## Objective

1. 更新受影响的现有测试，使其与新架构兼容
2. 新增针对关键新行为的测试覆盖
3. 确保兼容性场景有明确测试（旧 workspace 迁移、`--phase 2` 行为）
4. 不追求 100% 覆盖率——聚焦"主流程可运行 + 兼容行为明确"

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/core/__tests__/phase-transition-manager.test.ts` | 大改（核心流程变化）|
| `src/core/__tests__/progress-manager.test.ts` | 中改（新增字段和迁移逻辑）|
| `src/core/__tests__/phase-executor.test.ts` | 中改（Phase 2 no-op 行为）|
| `src/core/__tests__/orchestrator.test.ts` | 小改（normalizeWorkerReport）|
| `scripts/acceptance-phase2.ts` | 重命名或内容更新 |

---

## Detailed Changes

### 1. phase-transition-manager.test.ts — 核心流程更新

**当前 fixture 问题：**
- `currentPhase: 2` 的 setup（现有测试）在新架构下仍需通过，但行为已改变
- 现有的"Phase 2 gate 检查 contracts"测试需要更新为"Phase 2 返回 migration 提示"测试

**需更新的测试：**

```typescript
// 旧期望（需移除）：
// expect(transition.nextPhase).toBe(3); // 因为 Phase 2 gate 通过
// expect(progress.design.reviewPassed).toBe(true);

// 新期望（Phase 2 migration 行为）：
it('Phase 2 resolve returns migration message and advances to Phase 3', async () => {
  const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 2 });
  expect(transition.nextPhase).toBe(3);
  expect(transition.shouldContinue).toBe(true);
  expect(transition.message).toContain('folded into Phase 1');
  const progress = new ProgressManager().read(projectRoot);
  expect(progress.currentPhase).toBe(3);
});
```

**需新增的测试：**

```typescript
// Phase 1 → next is Phase 3 (not Phase 2)
it('Phase 1 resolve sets nextPhase to 3', async () => {
  const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 1 });
  expect(transition.nextPhase).toBe(3);
  expect(transition.shouldContinue).toBe(true);
});

// Phase 4 with VerdictRecord: accepted
it('Phase 4 resolve with accepted verdict gates to Phase 5', async () => {
  const verdictOutput = JSON.stringify({
    verdict: 'accepted',
    reviewedBy: 'phase4',
    timestamp: '2026-04-08T00:00:00Z',
    findings: [],
    residualRisks: [],
    confidenceLevel: 'high',
  });
  const wrappedOutput = '```json\n' + verdictOutput + '\n```';
  const transition = await new PhaseTransitionManager().resolve(projectRoot, {
    phase: 4,
    output: wrappedOutput,
  });
  expect(transition.nextPhase).toBe(5);
  expect(transition.shouldContinue).toBe(true);
  const progress = new ProgressManager().read(projectRoot);
  expect(progress.codeReviewPassed).toBe(true);
  expect(progress.phase4Verdict?.verdict).toBe('accepted');
});

// Phase 4 with VerdictRecord: rejected
it('Phase 4 resolve with rejected verdict stops workflow', async () => {
  const verdictOutput = JSON.stringify({
    verdict: 'rejected',
    reviewedBy: 'phase4',
    timestamp: '2026-04-08T00:00:00Z',
    findings: [{ level: 'P0', description: 'Critical bug', relatedModule: 'demo', resolved: false }],
    residualRisks: [],
    confidenceLevel: 'low',
  });
  const wrappedOutput = '```json\n' + verdictOutput + '\n```';
  const transition = await new PhaseTransitionManager().resolve(projectRoot, {
    phase: 4,
    output: wrappedOutput,
  });
  expect(transition.shouldContinue).toBe(false);
  expect(transition.stopReason).toBe('gate_failed');
});

// Phase 4 without VerdictRecord: fallback to legacy check
it('Phase 4 resolve without verdict falls back gracefully', async () => {
  const transition = await new PhaseTransitionManager().resolve(projectRoot, {
    phase: 4,
    output: 'Code review complete. All issues addressed.',  // no JSON block
  });
  // Should not crash; result depends on legacy gate logic
  expect(transition).toBeDefined();
  expect(typeof transition.shouldContinue).toBe('boolean');
});
```

---

### 2. progress-manager.test.ts — 新字段和迁移逻辑

**需新增的测试：**

```typescript
describe('legacy workspace migration', () => {
  it('migrates currentPhase: 2 to 1', () => {
    const raw = JSON.stringify({ currentPhase: 2, projectName: 'test' });
    fse.writeFileSync(progressPath, raw);
    const progress = pm.read(projectRoot);
    expect(progress.currentPhase).toBe(1);
  });

  it('records migration in phaseStates', () => {
    const raw = JSON.stringify({ currentPhase: 2, projectName: 'test' });
    fse.writeFileSync(progressPath, raw);
    const progress = pm.read(projectRoot);
    const migratedEntry = progress.phaseStates?.find(s => s.phaseId === 2);
    expect(migratedEntry?.state).toBe('migrated');
  });
});

describe('recordPhaseVerdict', () => {
  it('writes and reads verdict for phase 4', () => {
    const verdict: VerdictRecord = {
      verdict: 'accepted',
      reviewedBy: 'phase4',
      findings: [],
      residualRisks: [],
    };
    pm.recordPhaseVerdict(projectRoot, 4, verdict);
    const progress = pm.read(projectRoot);
    expect(progress.phase4Verdict?.verdict).toBe('accepted');
    const state = pm.getPhaseState(projectRoot, 4);
    expect(state?.state).toBe('gate_passed');
  });
});

describe('backward compatibility', () => {
  it('reads progress without phaseStates without error', () => {
    const raw = JSON.stringify({
      projectName: 'old-project',
      currentPhase: 3,
      // no phaseStates field
    });
    fse.writeFileSync(progressPath, raw);
    expect(() => pm.read(projectRoot)).not.toThrow();
    const progress = pm.read(projectRoot);
    expect(progress.phaseStates).toBeUndefined();
  });
});
```

---

### 3. phase-executor.test.ts — Phase 2 no-op 行为

```typescript
it('Phase 2 execute returns without calling AI runner', async () => {
  const mockRunner = { run: jest.fn(), fork: jest.fn(), chat: jest.fn(), capabilities: jest.fn() };
  // ... setup mock
  const executor = new PhaseExecutor();
  const result = await executor.execute(projectRoot, 2);
  expect(result.phase).toBe(2);
  expect(result.output).toBe('phase2_migrated');
  // Runner.run should NOT have been called for Phase 2
  expect(mockRunner.run).not.toHaveBeenCalled();
});
```

---

### 4. acceptance-phase2.ts — 重命名或更新

**现状：** `scripts/acceptance-phase2.ts` 针对旧 Phase 2 逻辑编写。

**目标：** 评估此脚本的当前断言是否仍然有效：

- 如果脚本测试"Phase 2 能推进到 Phase 3 after gate"，则需要更新断言为"Phase 2 migration message + advance to 3"
- 如果脚本命名已语义过时，可改名为 `acceptance-phase-transition.ts`

**建议：**
- 改名为 `acceptance-migration-compat.ts`
- 核心测试：旧 Phase 2 workspace 在新代码下能正确迁移并推进

---

## Test Fixture Updates

现有 fixture 中 `currentPhase: 2` 的 progress 对象：

- 保留作为"legacy workspace"测试 fixture
- 新增 `currentPhase: 1` 的"new project"fixture，用于验证主流程

---

## Acceptance Criteria

- [ ] `npm test` 全部通过（或失败原因明确属于新行为，而非 regression）
- [ ] Phase 1 → Phase 3 推进的 transition test 通过
- [ ] Phase 2 migration 行为有专属测试
- [ ] Phase 4 VerdictRecord gate 有 accepted / rejected / fallback 三个场景测试
- [ ] 旧 workspace migration 有测试覆盖
- [ ] 所有测试可在 CI 无网络环境下运行（mock AI runner）

---

## Notes

- 不要在测试文件中直接调用 AI runner——全部使用 mock/stub
- 测试文件名不变（除 acceptance 脚本需重命名外），只修改内容
- Phase 3 Orchestrator 测试不需要大改，只需验证 `normalizeWorkerReport` 对新字段的处理
