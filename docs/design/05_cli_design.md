# PhaseGate 设计书 — CLI 模块设计

> 版本 0.1 | 2026年4月

---

## AI 快速参考

> **本节位 AI 读者。**

| 问题 | 答案 |
|---|---|
| 技术栈 | Node.js + TypeScript + commander |
| 构建输出 | `dist/` |
| 入口文件 | `src/index.ts` |
| 命令前缀 | `phasegate` |
| 如何添加新命令 | 在 `src/commands/` 新建文件，在 `src/index.ts` 注册 |
| 如何添加新核心逻辑 | 在 `src/core/` 新建文件，定义对应 interface |

---

## 项目目录结构

```
PhaseGate/
├── src/
│   ├── index.ts              # CLI 入口：注册所有命令
│   ├── types.ts              # 全局类型定义
│   ├── commands/             # 每个文件 = 一个命令
│   │   ├── init.ts           # phasegate init
│   │   ├── status.ts         # phasegate status
│   │   ├── run.ts            # phasegate run
│   │   ├── review.ts         # phasegate review
│   │   ├── chat.ts           # phasegate chat
│   │   └── progress.ts       # phasegate progress
│   └── core/                 # 核心业务逻辑（无 CLI 耦合）
│       ├── progress-manager.ts   # progress.md 读写（含 Phase Summary 解析）
│       ├── ai-runner.ts          # 单个 AI agent 执行单元（含 fork worker）
│       ├── dependency-graph.ts   # 解析契约 frontmatter，构建模块依赖 DAG
│       ├── orchestrator.ts       # Coordinator Agent：fork 调度 + 报告解析
│       └── constraint-checker.ts # 架构约束检查
├── .phasegate/               # PhaseGate 运行时目录（不提交到 git）
│   └── scratchpad/           # 各模块 worker agent 的工作目录
│       └── {module-name}/    # 每个模块独立目录
│           └── report.md     # worker 标准报告
├── package.json
├── tsconfig.json
├── progress.json             # 状态数据（source of truth，机器读写）
├── progress.md               # 展示文档（仅供阅读，AI 追加 Phase Summary）
└── acceptance-guide.md       # Phase 5B 人工验收指导书（Phase 5A 后生成）
```

---

## 模块职责

### src/index.ts

**Responsibility:** CLI 入口，注册所有命令，解析参数。

**Out of Scope:** 不包含任何业务逻辑。

**Dependencies:** 所有 `commands/*.ts`

---

### src/types.ts

**Responsibility:** 定义全局共享类型。不包含逻辑。

**Key Types:**

```typescript
type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;
type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';

interface ModuleEntry {
  name: string;
  status: ItemStatus;
  blockedBy?: string;
}

interface ContractEntry {
  name: string;
  status: 'draft' | 'finalized';
  provider: string;
  consumers: string[];
}

interface ProjectProgress {
  projectName: string;
  currentPhase: PhaseId;
  requirements: { name: string; status: ItemStatus }[];
  design: { modules: ModuleEntry[]; contracts: ContractEntry[]; reviewPassed: boolean };
  modules: ModuleEntry[];
  codeReviewPassed: boolean;
  blockers: string[];
}

/** 接口契约文件的 frontmatter（用于 context 注入决策） */
interface ContractFrontmatter {
  name: string;
  description: string;  // 供 orchestrator 决策是否注入，必须语义明确
  consumers: string[];  // 只注入实际依赖此契约的模块 worker
}

/** Fork Worker Agent 的标准输出报告 */
interface WorkerReport {
  scope: string;          // "{模块名} — {一句话职责}"
  result: 'done' | 'failed';
  keyFiles: string[];
  filesChanged: string[];
  issues: string[];
}
```

---

### src/commands/init.ts

**Responsibility:** `phasegate init` — 在当前目录初始化 PhaseGate 项目结构。

**Input:** `[project-name]` (optional, default = current directory name)

**Process:**
1. 创建 `requirements/` 目录
2. 创建 `design/` 目录
3. 创建 `contracts/` 目录
4. 写入 `progress.md`（使用 `02_progress_document.md` 规定的格式）
5. 写入 `phasegate.config.json`（默认配置）

**Output:**
```
{cwd}/requirements/          (dir created)
{cwd}/design/                (dir created)
{cwd}/contracts/             (dir created)
{cwd}/progress.json          (file created — source of truth, via ProgressManager.write())
{cwd}/progress.md            (file created — human-readable, via ProgressManager.write())
{cwd}/phasegate.config.json  (file created)
```

**Error Handling:**
- 目录已存在 → 跳过，不覆盖
- `progress.md` 已存在 → 报错退出，提示用户

---

### src/commands/status.ts

**Responsibility:** `phasegate status` — 读取并展示当前项目进度概览。

**Input:** 无（读取 `./progress.md`）

**Process:** 调用 `ProgressManager.read()` → 格式化输出

**Error Handling:** `progress.md` 不存在 → 提示运行 `phasegate init`

---

### src/commands/run.ts

**Responsibility:** `phasegate run` — 读取进度，判断当前 phase，驱动 Orchestrator 全自动执行。无需人工介入。

**Input:** 无

**Process:**
1. 读取 `progress.md`，确认 `currentPhase`
2. Phase 0/1/2/4/5：调用 `AiRunner.run()` 单次执行
3. **Phase 3**：调用 `Orchestrator.run()`，自动并发开发所有模块
4. 等待所有任务完成，更新 `progress.md`

**Dependencies:** `IOrchestrator`, `IProgressManager`, `IConstraintChecker`

---

### src/commands/review.ts

**Responsibility:** `phasegate review [module]` — 对指定模块发起独立 AI review（空 context）。

**Input:** `module` (module name)

**Process:**
1. 验证 `design/{module}.md` 存在
2. 收集相关 `contracts/*.md`
3. 调用 `AiRunner.run()` 传入独立 review 的 prompt

---

### src/commands/chat.ts

**Responsibility:** `phasegate chat` — 启动需求讨论 session（交互式）。

**Input:** 无

**Process:** 调用 `AiRunner.chat()` 传入 PHASE_0 的 prompt 框架

---

### src/commands/progress.ts

**Responsibility:** `phasegate progress` — `status` 命令的别名，详细展示进度文档。

---

### src/core/dependency-graph.ts

**Responsibility:** 扫描 `contracts/*.md` 的 frontmatter（`consumers` 字段）和 `design/*.md` 的 Dependencies 表，构建有向无环图（DAG），输出拓扑排序后的执行 wave 列表，并为每个模块计算需要注入的契约文件列表。

**Out of Scope:** 不做任何 AI 调用，不写文件，纯读取 + 计算。

**Interface:**

```typescript
interface ModuleNode {
  name: string;            // 模块名，对应 design/{name}.md
  designFile: string;      // 设计书路径
  contractFiles: string[]; // 该模块实际需要的契约文件路径
                           // 来源：contracts/*.md frontmatter 中 consumers 包含本模块的文件
  dependencies: string[];  // 依赖的其他模块名（来自设计书 Dependencies 表）
}

interface IDependencyGraph {
  /** 扫描 design/ + contracts/ 目录，解析所有模块节点 */
  build(projectRoot: string): Promise<ModuleNode[]>;
  /** 拓扑排序，返回 wave 列表：同一 wave 内的模块无依赖关系，可并发执行 */
  getExecutionWaves(nodes: ModuleNode[]): ModuleNode[][];
}
```

**Context 注入策略（核心设计）：**

每个模块 worker agent 只注入自己实际依赖的契约文件，不全量加载 `contracts/`。
判断逻辑：遍历所有契约文件的 frontmatter，若 `consumers` 包含本模块名 → 注入该契约。

**Error Handling:**
- 检测到循环依赖 → 抛出错误，列出环路路径
- `design/` 目录为空 → 抛出错误，提示先完成 Phase 1
- 契约文件缺少 frontmatter → 警告并跳过 consumers 过滤（全量注入该契约）

---

### src/core/orchestrator.ts

**Responsibility:** Coordinator Agent 的实现。接收 DAG 的执行 wave 列表，逐 wave 并发 fork 模块 worker agent，遵守 Fork 纪律，解析 worker 标准报告，更新进度，汇总结果。

**Out of Scope:** 不解析依赖关系（由 `dependency-graph.ts` 负责），不直接调用 AI CLI（由 `ai-runner.ts` 的 `fork()` 方法负责）。

**Interface:**

```typescript
type ModuleRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';

interface ModuleRunResult {
  moduleName: string;
  status: ModuleRunStatus;
  durationMs: number;
  report?: WorkerReport;  // worker 的标准报告（done/failed 时存在）
  error?: string;
}

interface IOrchestrator {
  /**
   * 全自动执行 Phase 3（Coordinator 模式），支持断点续跑：
   * 1. 读取 progress.json，跳过 status === 'done' 的模块（断点续跑）
   * 2. 调用 DependencyGraph.build() + getExecutionWaves()（只包含未完成模块）
   * 3. 逐 wave 并发调用 AiRunner.fork()（每个模块独立子进程，注入固定文件集合）
   * 4. 等待本 wave 所有 worker 完成（Don't peek, Don't race）
   * 5. 解析各 worker 的 scratchpad report，更新 progress.json
   * 6. 某模块失败 → downstream 标记 blocked，继续执行其余 wave
   * 7. 所有 wave 结束后返回汇总结果
   */
  run(projectRoot: string): Promise<ModuleRunResult[]>;

  /**
   * Phase 5A 自修正循环：针对失败模块重新 fork worker
   * 1. 注入原始设计书 + 失败信息（测试输出 / 错误日志）
   * 2. 重跑，更新 progress.json
   * 3. 超过 maxRetries 次仍失败 → 返回 failed，等待人工介入
   */
  retry(projectRoot: string, moduleName: string, failureContext: string): Promise<ModuleRunResult>;
}
```

**Fork 纪律（Coordinator 必须遵守）：**
- **Don't peek**：不在 `AiRunner.fork()` resolve 前读取 scratchpad 文件
- **Don't race**：等 Promise 完成通知，不预测 worker 输出
- **Directive only**：传给 fork 的 prompt 只包含指令（模块名、设计书路径、契约路径列表），不包含背景（背景从继承的 context 中来）

**并发策略:**
- 同一 wave 内全部并发，不设上限（模块数量有限，通常 < 10）
- 一个模块失败不中断同 wave 其他模块，wave 结束后统一处理
- 所有模块完成（含失败）才进入下一 wave

**失败处理:**
- 某模块 `failed` → 直接 downstream 标记 `blocked`，跳过 fork
- 最终汇总报告列出 done / failed / blocked 各模块列表

---

### src/core/progress-manager.ts

**Responsibility:** `progress.json` 的结构化读写（source of truth）。同步更新 `progress.md` 的状态区（展示用）。隔离文件格式细节。

**Interface:**

```typescript
interface IProgressManager {
  read(cwd: string): ProjectProgress;
  write(cwd: string, progress: ProjectProgress): void;
  updatePhase(cwd: string, phase: PhaseId): void;
  markModuleDone(cwd: string, moduleName: string): void;
  markModuleFailed(cwd: string, moduleName: string, error: string): void;
  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void;
  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void; // 追加写入 progress.md
}
```

**Out of Scope:** 不做任何显示或 CLI 输出。不解析 `progress.md`（只写入，不读取）。

---

### src/core/ai-runner.ts

**Responsibility:** 调用底层 AI CLI（Claude Code / Gemini CLI 等）的抽象层。上层命令不感知具体 AI 工具。

**Interface:**

```typescript
interface IAiRunner {
  /** 非交互式：传入文件列表 + prompt，拿到结果（用于 Phase 0/1/2/4/5 的单次执行） */
  run(files: string[], prompt: string): Promise<string>;

  /**
   * Fork Worker 模式：启动独立 AI CLI 子进程执行单个模块开发（用于 Phase 3）
   *
   * - 每个 worker 是全新 context 的独立子进程，不继承任何父进程上下文
   * - Coordinator 负责计算并注入固定文件集合（设计书 + 相关契约 + 架构约束）
   * - worker 将结果写入 .phasegate/scratchpad/{module}/report.md
   * - 此方法在 worker 完成（或失败）后 resolve，遵守 Don't peek 原则
   */
  fork(files: string[], prompt: string): Promise<WorkerReport>;

  /** 交互式：传入 system prompt，打开对话 session（用于 Phase 0 需求讨论） */
  chat(systemPrompt: string): Promise<void>;
}
```

**Extensibility Note:** 第二阶段先实现 `ClaudeRunner`（调用 `claude` CLI）。通过 `phasegate.config.json` 的 `runner` 字段切换实现，上层代码不变。

---

### src/core/constraint-checker.ts

**Responsibility:** 自动检查架构约束（Phase 3 时使用）。

**Interface:**

```typescript
interface IConstraintChecker {
  check(projectRoot: string): ConstraintReport;
}

interface ConstraintReport {
  passed: boolean;
  violations: { file: string; rule: string; detail: string }[];
}
```

**Phase 2 状态:** 桩实现，始终返回 `passed: true`。Phase 3 实现真实检查逻辑。

---

## 接口契约状态

| 接口 | 状态 | Provider | Consumers |
|---|---|---|---|
| IProgressManager | draft | progress-manager.ts | init, status, run, progress |
| IAiRunner | draft | ai-runner.ts (ClaudeRunner) | orchestrator, review, chat |
| IDependencyGraph | draft | dependency-graph.ts | orchestrator |
| IOrchestrator | draft | orchestrator.ts | run |
| IConstraintChecker | draft | constraint-checker.ts | run |

---

## 技术决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 语言 | TypeScript | 类型安全，IDE 支持好 |
| CLI 框架 | commander v12 | 轻量，API 稳定，无额外依赖 |
| 文件操作 | fs-extra | 比原生 fs 更简洁，Promise API |
| 终端颜色 | chalk v4 | 兼容 CommonJS，无需 ESM 配置 |
| 开发运行 | tsx | 直接运行 TS，无需先 build |
| 模块系统 | CommonJS | 避免 ESM 兼容性问题 |

---

## 开发顺序（build order）

依赖关系决定开发顺序，无依赖关系的模块可并行。

```
types.ts                    (no deps)
    ↓
core/progress-manager.ts    (deps: types)         ┐
core/ai-runner.ts           (deps: types)         ├─ 可全部并行
core/dependency-graph.ts    (deps: types)         │
core/constraint-checker.ts  (deps: types)         ┘
    ↓
core/orchestrator.ts        (deps: dependency-graph, ai-runner, progress-manager)
    ↓
commands/init.ts            (deps: progress-manager)           ┐
commands/status.ts          (deps: progress-manager)           │
commands/run.ts             (deps: orchestrator, progress-manager, constraint-checker) ├─ 可并行
commands/review.ts          (deps: ai-runner)                  │
commands/chat.ts            (deps: ai-runner)                  │
commands/progress.ts        (deps: progress-manager)           ┘
    ↓
index.ts                    (deps: all commands)
```
