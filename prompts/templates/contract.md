---
name: {InterfaceName}
description: {接口用途，一句话，需足够清晰使 orchestrator 可判断哪些模块需要它}
consumers:
  - {ModuleName}
---

# {InterfaceName}

## Status
draft

## Definition
```typescript
interface {InterfaceName} {
  method(param: Type): ReturnType;
}
```

## Provider
- {ModuleName}

## Consumers
- {ModuleName}

## Change Rule
接口 finalized 后任何变更需通知所有 Consumers，并重新执行 Phase 2 review。
