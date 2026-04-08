# M5 — Orchestrator & Worker Report Refactoring

- Module: M5
- Stage: 2（执行层重构）
- Status: draft
- Depends on: M1
- Blocks: M6

## Objective

1. Orchestrator 运行结束后，确保每个 worker 产出符合扩展后 `WorkerReport` 格式的产物
2. `PhaseArtifactBuilder` 的 Phase 4 Summary 生成优先使用新字段
3. 向 worker prompt 注入中提示 review bundle 字段（为 M6 做运行时准备）
4. Worker report JSON 写入路径标准化

---

## Target Files

| 文件 | 改动类型 |
|---|---|
| `src/core/orchestrator.ts` | 中等修改（report 解析 + bundle 字段读取）|
| `src/core/phase-artifact-builder.ts` | 中等修改（Phase 4 Summary 生成优先读新字段）|

---

## Detailed Changes

### 1. Orchestrator — report 解析扩展

**现状：** Orchestrator 在 worker 完成后调用 `runner.fork()`，返回 `WorkerReport`。

**目标：** 解析 WorkerReport 时，对新字段做 graceful fallback：

```typescript
function normalizeWorkerReport(raw: unknown): WorkerReport {
  if (!raw || typeof raw !== 'object') {
    return { scope: '', result: 'failed', keyFiles: [], filesChanged: [], issues: [] };
  }
  const r = raw as Record<string, unknown>;

  return {
    scope: typeof r.scope === 'string' ? r.scope : '',
    result: r.result === 'done' ? 'done' : 'failed',
    keyFiles: Array.isArray(r.keyFiles) ? r.keyFiles.filter(f => typeof f === 'string') : [],
    filesChanged: Array.isArray(r.filesChanged) ? r.filesChanged.filter(f => typeof f === 'string') : [],
    issues: Array.isArray(r.issues) ? r.issues.filter(i => typeof i === 'string') : [],

    // New review bundle fields (all optional)
    implementationSummary: typeof r.implementationSummary === 'string' ? r.implementationSummary : undefined,
    changedFiles: Array.isArray(r.changedFiles) ? r.changedFiles.filter(f => typeof f === 'string') : undefined,
    testsRun: Array.isArray(r.testsRun) ? r.testsRun.filter(t => typeof t === 'string') : undefined,
    testSummary: typeof r.testSummary === 'string' ? r.testSummary : undefined,
    selfReviewFindings: Array.isArray(r.selfReviewFindings) ? r.selfReviewFindings.filter(f => typeof f === 'string') : undefined,
    knownRisks: Array.isArray(r.knownRisks) ? r.knownRisks.filter(r => typeof r === 'string') : undefined,
    publicSurfaceChanged: typeof r.publicSurfaceChanged === 'boolean' ? r.publicSurfaceChanged : undefined,
    recommendedReviewScope: Array.isArray(r.recommendedReviewScope) ? r.recommendedReviewScope.filter(s => typeof s === 'string') : undefined,
  };
}
```

---

### 2. Worker report 写入路径标准化

**现状：** worker report 写入 `.phasegate/scratchpad/{module}/report.json`（基于推断）。

**检查点：** 在 `src/core/orchestrator.ts` 的 `runModule` 方法中确认当前写入路径。

**目标：** 确保路径格式为：
```
.phasegate/scratchpad/{moduleName}/report.json
```

若当前格式不同，统一改为此格式。这是 M4 中 `findWorkerReportFiles` 方法的读取前提。

---

### 3. PhaseArtifactBuilder — Phase 4 Summary 优先使用新字段

**现状：** `appendPhase4Summary` 从 `done` 模块读取 `report.keyFiles` 和 `report.issues`。

**目标：** 新增字段优先，fallback 到旧字段：

```typescript
private buildModuleReviewSummaryLine(name: string, report?: WorkerReport): string {
  // Use new fields first, fall back to legacy fields
  const files = report?.changedFiles ?? report?.keyFiles ?? [];
  const summary = report?.implementationSummary;
  const risks = report?.knownRisks ?? [];
  const testSummary = report?.testSummary;

  const parts: string[] = [`- ${name}: reviewed.`];
  if (summary) parts.push(`Summary: ${summary}.`);
  if (files.length) parts.push(`Changed: ${files.join(', ')}.`);
  if (testSummary) parts.push(`Tests: ${testSummary}.`);
  if (risks.length) parts.push(`Known risks: ${risks.join('; ')}.`);

  return parts.join(' ');
}
```

同时在 Phase 4 Summary 中新增 `## Self-Review Findings` 和 `## Known Risks` 两个 section，聚合所有模块的对应字段。

---

### 4. Orchestrator — coordinator brief 更新提示

Coordinator brief 生成时，注入一条简短说明：

> Each worker must produce a review bundle as part of its output, including: implementationSummary, changedFiles, testsRun/testSummary, selfReviewFindings, and knownRisks. This bundle will be consumed by Phase 4.

这是用于 `generateCoordinatorBrief` 的补充内容，不需要改 coordinator prompt 文件（那是 M6 的职责）——只需在 brief 生成器中追加此段。

```typescript
private buildReviewBundleReminder(): string {
  return [
    '## Worker Review Bundle Requirement',
    '',
    'Each worker must produce a structured review bundle as part of its report JSON.',
    'Required fields: implementationSummary, changedFiles, testsRun (or testSummary), selfReviewFindings, knownRisks.',
    'This bundle is consumed by Phase 4 as the primary review input.',
    '',
  ].join('\n');
}
```

在 `generateCoordinatorBrief` 中将此段追加到 brief 末尾。

---

## Acceptance Criteria

- [ ] Worker report JSON 含新字段时，`normalizeWorkerReport` 正确读取
- [ ] Worker report JSON 不含新字段时，`normalizeWorkerReport` 不 crash，新字段为 `undefined`
- [ ] Phase 4 Summary 包含 `## Self-Review Findings` 和 `## Known Risks` 两个 section（即使内容为空）
- [ ] Coordinator brief 包含 review bundle 要求说明
- [ ] Worker report 写入路径为 `.phasegate/scratchpad/{moduleName}/report.json`

---

## Test Coverage Required

- `src/core/__tests__/orchestrator.test.ts`：
  - `normalizeWorkerReport` 对空/无效输入的防御性处理
  - 新字段正确解析
- `src/core/__tests__/phase-artifact-builder.test.ts`（新增或修改）：
  - Phase 4 Summary 在有 `implementationSummary` 时使用新格式
  - Phase 4 Summary 在无新字段时 fallback 到旧字段
