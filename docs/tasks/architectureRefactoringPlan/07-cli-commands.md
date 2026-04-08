# M7 — CLI Commands Update

- Module: M7
- Stage: 4（CLI、测试、文档收尾）
- Status: draft
- Depends on: M3, M4
- Blocks: 无（最终用户面改动）

## Objective

1. `phasegate run` 命令：更新状态提示、阶段说明文字
2. `phasegate run --phase 2`：返回明确迁移提示而非静默忽略
3. `phasegate review <module>`：语义更新为 "lightweight review"
4. `phasegate status`：状态输出反映新的 phase 说明文字
5. 确保所有 CLI 面向用户的文案与新架构一致

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/commands/run.ts` | 中等修改（phase 验证 + 文案） |
| `src/commands/review.ts` | 小改（文案更新） |
| `src/commands/status.ts` | 小改（phase 文案对齐） |

---

## Detailed Changes

### 1. run.ts — Phase 2 完全 skip（核心修改）

**现状：** `--phase 2` 会走 `executor.prepare(cwd, 2)` → `runSinglePhase(...)` 路径，会调用 AI。

**目标（来自 self-review F1）：** Phase 2 must short-circuit BEFORE `prepare` is called.

在 `run.ts` action handler 的 while 循环中，将原来的 if/else 改为三分支：

```typescript
let executionResult: { phase: ExecutablePhaseId; output?: string; phase3Results?: ModuleRunResult[] };

if (phase === 2) {
  // Phase 2 has been folded into Phase 1 — skip AI entirely
  console.log(
    chalk.yellow('!') + ' Phase 2 (Design Review) has been folded into Phase 1.\n' +
    '  Design self-check constraints are now embedded in the Phase 1 prompt.\n' +
    '  Skipping Phase 2 AI execution. Transition manager will advance to Phase 3.'
  );
  executionResult = { phase: 2 as ExecutablePhaseId, output: 'phase2_migrated' };
} else if (phase === 3) {
  executionResult = await executor.execute(cwd, 3);
} else {
  console.log(chalk.cyan('->') + ` Running Phase ${phase}...`);
  let prepared;
  try {
    prepared = await executor.prepare(cwd, phase as Exclude<ExecutablePhaseId, 2 | 3>);
  } catch (err) {
    console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
    process.exit(1);
  }
  const output = await runSinglePhase(prepared.runner, prepared.contextFiles, prepared.prompt, phase, prepared.title);
  executionResult = { phase, output };
}
```

**注意：** これにより `executor.prepare` の型シグネチャも `Exclude<ExecutablePhaseId, 2 | 3>` に変更が必要。

---

### 2. run.ts — phase 推进日志更新

将 Phase 相关的日志文案从旧架构改为新架构表述：

| 旧文案 | 新文案 |
|---|---|
| `Phase 1: Design Generation` | `Phase 1: Design Generation (with embedded self-check)` |
| `Phase 2: Design Review` | `Phase 2: Design Review [migrated → Phase 1]` |
| `Phase 4: Code Review` | `Phase 4: Lightweight Final Review` |

这些文案最终由 `PHASE_META` 驱动（在 M4 中已更新），run.ts 本身不需要硬编码，只需确认使用的是 `meta.title`。

---

### 3. run.ts — 自动推进路径确认

检查 `run.ts` 中调用 `PhaseTransitionManager.resolve` 返回的 `nextPhase` 推进循环逻辑。

确认：

- `nextPhase: 3`（Phase 1 完成后）正确推进到 Phase 3
- 不会因为旧逻辑期待 `nextPhase: 2` 而卡住

具体检查 `run.ts` 中的推进循环：

```typescript
// 检查此处逻辑是否有 phase 2 特殊处理
while (transition.shouldContinue) {
  const next = transition.nextPhase;
  // ...
}
```

若有 phase 2 特殊分支，改为依赖 M3 的 transition manager 输出。

---

### 4. review.ts — 语义更新

`phasegate review <module>` 命令的说明文字和 spinner 文案：

```typescript
// 旧：
cmd.description('Run a code review for a specific module (Phase 4 reviewer scope)');
// 新：
cmd.description('Run a lightweight final review for a specific module (Phase 4 gate scope)');
```

Spinner 文案：

```typescript
// 旧：
`Reviewing module: ${moduleName}...`
// 新：
`Running lightweight final review for: ${moduleName}...`
```

---

### 5. status.ts — Phase 二说明文字

`phasegate status` 输出的 phase 名称列表中，确认 Phase 2 的显示：

```typescript
// 当 currentPhase 或 phaseStates 中 phase 2 为 migrated 时：
if (phaseState?.state === 'migrated') {
  return `Phase 2: Design Review → merged into Phase 1 (no separate execution needed)`;
}
```

---

## Acceptance Criteria

- [ ] `phasegate run --phase 2` 打印 migration 提示，不报错
- [ ] `phasegate run`（新项目）Phase 推进日志不再出现 "Phase 2: Design Review" 作为正常推进步骤
- [ ] `phasegate review <module>` 的 --help 描述更新
- [ ] `phasegate status` 在 Phase 2 处显示 migrated 提示（如果 progress 中有记录）
- [ ] 所有命令 `npm run build` 无错误

---

## Implementation Notes

- run.ts、review.ts、status.ts 是用户可见的表层，改动应保持最小，只改文案和非关键分支
- 不要在这里添加新的 phase 路由逻辑——路由逻辑应在 M3 / M4 中处理完毕
- `--phase 2` 的提示文字不应太长，控制在 3-4 行
