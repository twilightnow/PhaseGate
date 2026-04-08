# Phase 1 中文说明（嵌入设计自检）

当前运行时使用英文版 `phase1_design.md` 作为实际 prompt。

本文件仅作为中文参考，关键约束如下：

- 只为当前 `activeRequirement` 生成任务书与契约
- 不要读写 `.phasegate/progress.md`
- 运行时状态以 `.phasegate/progress.json` 为准
- 阶段摘要由 CLI 写入 `scratchpad/summaries/`
- **嵌入设计自检**：生成 task books 和 contracts 后，必须执行设计自检，包括：
  - 责任唯一性、范围外声明、依赖契约对齐、需求覆盖、循环依赖检查
  - 发现严重问题时必须修复再提交摘要
- 文件末附上设计风险摘要（Review Focus / Known Design Risks / Execution Wave Hints）
