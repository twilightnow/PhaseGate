# PhaseGate 功能检查指导

按 Phase 梳理的当前实现状态与验证项。用于初版开发完成后的系统性自检。

---

## 先决条件

```bash
npm run build        # 确认 tsc 编译通过，dist/ 存在
npm link             # 全局安装，或用 node dist/index.js 代替 phasegate
```

---

## Phase 0a — `phasegate init`

**状态：可用 ✅**

验证项：

- [x] 运行后 `.phasegate/requirements/`、`.phasegate/tasks/`、`.phasegate/contracts/` 全部创建
- [x] `.phasegate/requirements/requirements.md` 存在（locale 对应模板）
- [x] `.phasegate/progress.json` 存在，`currentPhase` 为 `0`
- [x] `.phasegate/progress.md` 存在，Status Section 生成正确
- [x] `.phasegate/phasegate.config.json` 存在
- [x] 重复执行 `init` 时报错退出（已有 guard）

---

## Phase 0b — `phasegate chat`

**状态：可用 ✅**（支持 zh / ja / en）

### Gate 逻辑

`checkPhase0Gate` 本身逻辑正确：排除初始模板文件（`requirements.md`），检查其他 `.md` 文件是否包含必要 section，支持多 locale。如果 chat 能正确启动，gate 可正常工作。

### 验证项

- [x] 手动运行 `claude --help`，确认 system prompt 的正确 flag 写法
- [x] `chat` 启动后 Claude 是否按 Phase 0 prompt 行事（引导需求讨论）
- [x] 会话结束后 `.phasegate/requirements/{feature-name}.md` 是否被写入
- [x] Gate 检查通过后 `currentPhase` 变为 `1`

---

## Phase 1 — `phasegate run`（Design Generation）

**状态：核心路径可用，已补齐推进与状态同步 ✅**

### 已知问题

**已修复** — `src/commands/run.ts:runSinglePhase()` 在 Phase 1 完成后会扫描 `.phasegate/tasks/*.md` 与 `.phasegate/contracts/*.md`，同步回 `progress.json`，并将 `currentPhase` 推进到 `2`。

**潜在问题** — `runner.run()` 以 `claude --print` 非交互模式执行，prompt 中要求写文件。Claude 能否实际执行 file write 取决于运行环境是否允许工具调用。

**路径说明** — `docs/03_architecture_constraints.md` 是 PhaseGate 自身 repo 的文档路径，用户项目中不存在。`buildContextPrompt()` 有 `pathExists` 检查，会静默跳过，影响可控。

### 验证项

- [ ] Phase 1 运行后 `.phasegate/tasks/*.md` 是否被创建
- [ ] `.phasegate/contracts/*.md` 是否被创建（含 YAML frontmatter）
- [ ] `progress.json` 中 `design.modules` / `design.contracts` 是否已同步
- [ ] `currentPhase` 是否变为 `2`
- [ ] 直接再次执行 `phasegate run` 时是否进入 Phase 2

---

## Phase 2 — `phasegate run`（Design Review）

**状态：输出无效化，无 gate 逻辑 ⚠️**

### 已知问题

**问题 1** — `prompts/phase2_review.md:4` 引用 `docs/01_workflow_phases.md`，该路径是 PhaseGate 自身 repo 的文档，用户项目中不存在。

**问题 2** — `runner.run()` 返回字符串直接 `console.log`，PASS/FAIL 结论只打印不处理，`progress.json` 不更新，phase 不推进。

### 验证项

- [ ] AI 能否读取 `.phasegate/tasks/` 和 `.phasegate/contracts/` 并输出评审结论
- [ ] 输出中是否包含 `PASS` 或 `FAIL`
- [ ] `currentPhase` 是否变为 `3`（预期：**不会**，bug）
- [ ] 用 `phasegate run --phase 3` 可绕过继续

---

## Phase 3 — `phasegate run`（Parallel Module Development）

**状态：结构完整，有两处已知缺陷 ⚠️**

### 已知问题

**缺陷 1** — `src/core/constraint-checker.ts:23`：`ConstraintChecker.check()` 是 stub 实现，永远返回 `passed: true`。Phase 3 前置约束检查无实际意义。

**缺陷 2** — `runner.fork()` 依赖 AI 输出严格符合 WorkerReport markdown 格式来判断成功/失败。如果 Claude 输出格式有偏差，`parseWorkerReport()` 静默返回 `result: 'failed'`，模块被标记失败但无明确报错。

**这是唯一会自动推进 phase 的地方** ✅ — 所有模块完成后调用 `pm.updatePhase(cwd, 4)`。

### 验证项

- [ ] `.phasegate/tasks/*.md` 存在（Phase 1 的产物）
- [ ] `DependencyGraph.build()` 能正确构建 DAG，各模块依赖关系正确
- [ ] 并发 worker 全部启动（`Promise.all` 波次执行）
- [ ] 每个 worker 的 `.phasegate/scratchpad/{module}/report.json` 写入成功
- [ ] 最终 `currentPhase` 自动变为 `4`

---

## Phase 4 — `phasegate run`（Code Review）

**状态：与 Phase 2 同等问题，输出打印即止 ⚠️**

### 已知问题

- `runner.run()` 结果只打印，不更新 `progress.json`，phase 不推进
- 无 gate 逻辑，code review PASS 后无自动状态变更

### 验证项

- [ ] AI 能否读取 `src/` 下的源码并输出评审结论
- [ ] 用 `phasegate run --phase 5` 可手动推进到 Phase 5

---

## Phase 5 — `phasegate run`（Acceptance）

**状态：与 Phase 2/4 同等问题 ⚠️**

### 已知问题

- 同 Phase 4：输出打印即止，phase 不推进，无 gate 逻辑

### 验证项

- [ ] AI 能否对比需求与实现并输出验收结论

---

## 附加命令

| 命令 | 状态 | 说明 |
|---|---|---|
| `phasegate status` | 可用 ✅ | 读 `progress.json` 渲染当前状态 |
| `phasegate review <module>` | 可用 ✅ | 按设计文件对单个模块独立跑评审 |
| `phasegate run --phase <n>` | 可用 ✅ | 强制指定 phase，可绕开推进 bug |

---

## 修复优先级汇总

| 优先级 | 文件 | 问题 |
|---|---|---|
| P1 | `src/commands/run.ts` | Phases 1/2/4/5 缺少 `pm.updatePhase()` 调用 |
| P1 | `src/commands/run.ts` | Phases 1/2/4/5 缺少 gate 检查逻辑 |
| P2 | `src/core/constraint-checker.ts` | stub 实现，需补充真实检查（行数、循环依赖等） |
| P3 | `prompts/phase2_review.md` | 引用了用户项目中不存在的文档路径 |

---

## 推荐验证顺序

1. `phasegate init` — 验证目录结构
2. 手动修复 P0 bug 后，测试 `phasegate chat`
3. 手动写一个最小 requirements 文件，用 `phasegate run --phase 1` 跑 Phase 1
4. 确认 design 文件生成后，继续 Phase 2 → Phase 3
5. Phase 3 是端到端最复杂的一步，建议用只有一个模块的最小项目验证
