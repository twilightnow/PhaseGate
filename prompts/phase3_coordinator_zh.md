# Phase 3 Coordinator 中文说明

当前 orchestrator 在代码中构建 coordinator prompt，本文件不是实际运行入口。

参考约束：

- 模块状态写入 `.phasegate/progress.json`
- worker 输出写入 `.phasegate/scratchpad/{module}/report.json`
- 阶段摘要写入 `.phasegate/scratchpad/summaries/`
- 不要使用 `.phasegate/progress.md`
