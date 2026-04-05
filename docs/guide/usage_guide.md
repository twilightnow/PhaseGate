# PhaseGate 使用教程

---

## 快速流程

```
安装 → 健康检查 → init → chat（需求确认）→ run（Phase 1-5）
```

---

## 1. 安装与环境

**依赖：**

- Node.js 18+
- npm
- `claude` CLI（`chat` / `run` 命令必须）

```bash
npm install
```

**Claude Code 权限配置（建议首次使用时配置）：**

PhaseGate 会频繁调用 Bash、读写文件。为避免每次都弹出确认提示，在项目根目录的 `.claude/settings.local.json` 中配置：

```json
{
  "permissions": {
    "allow": [
      "Bash(*)",
      "Edit(*)",
      "Write(*)",
      "Read(*)",
      "Glob(*)",
      "Grep(*)"
    ]
  }
}
```

配置后，当前项目内所有工具调用自动允许，无需逐次确认。

**健康检查（建议先跑一次）：**

```bash
npx tsc --noEmit
npm run acceptance:phase2
```

两条都通过，说明 CLI 和依赖图功能正常。

---

## 2. 启动方式

| 场景 | 命令前缀 |
|---|---|
| 开发 / 排查（推荐） | `npx tsx src/index.ts <command>` |
| 构建产物后 | `npm run build && node dist/index.js <command>` |
| 全局安装后 | `npm link` 后使用 `phasegate <command>` |

> 报错时优先用 `npx tsx src/index.ts`，错误信息更直接。

---

## 3. 初始化项目

**先 cd 进目标目录**，再执行：

```bash
cd /path/to/my-project
phasegate init
```

生成结构：

```
my-project/
└── .phasegate/
    ├── requirements/
    │   └── requirements.md    ← 需求草稿模板（可选填写）
    ├── design/
    ├── contracts/
    ├── progress.json
    ├── progress.md
    └── phasegate.config.json
```

---

## 4. Phase 0：需求确认

### 流程

```
（可选）填写 .phasegate/requirements/requirements.md 草稿
    ↓
phasegate chat [--feature <name>]
    ↓ Claude 读取 prompts/phase0_requirements.md 获得指令
    ↓ 扫描已有需求文件 → 讨论 → 生成 requirements/{name}.md
    ↓ 用户手动退出 Claude 会话（Ctrl+C / exit）
    ↓ PhaseGate 自动运行 Gate 检查
    ↓ Gate 通过 → currentPhase 更新为 1
```

### 命令

```bash
phasegate chat                    # 通用需求讨论
phasegate chat --feature login    # 指定特性名
```

### Phase 0 Gate 检查条件

退出 Claude 会话后，PhaseGate 自动验证：

- `.phasegate/requirements/` 下存在至少一个非模板 `.md` 文件
- 每个需求文件包含 `## Description`、`## Scope`、`## Acceptance Criteria`

Gate 失败时会列出具体问题，重新执行 `phasegate chat` 修复后再退出。

### 需求草稿（可选）

`init` 生成的 `requirements/requirements.md` 是空白模板。可以在启动 `chat` 前手工填写想法或已知约束，Claude 进入会话后会先读取这些内容，基于已有内容继续讨论而不是从零开始。

---

## 5. Phase 1-5：驱动各阶段

Phase 0 Gate 通过后，后续所有阶段统一使用：

```bash
phasegate run              # 自动读取 currentPhase 驱动
phasegate run --phase 2    # 手动指定阶段（调试用）
```

| Phase | 内容 | 模式 |
|---|---|---|
| 1 | 设计书生成 | 非交互，AI 自动产出 |
| 2 | 设计 review | 非交互，AI 输出 PASS/FAIL |
| 3 | 并行模块开发 | Orchestrator 编排，多 worker 并发 |
| 4 | 代码 review | 非交互，AI 输出 PASS/FAIL |
| 5 | 验收 | AI 自动验证 + 人工验收指导书 |

> `phasegate run` 在 Phase 0 时会提示使用 `phasegate chat`，不会直接执行。

---

## 6. 辅助命令

```bash
phasegate status           # 查看当前阶段状态
phasegate progress         # 查看完整进度（输出 progress.md）
phasegate review <module>  # 单模块设计 review（需 claude）
```

`progress.json` 是状态的 source of truth，`progress.md` 是人类可读视图，两者保持同步。

---

## 7. 配置

`.phasegate/phasegate.config.json`：

```json
{
  "maxLinesPerFile": 500,
  "minTestCoverage": 80,
  "runner": "claude"
}
```

`runner` 支持 `claude`（默认）、`gemini`、`codex`（别名：`openai`、`chatgpt`）。

---

## 8. 常见问题

**`progress.json not found. Run phasegate init first.`**

当前目录不是 PhaseGate 项目目录，先执行 `phasegate init`。

**`Gate failed: No requirements file found`**

退出 Claude 会话后 Gate 检查失败，说明 AI 没有生成需求文件。重新执行 `phasegate chat`，在会话结束前确认 AI 已写入 `.phasegate/requirements/{name}.md`。

**`Prompt file not found: .../prompts/phase1_design.md`**

PhaseGate 安装目录下的 `prompts/` 文件夹缺失，通常是 `npm run build` 后 `dist/` 没有对应文件。重新 build 或检查 `package.json` 的 `files` 字段是否包含 `prompts`。

**`claude exited with code ...`**

外部 `claude` 命令不可用，检查：
- `claude` 是否已安装
- `claude` 是否在 `PATH` 中

**`Circular dependency: ...`**

`.phasegate/tasks/` 中存在循环依赖，需修改模块划分或依赖关系。

---

## 9. 命令速查

```bash
npx tsc --noEmit                      # 类型检查
npm run acceptance:phase2             # 验收测试
phasegate init                        # 初始化项目
phasegate chat [--feature <name>]     # 需求确认（Phase 0，需 claude）
phasegate run [--phase N]             # 驱动阶段 Phase 1-5（需 claude）
phasegate status                      # 当前阶段状态
phasegate progress                    # 完整进度
phasegate review <module>             # 单模块设计 review（需 claude）
```

开发模式下将 `phasegate` 替换为 `npx tsx src/index.ts`。
