# Phase 4 中文说明（轻量最终评审 Gate）

当前运行时使用英文版 `phase4_code_review.md` 作为实际 prompt。

本文件仅作为中文参考，关键约束如下：

- **主输入**：每个模块的 self-review bundle（report.json 扩展字段）
- 辅助输入：done 模块的 task books、contracts、Phase 3 摘要
- 不要写 `.phasegate/progress.md`
- 输出 JSON verdict block（`accepted` / `conditional_pass` / `rejected`）
- 若 review bundle 缺失或不完整，直接 `rejected`
- **修复范围限制**：只能修改 Phase 3 已创建或修改的文件；不得引入新模块或新文件；若 P0 问题需要更大范围修改，以 escalation 形式上报
