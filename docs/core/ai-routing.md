# PhaseGate AI Routing

- Type: core
- Status: active
- Reader: both
- Use when: 需要理解或修改“按担当范围选择 AI CLI”的配置能力时
- Source of truth: 是
- Update when: AI 配置结构、scope 集合、回退规则或 adapter 集合发生变化时

## Purpose

定义 PhaseGate 中按担当范围路由到不同 AI 的当前实现模型，作为配置、调度和测试的统一依据。

## Scope

包含：配置结构、固定 scope 集合、profile 与 scope 的关系、运行时回退规则、与旧 `runner` 配置的兼容方式。

不包含：具体 prompt 内容、各家 CLI 的完整参数协议、自定义 shell 命令 DSL、按模块名或任务名路由 AI。

## Key Facts / Decisions / Constraints

- 当前实现由 `src/core/ai-runner.ts` 在运行时解析 `scope -> profile -> adapter`，再选择实际 CLI 调用协议。
- 路由目标是“PhaseGate 已知如何驱动的 AI CLI 适配器”，不是抽象 provider。
- 当前已适配集合只包含 `claude-code` 和 `codex`。
- 第一版不在 profile 中开放 `command`、`args`、`env` 等自定义字段。
- 旧项目必须继续兼容；未配置路由时，行为应与旧 `runner` 一致。
- `review` 命令当前复用 `phase4` 的 reviewer 路由，不单独定义新的 scope。
- `phase3.coordinator` 已经有真实调用入口：Orchestrator 会在 Phase 3 开始前生成 `.phasegate/scratchpad/coordinator/brief.md`。

## Model

路由设计拆成三层：

- `scope`
  - 表达担当范围，例如 `phase3.coordinator`、`phase3.worker`
- `profile`
  - 表达业务语义上的 AI 角色，例如 `architect`、`reviewer`、`implementer`
- `adapter`
  - 表达 PhaseGate 内部真正知道如何启动和驱动的 AI CLI 适配器，例如 `claude-code`、`codex`

运行时链路：

```text
scope -> profile -> adapter -> runner implementation
```

## Configuration Shape

当前 `.phasegate/phasegate.config.json` 支持以下结构：

```json
{
  "runner": "claude",
  "aiProfiles": {
    "default": {
      "adapter": "claude-code"
    },
    "architect": {
      "adapter": "codex"
    },
    "reviewer": {
      "adapter": "claude-code"
    },
    "implementer": {
      "adapter": "codex"
    }
  },
  "aiRouting": {
    "default": "default",
    "chat": "architect",
    "phase1": "architect",
    "phase2": "reviewer",
    "phase3.coordinator": "architect",
    "phase3.worker": "implementer",
    "phase4": "reviewer",
    "phase5": "reviewer"
  }
}
```

字段约束：

- `aiProfiles`
  - key 是 profile 名称
  - value 第一版只包含 `adapter`
  - `adapter` 允许值只包含当前已适配集合：`claude-code`、`codex`
- `aiRouting`
  - key 是固定 scope 名称
  - value 必须引用一个已定义的 `aiProfiles` key

可选扩展位：

```json
{
  "adapter": "codex",
  "options": {}
}
```

`options` 当前不启用，只作为后续 adapter 专属配置的结构预留。

## Fixed Scopes

当前固定支持以下 scope：

- `default`
- `chat`
- `phase1`
- `phase2`
- `phase3.coordinator`
- `phase3.worker`
- `phase4`
- `phase5`

这些 scope 覆盖了当前 CLI 和调度层真正存在的担当边界。

## Runtime Resolution

运行时从 `scope` 解析到实际 adapter 的顺序：

1. 如果传入的 `scope` 在 `aiRouting` 中存在，则取对应 profile
2. 如果 `aiRouting.default` 存在，则取默认 profile
3. 如果旧配置 `runner` 存在，则映射到兼容 adapter
4. 否则回退到 `claude-code`

额外约束：

- 如果 `aiRouting` 指向未定义的 profile，视为配置错误
- 如果 profile 的 `adapter` 不在支持集合中，视为配置错误
- 配置错误应在 runner 创建阶段尽早失败，而不是等子进程启动失败后才暴露

旧 `runner` 到 adapter 的兼容映射：

- `claude` -> `claude-code`
- `codex` -> `codex`
- `openai` -> `codex`
- `chatgpt` -> `codex`

当前版本不再把 `gemini` 视为已适配目标；若旧配置仍写 `gemini`，应明确报错。

## Adapter Capability Boundary

adapter 允许存在能力差异，但差异必须由代码层显式声明，不能由配置层猜测。

当前至少要区分这些能力维度：

- 是否支持非交互 `run`
- 是否支持 `fork`
- 是否支持交互 `chat`
- 是否支持流式 tool event
- prompt 是走 `stdin` 还是命令参数

这些能力属于 adapter 定义的一部分，不属于 `aiProfiles` 配置。

运行时规则：

- 如果某个 scope 对应的调用模式不被 adapter 支持，应在 `createRunner(..., scope)` 阶段直接失败
- 不允许静默切换到别的 adapter
- 当前版本不定义自动降级

## Integration

当前代码入口为：

```ts
createRunner(projectRoot, scope?)
```

当前映射关系：

- `phasegate chat` -> `chat`
- Phase 1 -> `phase1`
- Phase 2 -> `phase2`
- Phase 3 coordinator -> `phase3.coordinator`
- Phase 3 worker -> `phase3.worker`
- Phase 4 -> `phase4`
- Phase 5 -> `phase5`
- `phasegate review <module>` -> `phase4`

## Compatibility Boundary

- 旧配置只有 `runner` 时，应继续正常工作
- 新配置存在 `aiProfiles` / `aiRouting` 时，应优先使用新路由规则
- `runner` 在过渡期内仍保留，用作兼容回退，不作为第一优先级配置
- 文档和代码都应避免继续把 `provider` 当作主抽象

## Out of Scope for V1

- 自定义 CLI 可执行文件路径
- 每个 profile 自定义 `runArgs` / `chatArgs` / `env`
- 任意 shell 命令模板
- 不同 phase 使用不同 prompt transport 策略
- 动态 discovery 新 scope

## Related

- [`overview.md`](./overview.md)
- [`workflow-phases.md`](./workflow-phases.md)
- [`cli-surface.md`](./cli-surface.md)
- `src/core/ai-runner.ts`
- `src/core/phase-executor.ts`
- `src/core/orchestrator.ts`
