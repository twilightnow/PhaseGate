# 公开 V1 能力

- Type: note
- Status: historical
- Reader: both

## 目的

本笔记记录了早期公开 v1 目标的历史能力检查点。
这不是当前的真实来源。

## 历史能力主题

1. 稳定的本地设置和基本 CLI 流程
2. 可靠的 `init`、`chat`、`run`、`status`、`progress` 和 `review`
3. 持久化保存在 `.phasegate/` 下的项目制品
4. 可恢复的执行状态
5. Phase 3 协调者与工作者编排
6. 可配置的 AI 路由
7. 基础文档

## 自本笔记以来的重要变化

- `progress.json` 仍然是唯一权威的状态文件
- 当前实现不再维护 `.phasegate/progress.md`
- 活跃执行明确由 `activeRequirement` 约束
- 阶段摘要现在保存在 `.phasegate/scratchpad/summaries/` 下

## 请使用当前文档了解

- 实际工作区布局
- 实际 CLI 行为
- 实际进度语义
