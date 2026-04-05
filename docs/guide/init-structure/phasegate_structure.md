# .phasegate/ 目录结构总览

`phasegate init` 在目标项目根目录下创建 `.phasegate/` 文件夹，所有 PhaseGate 运行时数据都存放在这里。

---

## 初始化后的目录结构

```
.phasegate/
├── requirements/
│   └── requirements.md          ← 需求草稿模板（用户可选填）
├── design/                      ← Phase 1 自动生成，初始为空
├── contracts/                   ← Phase 1 自动生成，初始为空
├── phasegate.config.json        ← 项目配置
├── progress.json                ← 状态 source of truth
├── progress.md                  ← 人类可读进度视图
└── scratchpad/                  ← Worker 运行时工作目录（可 gitignore）
```

---

## 各目录/文件一览

| 路径 | 由谁创建 | 用途 |
|---|---|---|
| `requirements/` | `init` | 存放需求文档，Phase 0 输出 |
| `design/` | Phase 1 | 存放模块设计书 |
| `contracts/` | Phase 1 | 存放接口契约文件 |
| `phasegate.config.json` | `init` | 项目级配置 |
| `progress.json` | `init` | 阶段状态，机器读写 |
| `progress.md` | `init` | 进度展示，人类阅读 |
| `scratchpad/` | Phase 3 运行时 | 各模块 Worker 的临时工作目录 |

---

## git 建议

`.phasegate/` 整体纳入 git（设计书、需求、契约有保存价值）。

唯一例外：`scratchpad/` 是运行时产物，建议加入 `.gitignore`：

```
.phasegate/scratchpad/
```

---

## 详细文档索引

| 内容 | 文档 |
|---|---|
| requirements/ 目录和需求模板 | [requirements_guide.md](requirements_guide.md) |
| design/ 和 contracts/ 目录 | [design_contracts_guide.md](design_contracts_guide.md) |
| progress.json / progress.md | [progress_guide.md](progress_guide.md) |
| phasegate.config.json 配置项 | [config_guide.md](config_guide.md) |
