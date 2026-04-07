# Documentation Governance

- Type: guide
- Status: active
- Reader: both
- Use when: 需要新增、合并、删改文档，或判断某份信息该写到哪里时
- Source of truth: 是
- Update when: 文档结构规则、命名规则或清理流程发生变化时

## Purpose

把 [`documentation-principles.md`](./documentation-principles.md) 变成可执行的日常治理规则。

## Scope

包含：目录落位规则、命名规则、去重规则、清理流程。

不包含：具体业务规格、代码实现说明、历史讨论全文。

## Placement Rules

- 稳定且跨模块共享的事实写进 `core/`。
- 面向动作和操作步骤的内容写进 `guides/`。
- 仍在推进、可能频繁变化的事项写进 `tasks/`。
- 不再指导当前实现但仍需追溯的内容写进 `archive/`。

## Naming Rules

- 文件名优先表达“读者为什么打开它”，不是“作者什么时候写的它”。
- 避免编号驱动命名，除非代码或流程确实按编号耦合。
- 优先使用清晰英文文件名，正文可用中文。
- 相近主题优先合并为主文档，不再拆成多个薄文件。

## Duplication Rules

- 一个事实只保留一个主文档。
- 总览只做导航，不复制规格内容。
- 指南只描述步骤和边界，不重复系统事实。
- 如果一段内容同时出现在两处，必须显式指定哪一处是主来源。

## Update Workflow

1. 先判断信息是稳定事实、操作方法、临时任务，还是历史记录。
2. 优先更新现有主文档，而不是新建同主题文件。
3. 如果发现旧文档已被更高质量文档覆盖，直接合并或归档。
4. 修改完成后，检查 `README.md` 中的索引是否仍然准确。

## When To Delete

- 内容可以直接从代码读出，且没有额外边界价值。
- 内容已经过时，且没有追溯必要。
- 内容只是阶段性思考过程，没有结论沉淀。

## Minimal Template

长期文档至少保留这些区块：

- 文档元信息
- `Purpose`
- `Scope`
- `Key Facts / Steps / Constraints`
- `Related`

## This Cleanup

本轮整理采取以下动作：

- `design/` 下文档按稳定事实合并进 `core/`，旧稿归档。
- `guide/` 下重复或过细的初始化结构说明合并成一份工作区指南。
- `acceptance-guide.md`、`functional_check.md` 中过时或噪声较高内容不再作为主文档保留。
- `ideas.md` 转入 `tasks/backlog.md`，明确其临时性质。

## Related

- [`documentation-principles.md`](./documentation-principles.md)
- [`README.md`](./README.md)
