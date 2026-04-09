# Loop Feature Plan

- Type: task
- Status: draft
- Reader: ai

## 目标

在现有 Phase 0（需求积累）和 Phase 1-5（单需求执行）之间，增加**优先级队列 + 自动循环执行**能力，实现无人值守的需求池消费。

---

## 设计决策

### 优先级

- 字段值：`high` / `normal` / `low`（3档，程序内部映射排序数字：high=1, normal=2, low=3）
- 存储位置：需求文件 frontmatter（`.phasegate/requirements/{name}.md`），需求文件是唯一权威
- 同步时机：**懒同步** — `loop` 或 `run` 启动时扫描 `requirements/`，将 priority 写入 `progress.json` 的 `requirements[]` 条目
- 默认值：未填写 priority 字段时，默认 `normal`
- 变更方式：直接编辑 `.md` 文件；下次 loop/run 启动时自动同步，执行前的需求文件可随意修改

### 自动选择原则（三层排序）

1. priority 排序：`high > normal > low`
2. 同优先级按 `approvedAt` 时间升序（先批准先跑）
3. 依赖关系：**v1 不实现**，留待后续

### loop 命令

```
phasegate loop              # 自动选取 + 跑完所有 approved 需求
phasegate loop --dry-run    # 预览执行顺序（含 priority、approvedAt），不实际运行
```

- `--max N` 和 `--priority filter` 不实现
- loop 启动时如有 `activeRequirement`（上次中断），优先 resume 当前需求，再继续队列

### 队列管理

- **动态 reload**：每完成一条需求后，重新读取 `requirements/` 排序，响应 Phase 0 期间新增的需求
- 队列快照仅用于 `--dry-run`，不用于实际执行

### 失败处理

- `gate_failed` → 立即停止 loop，终端打印失败原因和需求名，等待人工处理
- 不做自动跳过、重试逻辑（v1）

### 终止条件

| 情况 | 行为 |
|---|---|
| approved 队列为空（含全部为 draft） | 停止，打印提示 |
| gate_failed | 停止，打印失败信息 |
| 手动中断（Ctrl+C） | 停止，当前需求保留 activeRequirement 状态，下次 loop 可 resume |

### loop 摘要输出

- 路径：`.phasegate/archive/loop-{timestamp}.md`
- 同时在终端打印简版
- 内容：执行需求列表、每条的结果（pass/fail）、时间戳

### status 命令扩展

- 现有：显示 activeRequirement 和 currentPhase
- 新增：显示"待执行队列 N 条（approved）"，提示用 `loop --dry-run` 查看顺序

---

## 实现步骤

### Step 1 — types.ts

`RequirementEntry` 新增字段：

```ts
priority?: 'high' | 'normal' | 'low'   // 缺省视为 'normal'
approvedAt?: string                      // ISO-8601，approved 时写入
```

`ProgressState` 不新增字段，loop 运行状态不持久化。

### Step 2 — ProgressManager（progress-manager.ts）

**2a. `syncRequirementsFromWorkspace()`**

- 扫描 `.phasegate/requirements/*.md` 时，解析文件 frontmatter（YAML 格式）
- 读取 `priority` 字段，缺失时默认 `'normal'`
- 将 `priority` 写入 `requirements[]` 对应条目
- 需求首次变为 `approved` 时写入 `approvedAt`（已有 approvedAt 则不覆盖）

**2b. 新增 `getQueuedRequirements(cwd: string): RequirementEntry[]`**

- 读取 progress.json，过滤 `status === 'approved'` 的条目
- 按三层排序返回：priority（high < normal < low）→ approvedAt 升序

### Step 3 — 新命令 src/commands/loop.ts

```
loop(options: { dryRun?: boolean })
  1. syncRequirementsFromWorkspace()
  2. if dryRun:
       打印有序队列（序号、名称、priority、approvedAt ?? '—'）
       return
  3. archivePath = `.phasegate/archive/loop-{loop-start-timestamp}.md`
     ensureDir(archive/)
     summaryRows = []
  4. if activeRequirement exists: 执行 run()（resume 当前需求）
       → 若 gate_failed: 记录失败行，打印原因，goto 打印摘要
       → 成功: 追加 summaryRows，syncRequirementsFromWorkspace()
  5. loop:
       next = getQueuedRequirements()[0]
       if !next: 打印"队列已空"，break
       select(next)
       run() → 若 gate_failed: 追加失败行，打印原因，break
       追加 summaryRows
       syncRequirementsFromWorkspace()  // 动态 reload
  6. 将 summaryRows 写入 archivePath
     打印终端简版摘要
```

archive 文件：**每次 `phasegate loop` 调用生成一个新文件**，文件名 timestamp 为 loop 启动时间，不追加到旧文件。格式：

```md
# Loop Summary — {timestamp}

| 需求 | 优先级 | 结果 | 时间 |
|---|---|---|---|
| feature-a | high | pass | 2026-04-09T10:00:00Z |
| feature-b | normal | gate_failed | 2026-04-09T10:45:00Z |

总计：运行 2 条，成功 1 条，失败 1 条
```

### Step 3b — run 命令（src/commands/run.ts）

懒同步也在 `run` 启动时触发：

- `run` 入口调用 `syncRequirementsFromWorkspace()` 后再读取 progress.json
- 确保手动 `phasegate run` 时 priority / approvedAt 同样保持最新

### Step 4 — status 命令（src/commands/status.ts）

输出末尾加一行：

```
待执行队列：3 条（approved）— 运行 `phasegate loop --dry-run` 查看顺序
```

### Step 5 — CLI 入口（src/index.ts）

注册 `loop` 命令，挂载 `--dry-run` flag。

### Step 6 — 文档更新（docs/）

实现完成后，同步更新以下文档：

| 文件 | 需要更新的内容 |
|---|---|
| `docs/core/cli-surface.md` | 新增 `phasegate loop` 和 `phasegate loop --dry-run` 命令说明 |
| `docs/core/progress-model.md` | `RequirementEntry` 新增 `priority`、`approvedAt` 字段的语义说明；懒同步规则 |
| `docs/core/overview.md` | 补充"优先级队列"作为需求池的消费机制 |
| `docs/guides/getting-started.md` | 在"下一步"流程中加入 `loop` 的使用示例 |

### Step 7 — 提示词（prompts/）

**Phase 0（已完成）：**
- `prompts/phase0_requirements.md`：讨论框架改为提案式，新增 priority 建议，输出模板加 frontmatter `priority` 字段
- `prompts/phase0_requirements_en.md`：同上英文版

**Phase 2 废弃提示词清理：**
- `prompts/phase2_review.md` 和 `prompts/phase2_review_zh.md` 已标注 DEPRECATED，但文件仍存在
- 两个文件直接删除。Phase 2 已在运行时完全迁移，文件保留没有价值，且会误导维护者
- 同步检查 `src/` 中是否有任何代码仍引用这两个路径，有则一并清理

---

## 自我 Review

实现完成后，执行以下检查再提交：

### 正确性

- [ ] `getQueuedRequirements` 的排序：high 在 normal 前，normal 在 low 前；同级按 approvedAt 升序
- [ ] frontmatter 缺少 priority 字段时，确实默认 `normal`，不报错
- [ ] `approvedAt` 只在首次 approved 时写入，重复 sync 不覆盖
- [ ] loop resume 逻辑：`activeRequirement` 非 null 时不重新选取，直接 run
- [ ] gate_failed 后 loop 停止，`activeRequirement` 保留在 progress.json（不清空）
- [ ] `--dry-run` 不触发任何写操作，`approvedAt` 缺失时显示 `—` 而非报错
- [ ] loop 结束后 archive 文件已写入，路径正确，archive 目录不存在时自动创建

### 边界情况

- [ ] 需求池为空时，loop 输出提示而非抛出异常
- [ ] 所有需求均为 `draft` 时，队列为空，loop 正常退出
- [ ] 需求文件 frontmatter 格式错误（非合法 YAML）时，降级为 `normal`，不崩溃

### 一致性

- [ ] `RequirementEntry` 新字段在所有创建 `requirements[]` 条目的地方都已补全（含现有测试的 fixture）
- [ ] `types.ts` 改动与 `progress-manager.ts` 的读写行为一致
- [ ] status 命令的队列计数与 `getQueuedRequirements` 返回值一致，不另起炉灶

### 不越界

- [ ] loop 命令不修改 Phase 执行逻辑，只是自动化 select+run 序列
- [ ] 未引入 `loop_mode` 或类似的全局状态标志
- [ ] 未改动 Phase 1-5 的任何执行路径

### 提示词

- [ ] Phase 0 提示词（中英文）已更新为提案式流程，含 priority 字段
- [ ] `phase2_review.md` 和 `phase2_review_zh.md` 已删除
- [ ] 代码中无残留的 phase2 prompt 路径引用

### 文档

- [ ] `cli-surface.md` 已加入 `loop` 命令说明
- [ ] `progress-model.md` 已更新 `RequirementEntry` 字段语义
- [ ] `overview.md` 已补充优先级队列机制
- [ ] `getting-started.md` 已加入 `loop` 使用示例

---

## 程序测试

测试风格与现有测试一致：`ProgressManager` 相关用真实 temp 目录（fse.mkdtemp），命令层用 mock。

### src/core/\_\_tests\_\_/progress-manager.test.ts — 新增用例

**getQueuedRequirements — 排序**

```ts
it('sorts approved requirements: high before normal before low', async () => {
  // 构造 progress.json：3 条 approved，priority 分别为 low / high / normal
  // approvedAt 均不同
  // 期望返回顺序：high → normal → low
})

it('sorts same-priority requirements by approvedAt ascending', async () => {
  // 2 条 normal，approvedAt 不同
  // 期望较早 approvedAt 的在前
})

it('excludes non-approved requirements from queue', async () => {
  // draft / selected / implemented 混入
  // 期望只返回 approved 条目
})
```

**syncRequirementsFromWorkspace — priority 读取**

```ts
it('reads priority from requirement frontmatter', async () => {
  // 写入含 "---\npriority: high\n---" 的 .md 文件
  // sync 后 requirements[0].priority === 'high'
})

it('defaults priority to normal when frontmatter is absent', async () => {
  // 写入无 frontmatter 的 .md 文件
  // sync 后 requirements[0].priority === 'normal'
})

it('does not overwrite existing approvedAt on re-sync', async () => {
  // progress.json 中已有 approvedAt
  // 再次 sync 后 approvedAt 不变
})
```

### src/commands/\_\_tests\_\_/loop.test.ts — 新增文件

命令层 mock `ProgressManager`、`selectRequirement`、`runPhases`。

```ts
it('prints ordered queue and exits when --dry-run', async () => {
  // mock getQueuedRequirements 返回 [high-req, normal-req]
  // 期望输出包含两条需求名，按顺序
  // 期望 runPhases 未被调用
})

it('resumes activeRequirement instead of selecting next', async () => {
  // progress.activeRequirement = 'feature-a'
  // 期望直接调用 run，不调用 select
  // resume 成功后继续消费队列剩余需求
})

it('stops loop and prints error on gate_failed', async () => {
  // mock runPhases 第一次返回 gate_failed
  // 期望 loop 停止，输出失败需求名
  // 期望 activeRequirement 未被清空
})

it('exits cleanly when queue is empty', async () => {
  // mock getQueuedRequirements 返回 []
  // 期望输出"队列已空"，无异常
})

it('reloads queue after each completed requirement', async () => {
  // 第一次 getQueuedRequirements 返回 [req-a]
  // req-a 完成后第二次返回 [req-b]（模拟 Phase 0 期间新增）
  // 期望 req-b 也被执行
})
```

---

## 不在此次范围内

- dependsOn 依赖关系
- 稳定需求 ID
- `--priority` filter flag
- 异常处理 phase
- loop 运行中的并发保护
