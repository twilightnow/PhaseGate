# PhaseGate 命令内部逻辑

本文档描述每个命令的执行流程、读写的文件和关键行为，适合开发调试和理解系统运作。

---

## `init`

**用法：** `phasegate init`（在目标目录内执行，不接受路径参数）

**执行流程：**

1. 取 `process.cwd()` 作为项目根目录，`path.basename(cwd)` 作为 `projectName`
2. 检查 `.phasegate/progress.json` 是否已存在 → 存在则报错退出（防止重复初始化）
3. 创建目录：`.phasegate/requirements/`、`.phasegate/design/`、`.phasegate/contracts/`
4. 写入需求模板：`.phasegate/requirements/requirements.md`
5. 写入初始 `progress.json`（currentPhase = 0，所有列表为空）
6. 写入 `phasegate.config.json`（默认值见下）
7. `ProgressManager.write()` 同步生成 `progress.md`

**默认配置（`phasegate.config.json`）：**

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

**写入文件：**

```
.phasegate/
├── requirements/requirements.md   ← 需求模板
├── design/                        ← 空目录
├── contracts/                     ← 空目录
├── progress.json                  ← 状态 source of truth
├── progress.md                    ← 由 ProgressManager 生成
└── phasegate.config.json          ← 配置
```

---

## `status`

**用法：** `phasegate status`

**执行流程：**

1. 读取 `.phasegate/progress.json`（不存在则报错退出）
2. 渲染到终端（不写文件）

**输出内容：**

| 区块 | 来源字段 | 图标含义 |
|---|---|---|
| 项目名 + 当前阶段 | `projectName`、`currentPhase` | — |
| Requirements | `requirements[]` | ✓ done / o 其他 |
| Design Modules | `design.modules[]` | ✓ done / o 其他 |
| Design review | `design.reviewPassed` | ✓ / o |
| Modules（运行时） | `modules[]` | ✓ done / `->` running / x failed / ! blocked / o pending |
| Blockers | `blockers[]` | ! |
| Code review | `codeReviewPassed` | ✓ / o |

> `status` 只读不写，适合随时查看。

---

## `progress`

**用法：** `phasegate progress`

**执行流程：**

1. 检查 `.phasegate/progress.md` 是否存在
2. 直接读取并 `console.log` 全文

`progress.md` 由每次 `ProgressManager.write()` 自动重新生成 Status Section，Phase Summary 区块（由 AI 阶段追加）则只增不改。

---

## `chat`

**用法：** `phasegate chat [--feature <name>]`

**执行流程：**

1. 检查 `.phasegate/progress.json` 存在（确认已初始化）
2. 构建 system prompt，告知 AI 读取 `prompts/phase0_requirements.md`
3. 若传入 `--feature`，将特性名追加到 prompt 末尾
4. 调用 `runner.chat(systemPrompt)` → 以交互模式（`stdio: inherit`）启动 AI CLI
5. **子进程退出后自动触发 Phase 0 Gate 检查**（`src/core/phase-gate.ts`）
6. Gate 通过 → `progress.json` 的 `currentPhase` 更新为 1，提示用户执行 `phasegate run`
7. Gate 失败 → 打印具体问题，要求重新执行 `phasegate chat`

**System prompt 内容：**

System prompt 只传一条"读取指令文件"的指令，具体会话逻辑全部在 `prompts/phase0_requirements.md` 中定义：

```
prompts/phase0_requirements.md
├── Before Starting  — 扫描已有 requirements 文件并读取作为上下文
├── Discussion Framework — 5 步提问框架（按序执行，不跳过）
├── Output          — 生成 .phasegate/requirements/{name}.md（含模板）
└── Gate Check      — 结束前必须满足的条件清单
```

**Phase 0 Gate 检查条件（`checkPhase0Gate`）：**

- `.phasegate/requirements/` 下存在至少一个非模板 `.md` 文件
- 每个需求文件包含 `## Description`、`## Scope`、`## Acceptance Criteria` 三个章节

**文件读写：** 需求文件由 AI 生成，PhaseGate 不直接写入。Gate 通过后 PhaseGate 更新 `progress.json`。

---

## `run`

**用法：** `phasegate run [--phase N]`

**执行流程：**

1. 读取 `progress.json`，取 `currentPhase`（`--phase` 可覆盖）
2. Phase 0 → 打印提示，引导用户执行 `phasegate chat`
3. Phase 3 → 走独立路径（见下）
4. 其余阶段 → `runSinglePhase()`

**Phases 1 / 2 / 4 / 5 通用路径：**

从 `prompts/phase{N}_{name}.md` 读取指令文件内容作为 prompt，与以下上下文文件一起注入 AI：

| 注入文件 | 用途 |
|---|---|
| `.phasegate/progress.md` | 当前状态和历史 Summary |
| `docs/03_architecture_constraints.md` | 架构约束 |

各 prompt 文件位置：

| Phase | 文件 |
|---|---|
| 1 | `prompts/phase1_design.md` |
| 2 | `prompts/phase2_review.md` |
| 4 | `prompts/phase4_code_review.md` |
| 5 | `prompts/phase5_acceptance.md` |

---

## `review <module>`

**用法：** `phasegate review module-a`

**执行流程：**

1. 检查 `.phasegate/design/<module>.md` 存在
2. 扫描 `.phasegate/contracts/`，收集所有 `.md` 文件
3. 调用 `runner.run([designFile, ...contractFiles], prompt)` → 非交互，捕获输出
4. 打印 AI 返回结果

**注入 AI 的上下文：**

- `.phasegate/design/<module>.md`（主文档）
- `.phasegate/contracts/*.md`（全部契约，不筛选）

文件内容以 `--- FILE: {name} ---` 块格式拼入 prompt 头部。

**AI 评估维度（prompt 硬编码）：**

1. Interface completeness — 方法签名和行为是否完整
2. Dependency correctness — 无循环依赖，依赖显式声明
3. Single responsibility — 模块职责单一
4. Error handling — 边界和失败路径
5. Naming consistency — 命名与 codebase 一致
6. Constraint compliance — 符合架构约束

**输出格式（AI 返回）：**

```markdown
## Verdict
PASS / FAIL

## Issues
- ...

## Suggestions
- ...
```

---

## `run [--phase N]`

**用法：** `phasegate run` / `phasegate run --phase 3`

**执行流程：**

1. 读取 `progress.json`，取 `currentPhase`（`--phase` 可覆盖）
2. Phase 3 走独立路径（见下）；其余阶段走通用路径

### 通用路径（Phase 0 / 1 / 2 / 4 / 5）

| Phase | AI 模式 | 传入上下文 |
|---|---|---|
| 0 | 交互（chat） | 无文件，系统 prompt 内联 |
| 1 / 2 / 4 / 5 | 非交互（run） | `.phasegate/progress.md` + `docs/01_workflow_phases.md` |

各阶段 prompt 引用 `docs/01_workflow_phases.md` 中对应步骤说明。

### Phase 3 路径（Orchestrator）

```
ConstraintChecker.check(cwd)
    ↓ 有 violations → 打印并退出
    ↓ 通过
Orchestrator.run(cwd)
    ↓ 全部 done/blocked（无 failed）→ pm.updatePhase(cwd, 4)
    ↓ 有 failed → 提示修复后重跑
```

**Orchestrator 详细流程：**

1. `DependencyGraph.build(cwd)` — 扫描 `design/*.md`，构建 DAG，按拓扑排序分波次
2. 对比 `progress.json` 中 `modules[]`，自动注册 DAG 中的新模块
3. 跳过已 `done` 的模块（断点续跑）
4. 按波次执行，同一波次内 `Promise.all()` 并发 fork
5. 某模块 `failed` → 其直接依赖模块标记为 `blocked`

**单个 Worker 执行：**

```
检查依赖是否有 failed → blocked 直接返回
    ↓
创建 scratchpad 目录：.phasegate/scratchpad/<module>/
    ↓
上下文文件：design/<module>.md + 相关 contracts/*.md + docs/03_architecture_constraints.md
    ↓
runner.fork(contextFiles, prompt) — 非交互，解析输出为 WorkerReport
    ↓
写入 .phasegate/scratchpad/<module>/report.json
    ↓
返回 done / failed
```

**WorkerReport 格式（AI 必须输出）：**

```markdown
## Scope
{module name} — {一句话职责}

## Result
done / failed

## Key Files
- src/core/foo.ts

## Files Changed
- src/core/foo.ts

## Issues
(none)
```

**重试机制（`orchestrator.retry()`）：**

- 最多 3 次（`MAX_RETRIES = 3`）
- 每次将上次失败的 `failureContext`（issues 拼接）注入 prompt
- 3 次全失败 → 标记 `failed`，记录 `max retries exceeded`

---

## AI Runner（所有 AI 命令共用）

### 配置与选择

启动时读取 `phasegate.config.json` 的 `runner` 字段，确定使用的 AI CLI：

| 配置值 | 实际调用命令 | 别名 |
|---|---|---|
| `claude` | `claude` | — |
| `gemini` | `gemini` | — |
| `codex` | `codex` | `openai`、`chatgpt` |

配置文件查找顺序：`.phasegate/phasegate.config.json` → `phasegate.config.json` → 默认 `claude`

### 三种调用模式

| 方法 | CLI 参数 | stdio | 返回值 |
|---|---|---|---|
| `run(files, prompt)` | `-p <prompt>` | 捕获 stdout | `string`（AI 输出） |
| `fork(files, prompt)` | `-p <prompt>` | 捕获 stdout | `WorkerReport`（解析 markdown） |
| `chat(systemPrompt)` | `--system-prompt <prompt>` | `inherit`（交互） | void |

### Context 注入

`run` / `fork` 调用时，文件内容会拼入 prompt 头部：

```
--- FILE: foo.md ---
{文件内容}

--- FILE: bar.md ---
{文件内容}

--- TASK ---
{实际 prompt}
```

不存在的文件会静默跳过。

---

## progress.json / progress.md 同步机制

每次 `ProgressManager.write()` 执行时：

1. 将 `progress.json` 写入磁盘
2. 重新生成 `progress.md` 的 Status Section（`<!-- ==================== Status Section -->` 标记之后全部替换）
3. Phase Summary 区块（`<!-- ==================== Phase Summary -->` 之后）只追加不覆盖

`progress.json` 是 source of truth；`progress.md` 是只读视图，不应手工编辑 Status Section。
