# Ideas

- Type: task
- Status: draft
- Reader: both
- Use when: 需要快速记下还没整理成正式任务或正式文档的想法时
- Source of truth: 否
- Update when: 有新想法、想法被转入 `tasks/backlog.md`，或确认过时要删除时

## Purpose

保留一个低门槛的想法草稿区，避免临时念头直接污染长期文档。

## Rules

- 这里只记草稿，不记正式结论。
- 想法稳定后再转入 `tasks/backlog.md` 或正式文档。
- 明显过时的条目直接删除，不做历史维护。

## Ideas

- codex cli 支持
- Claude 文件夹信任问题，需要引导使用者修改 `\.claude\settings.local.json`
- 使用指导需要继续区分本地源码运行和纯 `phasegate` 命令使用
- 中间层设计文件应该保留到什么程度，怎么把维护成本压到最低
- Prompt 约束：Phase 0 结束时是否需要 AI 明确提醒手动结束
- 文件结构规划：在文档大量增加后如何持续防止堆积
- 任务书和设计书边界怎么切，是否长期只保留任务书
- 多模型配置：默认配置如何覆盖不同模型的调度方案
- 多模型配置：不同阶段是否允许单独指定 runner
- 多语言支持是否需要继续保留完整多套 prompt
- 多任务并行时 `progress.json` 怎么组织
- 跨阶段断点再续怎么设计
