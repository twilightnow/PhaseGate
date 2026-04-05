# phasegate.config.json 配置指南

`.phasegate/phasegate.config.json` 是项目级配置文件，由 `phasegate init` 生成。

---

## 默认内容

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

---

## 配置项说明

### `runner`

**类型：** `string`  
**默认值：** `"claude"`

指定驱动各阶段的 AI CLI 工具。PhaseGate 通过子进程调用该命令。

| 值 | 对应命令 | 说明 |
|---|---|---|
| `"claude"` | `claude` | Anthropic Claude CLI（默认） |
| `"gemini"` | `gemini` | Google Gemini CLI |
| `"codex"` | `codex` | OpenAI Codex CLI |
| `"openai"` | `codex` | `"codex"` 的别名 |
| `"chatgpt"` | `codex` | `"codex"` 的别名 |

**前提条件：** 对应的 CLI 工具必须已安装并在 `PATH` 中可用。切换 runner 前执行健康检查：

```bash
claude --version   # 或 gemini --version / codex --version
```

---

### `maxLinesPerFile`

**类型：** `number`  
**默认值：** `500`

单文件最大行数限制。`constraint-checker` 模块在 Phase 4 代码 review 时检查此约束。

超出限制的文件会被标记为违规，Phase 4 Gate 将失败。

**修改建议：** 不建议调大。500 行已经是合理上限，超出通常意味着模块需要拆分。

---

### `minTestCoverage`

**类型：** `number`（百分比，0-100）  
**默认值：** `80`

最低测试覆盖率要求。Phase 5 验收时检查。

**调整场景：**
- 原型/POC 项目：可降低至 60
- 核心业务模块：建议保持 80 或更高

---

## 完整配置示例

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

---

## 注意事项

- 配置文件在每次 CLI 命令执行时读取，修改后立即生效，无需重启
- 配置文件纳入 git，团队共享同一套约束
- 不支持环境变量覆盖；如需临时修改，直接编辑文件，用完改回
