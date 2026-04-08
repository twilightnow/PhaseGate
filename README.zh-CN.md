# PhaseGate

面向工程落地的 AI 编码工作流，强调阶段隔离、契约先行，以及多模块协同执行。

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

## 核心模型

PhaseGate 把流程拆成两层：

- 需求池：`.phasegate/requirements/`
- 单一活动执行流：`.phasegate/progress.json`

需求可以持续积累或修订。
执行一次只绑定一个被选中的 requirement。

## 快速开始

```bash
npm install
npm run build
phasegate init
phasegate chat --feature login
phasegate select login
phasegate run
```

也可以一步完成选择并执行：

```bash
phasegate run --requirement login
```

## 工作区

```text
.phasegate/
  requirements/
  tasks/
  contracts/
  scratchpad/
  archive/
  progress.json
  phasegate.config.json
```

- `progress.json` 是唯一权威状态文件
- `scratchpad/` 保存临时产物、worker 报告和阶段摘要
- `archive/` 保存值得保留的历史执行产物

## 主要命令

- `phasegate init`
- `phasegate chat`
- `phasegate select <requirement>`
- `phasegate run`
- `phasegate status`
- `phasegate progress`
- `phasegate review <module>`

## 文档入口

- [docs/guides/getting-started.md](./docs/guides/getting-started.md)
- [docs/core/workflow-phases.md](./docs/core/workflow-phases.md)
- [docs/core/progress-model.md](./docs/core/progress-model.md)
