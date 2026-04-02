# PhaseGate 设计书 — 进度文档规范

> 版本 0.1 | 2026年4月

---

## 概述

进度系统由两个文件组成，职责严格分离：

| 文件 | 用途 | 读写方 |
|---|---|---|
| `progress.json` | 机器可读的状态数据，progress-manager.ts 读写 | orchestrator、所有命令 |
| `progress.md` | 人类可读的展示文档，**仅供阅读，不做机器解析** | AI 追加写入 Phase Summary，用户阅读 |

`progress.json` 是状态的唯一来源（source of truth）。`progress.md` 是它的可读视图，两者内容一致但格式不同。

---

## 文件位置

```
progress.json   （项目根目录，机器读写，source of truth）
progress.md     （项目根目录，人类阅读，仅供展示）
```

---

## progress.json 格式

```json
{
  "projectName": "my-feature",
  "currentPhase": 3,
  "requirements": [
    { "name": "article-summary", "status": "done" }
  ],
  "design": {
    "modules": [
      { "name": "SummaryService", "status": "done" },
      { "name": "CacheRepository", "status": "done" }
    ],
    "contracts": [
      { "name": "ISummaryService", "status": "finalized", "provider": "SummaryService", "consumers": ["SummaryCard"] },
      { "name": "ICacheRepository", "status": "finalized", "provider": "CacheRepository", "consumers": ["SummaryService"] }
    ],
    "reviewPassed": true
  },
  "modules": [
    { "name": "CacheRepository", "status": "done" },
    { "name": "SummaryService", "status": "done" },
    { "name": "SummaryCard", "status": "pending" }
  ],
  "codeReviewPassed": false,
  "blockers": []
}
```

`modules[].status` 可选值：`pending` / `running` / `done` / `failed` / `blocked`

**断点续跑机制：** orchestrator 启动时读取 `modules` 数组，`status === 'done'` 的模块直接跳过，不重新执行。

---

## 文件格式

progress.md 分为两部分：**状态区**（机器可读，AI 频繁更新）和 **Phase Summary 区**（追加写入，阶段完成后写一次，不再修改）。

```markdown
# 项目进度

<!-- ==================== 状态区 ==================== -->

## 当前阶段
阶段3：模块开发中

## 需求
- [x] 需求讨论完成
- [x] 需求文件生成：requirements/article-summary.md

## 设计
- [x] 设计书生成
  - [x] SummaryService 模块
  - [x] CacheRepository 模块
- [x] 接口契约生成
  - [x] ISummaryService
  - [x] ICacheRepository
- [x] 设计书 review 通过

## 模块开发
- [x] CacheRepository — done
- [x] SummaryService — done
- [ ] SummaryCard — blocked（依赖 SummaryService，已完成，等待解锁）

## 接口契约状态
| 接口 | 状态 | 实现方 | 依赖方 |
|---|---|---|---|
| ISummaryService | finalized | SummaryService | SummaryCard |
| ICacheRepository | finalized | CacheRepository | SummaryService |

## 代码 review
- [ ] 待开发完成

## 阻塞项
无

<!-- ==================== Phase Summary 区 ==================== -->
<!-- 每个阶段完成后追加，已写入的 Summary 不可修改 -->

## Phase 1 Summary

### Current State
已生成模块设计书：design/SummaryService.md, design/CacheRepository.md, design/SummaryCard.md
已生成接口契约：contracts/ISummaryService.md, contracts/ICacheRepository.md

### Key Decisions
- SummaryService 不直接访问数据库，通过 ICacheRepository 接口隔离
- SummaryCard 只依赖 ISummaryService，不感知具体实现

### Outputs
- design/：3 个模块设计书
- contracts/：2 个接口契约

### Notes for Phase 2
- 重点 review SummaryService 与 CacheRepository 的边界是否足够清晰

## Phase 2 Summary

### Current State
设计书 review 通过。所有模块职责清晰，接口契约完整，无循环依赖。

### Key Decisions
- ISummaryService 新增 `invalidate()` 方法，review 中发现缺失

### Outputs
- 所有 design/*.md 已定稿
- 所有 contracts/*.md 已定稿（状态改为 finalized）

### Notes for Phase 3
- CacheRepository 无依赖，Wave 1 优先开发
- SummaryService 依赖 ICacheRepository，Wave 2 开发
- SummaryCard 依赖 ISummaryService，Wave 3 开发
```

---

## 更新规则

| 时机 | 操作 | 写入区域 |
|---|---|---|
| 阶段开始 | 更新「当前阶段」字段 | 状态区 |
| 模块开发完成 | 对应模块打 `[x]`，标注 `done` | 状态区 |
| 模块失败 | 标注 `failed`，原因写入「阻塞项」 | 状态区 |
| 模块 blocked | 标注 `blocked`，注明等待条件 | 状态区 |
| 阻塞解除 | 清空阻塞项，更新相关状态 | 状态区 |
| **阶段完成** | **追加 Phase N Summary**（只写一次，不再修改） | **Phase Summary 区** |

**关键规则：**
- Phase Summary 区是 append-only，已写入的内容不可修改
- 下一阶段启动时，只加载上一阶段的 Phase Summary，不需要重新加载全量历史
- Phase Summary 是跨阶段的 context 锚点，必须写得完整准确

---

## 读写权限

- **可读**：所有阶段的 AI（确认全局状态）
- **可写**：当前执行阶段的 AI（只更新自己负责的部分）
- **禁止**：覆盖其他阶段的记录
