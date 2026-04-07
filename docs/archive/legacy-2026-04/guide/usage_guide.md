# PhaseGate 使用指导

## 概览

PhaseGate 的典型流程是：

1. 初始化项目
2. 用 `chat` 完成 Phase 0 需求整理
3. 用 `run` 推进 Phase 1 到 Phase 5
4. 用 `status` 和 `progress` 查看当前状态
5. 用 `review` 对指定模块做补充检查

---

## 1. 环境准备

要求：

- Node.js 18+
- npm
- 可用的 AI CLI，例如 `claude`

安装依赖：

```bash
npm install
```

本地验证：

```bash
npx tsc --noEmit
npm test
```

---

## 2. 启动方式

开发阶段推荐直接用源码运行：

```bash
npx tsx src/index.ts <command>
```

构建后运行：

```bash
npm run build
node dist/index.js <command>
```

如果已经做了全局链接，也可以直接运行：

```bash
phasegate <command>
```

---

## 3. 初始化项目

进入你的项目目录后执行：

```bash
phasegate init
```

初始化后会生成 `.phasegate/` 目录，通常包括：

- `requirements/`
- `design/`
- `contracts/`
- `progress.json`
- `progress.md`
- `phasegate.config.json`

---

## 4. Phase 0：需求整理

使用：

```bash
phasegate chat
phasegate chat --feature login
```

说明：

- `chat` 会进入需求整理流程
- AI 会把整理结果写入 `.phasegate/requirements/`
- 当 Phase 0 gate 通过后，项目会进入 Phase 1

---

## 5. Phase 1 到 Phase 5

推进当前阶段：

```bash
phasegate run
```

指定阶段运行：

```bash
phasegate run --phase 2
```

阶段说明：

- Phase 1：生成设计
- Phase 2：设计评审
- Phase 3：按模块并行执行
- Phase 4：代码评审
- Phase 5：验收

一般情况下，优先使用 `phasegate run`，只在调试时使用 `--phase N`。

---

## 6. 状态查看

查看当前阶段和项目状态：

```bash
phasegate status
```

查看进度文档：

```bash
phasegate progress
```

对指定模块执行 review：

```bash
phasegate review <module>
```

说明：

- `progress.json` 是机器状态的真实来源
- `progress.md` 是给人读的进度摘要

---

## 7. 配置

配置文件位置：

` .phasegate/phasegate.config.json `

示例：

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

`runner` 目前支持：

- `claude`
- `gemini`
- `codex`
- `openai`
- `chatgpt`

---

## 8. 测试使用建议

为了减少 token 消耗，测试分两种用法。

日常开发默认只跑本地测试：

```bash
npm test
npm run test:unit
```

这两条不应该调用真实 AI，也不应该产生 token 消耗。

只有在你需要确认“真实 AI runner 还能正常工作”时，才跑 live smoke test：

```bash
PHASEGATE_LIVE=1 npm run test:live
```

PowerShell 下这样写：

```powershell
$env:PHASEGATE_LIVE='1'
npm run test:live
```

说明：

- `test:live` 只是最小连通性测试
- 它验证真实 runner 是否可用
- 它不等于完整任务验收
- 完整真实任务验证应单独手动执行，不要混进默认测试

推荐日常节奏：

1. 改代码后先跑 `npm test`
2. 怀疑 AI 接入有问题时再跑 `test:live`
3. 只有需要端到端确认时才跑真实完整任务

---

## 9. 常见问题

### `progress.json not found. Run phasegate init first.`

说明当前目录还没有初始化，先执行：

```bash
phasegate init
```

### `Gate failed: No requirements file found`

说明 Phase 0 还没有生成有效需求文件。重新运行：

```bash
phasegate chat
```

### `Prompt file not found`

通常说明 `prompts/` 没有正确带上，检查：

- 项目结构是否完整
- 是否在正确目录下运行
- 是否已经正确构建和发布

### `claude exited with code ...`

通常检查这几项：

- `claude` 是否已安装
- `claude` 是否在 `PATH` 中
- 当前环境是否允许 CLI 正常执行

### `Circular dependency: ...`

说明模块依赖存在循环，需要调整 `.phasegate/tasks/` 或相关设计依赖。

---

## 10. 常用命令速查

```bash
npx tsc --noEmit
npm test
npm run test:unit
npm run test:live
npm run acceptance:phase2
phasegate init
phasegate chat [--feature <name>]
phasegate run [--phase N]
phasegate status
phasegate progress
phasegate review <module>
```

开发阶段如果没有做全局链接，可以把 `phasegate` 换成：

```bash
npx tsx src/index.ts <command>
```
