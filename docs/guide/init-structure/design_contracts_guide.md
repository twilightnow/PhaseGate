# design/ 和 contracts/ 目录指南

这两个目录在 `phasegate init` 时创建为空目录，由 **Phase 1** 自动填充。

---

## design/ — 模块设计书

### 作用

存放每个模块的设计文档。Phase 1 中 AI 读取需求文件，为每个模块生成一份设计书。

### Phase 1 后的结构示例

```
design/
├── progress-manager.md
├── ai-runner.md
├── dependency-graph.md
├── orchestrator.md
└── constraint-checker.md
```

### 设计书内容结构

每份设计书通常包含：

```markdown
# {module-name}

## 职责
该模块做什么，边界在哪里。

## 接口
导出的函数/类签名（TypeScript 类型）。

## 内部结构
主要数据结构、算法思路。

## 依赖
依赖哪些其他模块（用于构建 DAG）。

## 测试策略
需要覆盖的关键路径和边界条件。
```

### 谁会读这个目录

- **Phase 2**：AI 对设计书做 review，输出 PASS/FAIL
- **Phase 3**：各模块 Worker 读取自己的设计书，按设计实现代码
- **`phasegate review <module>`**：单模块设计 review

---

## contracts/ — 接口契约

### 作用

存放模块间接口的精确定义。比设计书更严格，直接约束模块间调用方式。

### Phase 1 后的结构示例

```
contracts/
├── progress-manager.contract.md
├── ai-runner.contract.md
└── orchestrator.contract.md
```

> 不是每个模块都必须有 contract 文件，只有对外接口需要严格约定的模块才生成。

### 契约文件内容结构

```markdown
# {module-name} Contract

## Exports

### functionName(param: Type): ReturnType
- param: 描述
- 返回值: 描述
- 异常: 何时抛出、抛出什么

## Invariants
该模块必须保证的不变量。

## Breaking Change Policy
什么情况下需要通知下游模块。
```

### 为什么需要契约文件

在 Fork Worker 并发编排（Phase 3）中，多个模块 Worker 同时开发。契约文件是 Worker 间唯一的接口协议：
- Worker A 实现 `progress-manager`，只看自己的设计书 + contract
- Worker B 调用 `progress-manager`，只看 `progress-manager.contract.md`
- 两者不需要互相感知对方的实现细节

---

## 手动修改设计书/契约

Phase 1 结束后用户可以手动编辑这两个目录下的文件：

- **修改设计书**：对 AI 的设计有异议时，直接编辑，然后重新执行 Phase 2 review
- **修改契约**：接口变更时同步更新，避免 Phase 3 的 Worker 使用过时接口

修改后需更新 `docs/05_cli_design.md` 对应章节（见 CLAUDE.md 文件写入规则）。

---

## 与 progress.json 的关系

Phase 1 完成后，`progress.json` 中的 `design.modules` 和 `design.contracts` 数组会列出所有已生成的设计书和契约文件名。`design/` 和 `contracts/` 目录的实际文件与这两个数组保持一致。
