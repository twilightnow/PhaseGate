# PhaseGate Phase 2 — 人工验收指导书

> 版本 0.2 | 2026年4月
> 本文件由 AI 自动生成，供人工验收使用。完成所有检查项后即可推进至 Phase 3。

---

## 验收范围

Phase 2 输出物：PhaseGate CLI 工具（`phasegate` 命令）全部模块的实现代码。

---

## 前置要求

```powershell
cd PhaseGate/
npm install          # 安装依赖
npx tsc --noEmit     # 确认无编译错误（应无任何输出）
```

---

## 验收清单

### A. 静态检查

| # | 检查项 | 预期结果 | 通过/失败 |
|---|---|---|---|
| A-1 | `npx tsc --noEmit` | 无输出（0 errors） | |
| A-2 | `src/commands/` 所有文件行数 ≤ 500 | 见下方命令 | |
| A-3 | `src/core/` 所有文件行数 ≤ 500 | 见下方命令 | |
| A-4 | `src/core/` 各文件内**无** `console.log` 调用 | 见下方命令 | |
| A-5 | 依赖方向正确：`commands/ → core/ → types.ts`（无反向依赖） | 阅读 import 链确认 | |

**A-2/A-3 验证命令（Node.js，跨平台）：**
```powershell
node -e "
const fs = require('fs'), path = require('path');
const check = dir => fs.readdirSync(dir).filter(f => f.endsWith('.ts')).forEach(f => {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n').length;
  console.log((lines <= 500 ? 'PASS' : 'FAIL!!!'), lines + ' lines:', path.join(dir, f));
});
check('src/commands');
check('src/core');
"
# 期望：所有行输出 PASS
```

**A-4 验证命令（Node.js，跨平台）：**
```powershell
node -e "
const fs = require('fs'), path = require('path');
let found = false;
fs.readdirSync('src/core').filter(f => f.endsWith('.ts')).forEach(f => {
  if (/console\./.test(fs.readFileSync(path.join('src/core', f), 'utf8'))) {
    console.log('FAIL:', f, '包含 console 调用');
    found = true;
  }
});
if (!found) console.log('PASS: src/core/ 无 console 调用');
"
```

> 也可在 VS Code 全局搜索 `console.`，将范围限定为 `src/core/`，确认无匹配结果。

---

### B. 接口契约对照

对照 `docs/05_cli_design.md` 逐一确认实现与设计书一致。

| # | 接口 | 文件 | 检查要点 | 通过/失败 |
|---|---|---|---|---|
| B-1 | `IProgressManager` | `src/core/progress-manager.ts` | 所有 7 个方法签名与设计书一致 | |
| B-2 | `IAiRunner` | `src/core/ai-runner.ts` | `run / fork / chat` 签名一致 | |
| B-3 | `IDependencyGraph` | `src/core/dependency-graph.ts` | `build / getExecutionWaves` 签名一致 | |
| B-4 | `IOrchestrator` | `src/core/orchestrator.ts` | `run / retry` 签名一致 | |
| B-5 | `IConstraintChecker` | `src/core/constraint-checker.ts` | `check` 桩实现，始终返回 `passed: true` | |
| B-6 | `ModuleNode` | `src/core/dependency-graph.ts` | 四个字段均存在（name / designFile / contractFiles / dependencies） | |
| B-7 | `ModuleRunResult` | `src/core/orchestrator.ts` | 五个字段均存在（moduleName / status / durationMs / report? / error?） | |

---

### C. 功能行为验证

**先配置 CLI 调用方式（二选一）：**

方案一：全局安装（推荐）
```powershell
cd C:\path\to\PhaseGate
npm link
# 之后可直接使用 phasegate 命令
```

方案二：PowerShell 函数（无需全局安装）
```powershell
# 在当前 PowerShell 会话中执行（将路径替换为实际路径）
function phasegate { npx tsx C:\path\to\PhaseGate\src\index.ts @args }
```

**先初始化测试项目：**
```powershell
# 在用户临时目录下创建测试目录
New-Item -ItemType Directory -Force -Path "$env:TEMP\pg-test"
Set-Location "$env:TEMP\pg-test"
phasegate init my-test-project
```

| # | 命令 | 预期输出 | 通过/失败 |
|---|---|---|---|
| C-1 | `phasegate init my-project`（新目录） | 打印 ✓ 初始化成功；生成 `progress.json` / `progress.md` / `phasegate.config.json` / `requirements/` / `design/` / `contracts/` | |
| C-2 | `phasegate init`（已存在） | 打印错误提示，退出码非 0 | |
| C-3 | `phasegate status`（已初始化目录） | 打印项目概览（Phase 0、空列表） | |
| C-4 | `phasegate status`（未初始化目录） | 打印错误，提示运行 `phasegate init` | |
| C-5 | `phasegate progress`（已初始化） | 打印 `progress.md` 全文 | |
| C-6 | `phasegate --help` | 列出所有子命令：init / status / run / review / chat / progress | |
| C-7 | `phasegate run --help` | 显示 `--phase` 选项说明 | |
| C-8 | `phasegate review --help` | 显示 `<module>` 参数说明 | |

**C-1 详细验证（目录结构）：**
```powershell
# 列出目录内容
dir "$env:TEMP\pg-test\my-project"
# 预期：requirements/  design/  contracts/  progress.json  progress.md  phasegate.config.json

# 查看 progress.json 内容
Get-Content "$env:TEMP\pg-test\my-project\progress.json"
# 预期：JSON 包含 projectName="my-project", currentPhase=0, 空数组字段
```

---

### D. progress.md 格式验证

| # | 检查项 | 表现 | 通过/失败 |
|---|---|---|---|
| D-1 | `progress.md` 包含状态区标记 | 文件头部存在 `<!-- ==================== 状态区 ====================` | |
| D-2 | `progress.md` 包含 Phase Summary 区标记 | 文件中存在 `<!-- ==================== Phase Summary 区 ====================` | |
| D-3 | 状态区内容与 `progress.json` 一致 | 手动对照 phase / projectName 字段 | |

---

### E. 依赖图逻辑验证（单元级）

创建测试用设计书 + 契约，验证 `DependencyGraph` 行为。

**测试文件准备（Node.js 脚本，跨平台）：**

将以下内容保存为 `prepare-test.js`，在 PhaseGate 目录下运行：

```javascript
// prepare-test.js
const fs = require('fs');
const path = require('path');
const testDir = path.join(process.env.TEMP || '/tmp', 'pg-test', 'my-project');
const designDir = path.join(testDir, 'design');
const contractsDir = path.join(testDir, 'contracts');

fs.mkdirSync(designDir, { recursive: true });
fs.mkdirSync(contractsDir, { recursive: true });

fs.writeFileSync(path.join(designDir, 'module-a.md'), [
  '# module-a',
  '## Dependencies',
  '| Dependency | Why |',
  '|---|---|',
].join('\n'));

fs.writeFileSync(path.join(designDir, 'module-b.md'), [
  '# module-b',
  '## Dependencies',
  '| Dependency | Why |',
  '|---|---|',
  '| module-a | needs A |',
].join('\n'));

fs.writeFileSync(path.join(contractsDir, 'IFoo.md'), [
  '---',
  'name: IFoo',
  'description: Foo interface',
  'consumers:',
  '  - module-b',
  '---',
  '# IFoo contract',
].join('\n'));

console.log('测试文件已创建：', testDir);
```

```powershell
node prepare-test.js
```

**验证脚本（保存为 `test-dag.ts`，在 PhaseGate 目录下运行）：**
```typescript
// test-dag.ts
// 放在 PhaseGate 根目录下直接运行
import { DependencyGraph } from './src/core/dependency-graph';
import * as path from 'path';
const testDir = path.join(process.env.TEMP ?? 'C:\\Temp', 'pg-test', 'my-project');
const dg = new DependencyGraph();
dg.build(testDir).then((nodes) => {
  console.log('Nodes:', nodes.map(n => n.name));
  const waves = dg.getExecutionWaves(nodes);
  console.log('Wave 0:', waves[0]?.map(n => n.name)); // ['module-a']
  console.log('Wave 1:', waves[1]?.map(n => n.name)); // ['module-b']
  const b = nodes.find(n => n.name === 'module-b');
  console.log('module-b contracts:', b?.contractFiles);
  const a = nodes.find(n => n.name === 'module-a');
  console.log('module-a contracts (should be empty):', a?.contractFiles);
});
```

```powershell
npx tsx test-dag.ts
```

| # | 期望输出 | 通过/失败 |
|---|---|---|
| E-1 | Wave 0 = `['module-a']` | |
| E-2 | Wave 1 = `['module-b']` | |
| E-3 | `module-b.contractFiles` 包含 `IFoo.md` 路径 | |
| E-4 | `module-a.contractFiles` 为空数组（consumers 过滤生效） | |

---

### F. 循环依赖检测验证

将以下内容追加到 `prepare-test.js` 底部（或单独保存为 `prepare-cycle.js`）：

```javascript
// prepare-cycle.js
const fs = require('fs');
const path = require('path');
const testDir = path.join(process.env.TEMP || '/tmp', 'pg-test', 'my-project');
const designDir = path.join(testDir, 'design');

fs.writeFileSync(path.join(designDir, 'module-c.md'), [
  '# module-c',
  '## Dependencies',
  '| Dependency | Why |',
  '|---|---|',
  '| module-b | needs B |',
].join('\n'));

// 让 module-b 也依赖 module-c → 形成环路
fs.writeFileSync(path.join(designDir, 'module-b.md'), [
  '# module-b',
  '## Dependencies',
  '| Dependency | Why |',
  '|---|---|',
  '| module-a | needs A |',
  '| module-c | cycle! |',
].join('\n'));

console.log('循环依赖测试文件已创建');
```

```powershell
node prepare-cycle.js
```

修改 `test-dag.ts`，用 try/catch 捕获错误：

```typescript
// test-dag.ts（循环依赖版本）
import { DependencyGraph } from './src/core/dependency-graph';
import * as path from 'path';
const testDir = path.join(process.env.TEMP ?? 'C:\\Temp', 'pg-test', 'my-project');
const dg = new DependencyGraph();
dg.build(testDir)
  .then(() => {
    console.log('ERROR: 未检测到循环依赖（应抛出错误）');
  })
  .catch((err: Error) => {
    console.log('捕获到错误:', err.message);
    // 确认错误信息包含 "Circular dependency"
  });
```

```powershell
npx tsx test-dag.ts
```

| # | 期望 | 通过/失败 |
|---|---|---|
| F-1 | `dg.build()` 抛出含 `Circular dependency` 字样的错误，控制台打印 `捕获到错误: ... Circular dependency ...` | |

---

### G. 自检发现问题的修正确认

| # | 问题 | 修正内容 | 通过/失败 |
|---|---|---|---|
| G-1 | `validateNoCycles()` DFS 的 `inStack` 管理不正确 | 改写为迭代式 DFS（`iterative DFS` + `path` 数组） | |
| G-2 | `run.ts` 的 Phase 0 调用了非交互式 `run()` | Phase 0 改为调用 `chat()` | |
| G-3 | `runSinglePhase()` 存在未使用的 `pm` 参数 | 已删除该参数 | |

---

## 合格基准

- **A-1（编译）为必要条件** — 有错误则不可受理
- **B-1 〜 B-7（接口一致性）** — 全部通过为必须
- **C-1 〜 C-8（功能测试）** — 全部通过为必须
- D / E / F 为补充验证（任意一项 FAIL 须修正后重新测试）
- G-1 〜 G-3 为实现层修正确认（代码级别确认）

---

## 合格后的下一步

Phase 2 合格 → 进入 Phase 3（并行模块开发）。

Phase 3 开始前确认：
1. 将 `progress.json` 的 `currentPhase` 更新为 `3`
2. `design/` 目录下所有模块设计书已存在
3. `contracts/` 目录下所有接口契约已存在（含 YAML frontmatter）

```powershell
phasegate status   # 确认 currentPhase: 3
phasegate run      # 启动 Phase 3 Orchestrator（仅在 design/ 已就绪时运行）
```

---

## 已知限制（Phase 3 及后续处理）

| 限制 | 详情 |
|---|---|
| `ConstraintChecker` 为桩实现 | 行数检查、循环依赖检查、测试覆盖率检查将在 Phase 3 实现 |
| `ClaudeRunner` 的 claude CLI 路径 | 需要 `claude` 命令存在于 PATH 中。后续计划通过 `phasegate.config.json` 的 `runner` 字段切换 |
| `fork()` 的报告解析 | 将 claude 的 stdout 解析为 WorkerReport 格式。claude 需按指定格式输出才能正确工作 |
| `core/` 缺少 `index.ts` | 架构约束"模块通过 index.ts 对外导出"尚未落实，Phase 3 补充 |

---

*文档结束*
