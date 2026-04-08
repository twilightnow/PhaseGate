# M4 — Phase Executor Refactoring

- Module: M4
- Stage: 2（执行层重构）
- Status: draft
- Depends on: M1, M2, M3
- Blocks: M6

## Objective

1. Phase 2 在 `PhaseExecutor.execute` 中改为输出提示并跳过实际 AI 调用
2. Phase 4 的 context loading 从"全量 contracts"改为"最小必要 review bundle"
3. `PHASE_META` 更新以反映新架构
4. `buildPhaseContextFiles` 各 phase 输入显著收缩

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/core/phase-executor.ts` | 主要修改 |
| `src/core/phase-artifact-builder.ts` | 增加 review bundle 读取方法 |

---

## Detailed Changes

### 1. PHASE_META 更新

**现状：**

```typescript
const PHASE_META: Record<number, { title: string; promptFile: string }> = {
  1: { title: 'Design Generation', promptFile: 'phase1_design.md' },
  2: { title: 'Design Review', promptFile: 'phase2_review.md' },
  4: { title: 'Code Review', promptFile: 'phase4_code_review.md' },
  5: { title: 'Acceptance', promptFile: 'phase5_acceptance.md' },
};
```

**目标：**

```typescript
const PHASE_META: Record<number, { title: string; promptFile: string; deprecated?: boolean }> = {
  1: { title: 'Design Generation (with embedded self-check)', promptFile: 'phase1_design.md' },
  2: {
    title: 'Design Review',
    promptFile: 'phase2_review.md',
    deprecated: true,  // Phase 2 folded into Phase 1
  },
  4: { title: 'Lightweight Final Review', promptFile: 'phase4_code_review.md' },
  5: { title: 'Acceptance', promptFile: 'phase5_acceptance.md' },
};
```

---

### 2. Phase 2 skip — 正确实现位置（run.ts，非 prepare）

**重要说明（来自 self-review F1）：**

`run.ts` 对非 Phase-3 的执行路径是：`executor.prepare()` → `runSinglePhase()`。  
如果只在 `prepare` 中返回 no-op PreparedPhase，`runSinglePhase` 仍会尝试调用 AI。

**因此，Phase 2 的 skip 逻辑必须在 `run.ts` 的 action handler 中实现，不能只靠 `prepare`。**

`run.ts` 的 while 循环内改为：

```typescript
if (phase === 2) {
  // Phase 2 has been folded into Phase 1 — skip AI execution entirely
  console.log(
    chalk.yellow('! Phase 2 (Design Review) has been folded into Phase 1.') + '\n' +
    '  Design self-check constraints are now embedded in the Phase 1 prompt.\n' +
    '  Skipping Phase 2 AI execution. Advancing to Phase 3.'
  );
  executionResult = { phase: 2 as ExecutablePhaseId, output: 'phase2_migrated' };
} else if (phase === 3) {
  executionResult = await executor.execute(cwd, 3);
} else {
  const prepared = await executor.prepare(cwd, phase as Exclude<ExecutablePhaseId, 2 | 3>);
  const output = await runSinglePhase(prepared.runner, prepared.contextFiles, prepared.prompt, phase, prepared.title);
  executionResult = { phase, output };
}
```

同时，`PhaseExecutor.execute` 中保留 Phase 2 safety net（供直接调用路径）：

```typescript
async execute(cwd: string, phase: ExecutablePhaseId): Promise<PhaseExecutionResult> {
  if (phase === 2) {
    // Safety net for direct calls (not the main run.ts path)
    return { phase: 2, output: 'phase2_migrated' };
  }
  if (phase === 3) {
    const results = await this.runPhase3(cwd);
    return { phase, phase3Results: results };
  }
  await this.runPromptPhase(cwd, phase as Exclude<ExecutablePhaseId, 2 | 3>);
  return { phase };
}
```

`runPromptPhase` は现状の `void` 戻り値を変更しない（主流程は `run.ts` 経由のため）。

---

### 3. buildPhaseContextFiles — Phase 4 フィルタリング改善

**重要な現状確認（self-review F3）：**

既存の `buildPhaseContextFiles` Phase 4 case は既に以下を注入している：
- `progress.json`
- 全 task books
- 全 contracts
- requirement files
- `scratchpad/summaries/` の全 markdown
- `listWorkerReportFiles()` 経由の worker report.json files

Worker reports の追加は**不要**（既に実装済み）。  
**主な改善点はフィルタリング**：全量→ done modules のみ。

改善内容：

1. **task books のフィルタリング（全量 → done modules のみ）**

```typescript
case 4: {
  files.push(path.join(pg, 'progress.json'));
  // Filter: only task books for done modules (not all modules)
  files.push(...(await this.listDoneModuleTaskBooks(cwd)));
  // Filter: only contracts relevant to done modules
  files.push(...(await this.listRelevantContracts(cwd)));
  files.push(...activeRequirementFiles);
  if (await fse.pathExists(summaryDir)) {
    files.push(...(await listMarkdownFiles(summaryDir)));
  }
  files.push(...(await this.listWorkerReportFiles(path.join(pg, 'scratchpad'))));
  break;
}
```

2. **`listDoneModuleTaskBooks` 新增 private 方法：**

```typescript
private async listDoneModuleTaskBooks(cwd: string): Promise<string[]> {
  const progress = this.progressManager.read(cwd);
  const doneModules = progress.modules.filter(m => m.status === 'done').map(m => m.name);
  const tasksDir = path.join(cwd, '.phasegate', 'tasks');
  const files: string[] = [];
  for (const name of doneModules) {
    const f = path.join(tasksDir, `${name}.md`);
    if (await fse.pathExists(f)) files.push(f);
  }
  // Fallback: if no done modules found, include all task books
  if (files.length === 0) return listMarkdownFiles(tasksDir);
  return files;
}
```

3. **`listRelevantContracts` 新增 private 方法（optional 改进，可延后）：**

初期は全量 contracts を維持しても問題ない。契约フィルタリングは Stage 2 完了後に検証結果を見て判断する。

**今すぐ必須の変更：** task books のフィルタリングのみ。contracts は引き続き全量注入でよい。

---

### 4. buildPhaseContextFiles — Phase 1 context 确认

Phase 1 的 context 应包含：

- active requirement file（需求文档）
- architecture-constraints.md
- 现有 contracts（如已存在）

检查现有 `buildPhaseContextFiles` 实现，若 Phase 1 已包含这些，则无需改动；若未包含 requirement file，则补入。

---

### 5. prepare 方法 — Phase 2 处理

`prepare` 方法目前只处理 `Exclude<ExecutablePhaseId, 3>`，Phase 2 仍会走 prepare 路径。

调整：

```typescript
async prepare(cwd: string, phase: Exclude<ExecutablePhaseId, 3>): Promise<PreparedPhase> {
  if (phase === 2) {
    // Phase 2 is migrated, return a no-op PreparedPhase
    return {
      runner: await createRunner(cwd, 'default'),
      contextFiles: [],
      prompt: '<!-- Phase 2 migrated into Phase 1 -->',
      title: 'Design Review (migrated)',
    };
  }
  // ... 原有逻辑 ...
}
```

---

## Acceptance Criteria

- [ ] `phasegate run --phase 2` 输出 migration 提示，不调用 AI，不报错
- [ ] `phasegate run`（新项目）在 Phase 1 完成后直接进入 Phase 3，不停在 Phase 2
- [ ] Phase 4 context 中包含 worker report files（已有实现，确认未破坏）
- [ ] Phase 4 context 的 task books 范围收窄为 done modules（新改动）
- [ ] Phase 4 runner.run 返回的 output 字符串经 `run.ts` 正确传递到 PhaseTransitionManager（现有机制，确认未破坏）
- [ ] `npm run build` 无错误

---

## Implementation Notes

- 本 module 的改动会影响已有测试中对 `PhaseExecutor.execute` 的期望——需同步更新 M8 测试
- `runPromptPhase` 改为返回 `string` 后，调用链需要全部跟进
- Phase 4 context loading 新增的辅助方法可放在 `PhaseExecutor` 的 private section 或新建 `PhaseContextBuilder` 工具类（推荐放 private section，避免过早抽象）
