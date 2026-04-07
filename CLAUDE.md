# PhaseGate Notes

先看这些：

- 文档入口：`docs/README.md`
- 文档规则：`docs/documentation-principles.md`
- 文档审计：`docs/document-audit.md`

文档维护只遵守这几条：

- 先改现有主文档，不默认新建文档。
- 一个事实只保留一个主文档，重复内容直接合并或删。
- 稳定事实写进 `docs/core/`，操作步骤写进 `docs/guides/`，草稿想法写进 `docs/ideas.md` 或 `docs/tasks/`。
- 改代码后，只同步真正受影响的主文档；不要顺手追加大段过程说明。
- 如果文档和代码冲突，以代码为准，并更新 `docs/document-audit.md`。
