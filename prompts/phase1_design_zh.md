# Phase 1 中文说明

当前运行时使用英文版 `phase1_design.md` 作为实际 prompt。

本文件仅作为中文参考，关键约束如下：

- 只为当前 `activeRequirement` 生成任务书与契约
- 不要读写 `.phasegate/progress.md`
- 运行时状态以 `.phasegate/progress.json` 为准
- 阶段摘要由 CLI 写入 `scratchpad/summaries/`
