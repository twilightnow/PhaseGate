# Review And Acceptance

- Type: guide
- Status: active
- Reader: both
- Use when: 需要做 Phase 4/5 人工检查，或核对当前实现是否达到可交付状态时
- Source of truth: 是
- Update when: review / acceptance 流程、关键检查项或命令变化时

## Purpose

保留最有价值的人工检查入口，去掉过长且易过时的细节清单。

## Scope

包含：人工 review 的最小检查项、Acceptance 前置条件、建议顺序。

不包含：历史版长表格、自定义项目级验收标准。

## Before Acceptance

- `npm install`
- `npx tsc --noEmit`
- `npm test`
- 必要时执行 `PHASEGATE_LIVE=1 npm run test:live`

## Review Focus

- 命令是否能在正确 phase 下运行
- `progress.json` 与 `progress.md` 是否同步
- `.phasegate/tasks/` 与 `.phasegate/contracts/` 是否能支撑 Phase 2 / 3
- Phase 3 失败模块是否会阻断下游模块
- `review <module>` 是否能对指定模块工作

## Acceptance Notes

- 当前 Phase 4 gate 依赖 `progress.md` 中存在 `## Phase 4 Summary`
- 当前 Phase 5 更接近“最后一轮 prompt 驱动检查”，不是完整工单系统
- 如果需要项目级验收模板，应在具体项目中单独维护，不放回通用主文档

## Related

- [`testing.md`](./testing.md)
- [`../core/workflow-phases.md`](../core/workflow-phases.md)
- [`../core/progress-model.md`](../core/progress-model.md)
