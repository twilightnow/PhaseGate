# Testing Guide

- Type: guide
- Status: active
- Reader: both
- Use when: 需要确认默认测试策略和本地验证方式时
- Source of truth: 是
- Update when: 测试命令、默认策略或本地验证约束变化时

## Purpose

保持 PhaseGate 的默认测试循环简单、便宜、可重复。

## Scope

包含：默认测试命令、build 与 test 的类型检查边界、live smoke test、Windows 用法。

不包含：完整验收计划、阶段性任务自检记录。

## Minimal Policy

1. `npm test` 和 `npm run test:unit` 是默认开发循环。
2. 默认测试不得调用真实 AI runner，也不应消耗 token。
3. 真实 AI 验证只放在 `npm run test:live`。
4. `test:live` 只是 smoke test，应使用最小 prompt 和最少上下文。
5. 生产构建和测试类型检查分开处理：`tsconfig.build.json` 用于 build，`tsconfig.test.json` 用于 test type-check。
6. Jest 在当前工程中使用 `--runInBand`，避免 Windows 或沙箱环境中的子进程限制导致 `spawn EPERM`。

## Commands

```bash
npm run build
npm test
npm run test:unit
tsc -p tsconfig.test.json
PHASEGATE_LIVE=1 npm run test:live
```

PowerShell:

```powershell
$env:PHASEGATE_LIVE='1'
npm run test:live
```

## Notes

- `npm run build` 只检查运行时代码，不编译 `src/**/__tests__/**`。
- `tsconfig.test.json` 用于覆盖测试文件的 Jest 类型环境。
- 如果只想快速验证本次 AI 路由相关改动，可以先跑：

```bash
npm test -- ai-runner-routing ai-runner-stream orchestrator run-display
```

## Related

- [`getting-started.md`](./getting-started.md)
- [`review-and-acceptance.md`](./review-and-acceptance.md)
- `tsconfig.build.json`
- `tsconfig.test.json`
