# Testing Guide

- Type: guide
- Status: active
- Reader: both
- Use when: 需要确认默认测试策略和 live runner 检查方式时
- Source of truth: 是
- Update when: 测试命令、默认策略或 live smoke test 约束变化时

## Purpose

保持 PhaseGate 的默认测试循环简单、便宜、可重复。

## Scope

包含：默认测试命令、live smoke test、Windows 用法。

不包含：完整验收计划、阶段性任务自检记录。

## Minimal Policy

1. `npm test` 和 `npm run test:unit` 是默认开发循环。
2. 默认测试不得调用真实 AI runner，也不应消耗 token。
3. 真实 AI 验证只放在 `npm run test:live`。
4. `test:live` 只是 smoke test，应使用最小 prompt 和最少上下文。

## Commands

```bash
npm test
npm run test:unit
PHASEGATE_LIVE=1 npm run test:live
```

PowerShell:

```powershell
$env:PHASEGATE_LIVE='1'
npm run test:live
```

## Related

- [`getting-started.md`](./getting-started.md)
- [`review-and-acceptance.md`](./review-and-acceptance.md)
