# PhaseGate 使用教程

---

## 快速上手路径

```
安装依赖 → 健康检查 → init 新项目 → 填写文档 → status/progress 查看状态 → chat/review/run
```

---

## 1. 环境准备

**依赖：**

- Node.js 18+
- npm
- （可选）`claude` CLI — `chat` / `review` / `run` 命令需要

**安装：**

```bash
npm install
```

**健康检查（推荐先跑一次）：**

```bash
npx tsc --noEmit
npm run acceptance:phase2
```

两条都通过，说明 CLI 和依赖图功能可用。

---

## 2. 启动方式

开发阶段推荐直接跑源码：

```bash
npx tsx src/index.ts --help
```

构建产物后也可以：

```bash
npm run build
node dist/index.js --help
```

全局安装方式：

```bash
npm link
phasegate --help
```

> 排查问题优先用 `npx tsx src/index.ts`，报错信息更直接。

---

## 3. 最小使用流程

### 3.1 初始化项目

**在 PhaseGate 目录下**，对一个目标目录执行初始化：

```bash
npx tsx src/index.ts init /path/to/my-project
phasegate init
```

生成结构：

```
my-project/
├── requirements/
├── design/
├── contracts/
├── progress.json
├── progress.md
└── phasegate.config.json
```

### 3.2 进入项目目录，查看状态

```bash
cd /path/to/my-project
npx tsx /path/to/PhaseGate/src/index.ts status
npx tsx /path/to/PhaseGate/src/index.ts progress
```

> 如果已全局安装，直接用 `phasegate status` 即可。

---

## 4. 填写项目文档

### `requirements/`

放需求文档，对应 Phase 0 讨论产出。文件名任意。

```
requirements/login.md
requirements/user-profile.md
```

### `design/`

每个模块一个 Markdown 文件，**文件名即模块名**。

依赖关系写在 `## Dependencies` 表格中：

```markdown
# module-b

## Dependencies
| Dependency | Why |
|---|---|
| module-a | needs A |
```

依赖图会从这里读取模块间关系，计算执行波次。

### `contracts/`

接口契约文档，frontmatter 中的 `consumers` 字段决定哪些模块会注入该契约。

```markdown
---
name: IFoo
description: Foo interface
consumers:
  - module-b
---

# IFoo contract
```

---

## 5. 依赖图

`DependencyGraph` 会做两件事：

1. 扫描 `design/`，提取模块依赖，计算执行波次
2. 扫描 `contracts/`，按 `consumers` 将契约注入对应模块

**示例：**

| 模块 | 依赖 |
|---|---|
| module-a | 无 |
| module-b | module-a |

执行波次：Wave 0 → `module-a`，Wave 1 → `module-b`

**循环依赖**（如 `module-b ↔ module-c`）会直接抛出 `Circular dependency` 错误，需修改模块划分，不可绕过。

---

## 6. AI 命令

这三个命令依赖本机 `claude` CLI，未安装时无法执行 AI 流程。

### `chat` — 需求讨论

```bash
npx tsx src/index.ts chat
```

前提：当前目录已 `init`，且 `claude` 可用。

### `review` — 单模块设计 review

```bash
npx tsx src/index.ts review module-a
```

前提：`design/module-a.md` 存在，且 `claude` 可用。

### `run` — 驱动当前阶段

```bash
npx tsx src/index.ts run
npx tsx src/index.ts run --phase 3
```

> **注意：** `ConstraintChecker` 当前为桩实现，Phase 3 Orchestrator 骨架尚未完整验证。建议先在开发环境验证，不要直接用于生产流程。

---

## 7. 推荐试用顺序

1. `npm install` + 健康检查
2. `init` 建项目骨架
3. 手工填 `requirements/`、`design/`、`contracts/`
4. `status` / `progress` 确认状态文件正常
5. `npm run acceptance:phase2` 验证 CLI 和依赖图
6. 再试 `chat`、`review`、`run`

---

## 8. 常见问题

**`progress.json not found. Run phasegate init first.`**

当前目录不是 PhaseGate 项目目录，先执行 `init`。

**`claude exited with code ...`**

CLI 本身无问题，但外部 `claude` 命令不可用。检查：

- `claude` 是否已安装
- `claude` 是否在 `PATH` 中
- 当前 shell 能否直接执行 `claude`

**`Circular dependency: ...`**

`design/` 中存在循环依赖，需修改模块划分或依赖关系。

---

## 9. 命令速查

```bash
npx tsc --noEmit                        # 类型检查
npm run acceptance:phase2               # 验收测试
npx tsx src/index.ts --help             # 帮助
npx tsx src/index.ts init <project>     # 初始化项目
npx tsx src/index.ts status             # 查看阶段状态
npx tsx src/index.ts progress           # 查看完整进度
npx tsx src/index.ts chat               # 需求讨论（需 claude）
npx tsx src/index.ts review <module>    # 模块 review（需 claude）
npx tsx src/index.ts run [--phase N]    # 驱动阶段（需 claude）
```
