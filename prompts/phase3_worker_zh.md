# Phase 3 Worker 中文说明

当前 orchestrator 在代码中构建 worker prompt，本文件不是实际运行入口。

参考约束：

- 只读取注入的 task、contract 和 architecture constraints
- 最终报告写入 `.phasegate/scratchpad/{module}/report.json`
- 不要读写 `.phasegate/progress.md`
