# 评审与验收

- Type: guide
- Status: active
- Reader: both

## Phase 4 轻量最终评审门控

Phase 4 是**轻量最终门控**，而非逐行代码审查。它以 Phase 3 各模块工作者产出的**自审束包**（review bundle）作为主要输入。

主要输入（优先级顺序）：

1. `.phasegate/scratchpad/{module}/report.json` — 各模块自审束包（首要输入）
2. `.phasegate/tasks/*.md`（仅已完成的模块）— 对照验收标准核查
3. `.phasegate/scratchpad/summaries/phase-3-summary.md` — Phase 3 整体执行结果
4. `.phasegate/contracts/*.md` — 公共接口变更时参考
5. `.phasegate/progress.json`

门控行为：

- AI 输出一个结构化 `VerdictRecord` JSON 块：`accepted` / `conditional_pass` / `rejected`
- `accepted` 或 `conditional_pass` → 门控通过，裁决记录到 `progress.json`，推进到 Phase 5
- `rejected` → 执行停止，显示 P0 阻塞项
- 若输出中无 JSON 块，回退到遗留 PASS/FAIL 关键字检测
- 运行时将 `phase-4-summary.md` 持久化到 `scratchpad/summaries/`

### Phase 3 自审束包字段

各模块工作者在 Phase 3 完成后需在 `report.json` 中提供以下字段：

- `implementationSummary` — 实现内容的 2-3 句描述
- `changedFiles` — 改动的文件列表（含测试文件）
- `testsRun` / `testSummary` — 运行的测试命令及结果摘要
- `selfReviewFindings` — 非阻塞性发现列表
- `knownRisks` — 已知风险列表
- `publicSurfaceChanged` — 是否修改了公共接口
- `recommendedReviewScope` — 建议 Phase 4 重点检查的范围

束包缺失或字段不完整时，Phase 4 将以"review bundle 不完整"为由输出 `rejected` 裁决。

## Phase 5 验收

Phase 5 验证活跃需求的验收标准，并生成 `acceptance-guide.md`。

主要输入：

- 活跃需求文件
- `progress.json`
- 工作者报告
- `scratchpad/summaries/` 下的阶段摘要

## 注意事项

- 当前模型中没有 `progress.md` 评审门控。
- 即使自动化检查通过，评审和验收仍然需要人工判断。

## 相关

- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
- [progress-model.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/progress-model.md)
