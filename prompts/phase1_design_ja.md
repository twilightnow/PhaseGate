# Phase 1: 設計書生成

## あなたのタスク

PhaseGate プロジェクト向けに、モジュール設計書とインターフェース契約を生成してください。
このフェーズは非対話で実行されます。すべての作業を完了し、必要なファイルを書き込み、最後に Phase 1 Summary を出力してください。

---

## 開始前に読むもの

何かを生成する前に、次を読んでください。

1. `.phasegate/requirements/` 配下のすべてのファイル: 確定済み要件
2. `.phasegate/progress.md`: 現在のプロジェクト状態（すでにコンテキストとして注入済み）
3. `docs/03_architecture_constraints.md`: アーキテクチャ制約（すでにコンテキストとして注入済み）
4. プロジェクトの `src/` ディレクトリ構造を走査し、既存レイアウトを把握する

---

## 手順

1. すべての requirements ファイルを解析し、必要なモジュールを特定する。
2. 各モジュールについて、下記の Module Design Book Template を使って `.phasegate/tasks/{module-name}.md` を作成する。
3. すべてのモジュール間インターフェースを特定する。各インターフェースについて、下記の Contract Template を使って `.phasegate/contracts/{InterfaceName}.md` を作成する。
4. `.phasegate/progress.md` に Phase 1 Summary を追記する。

---

## 言語ルール

- 出力ドキュメントは、原則として requirements ファイルの主要言語に合わせてください。
- requirements に複数言語が混在する場合は、現在のシステム locale に対応する言語を優先してください。
- 同一の Phase 1 で生成する design、contract、summary は同じ自然言語で統一し、日本語・英語・中国語を混在させないでください。
- コード、パス、TypeScript の識別子はそのまま保持し、翻訳しないでください。
- 固定アンカー字段 `name`、`description`、`consumers`、`draft`、`finalized` は変更しないでください。
- 後続解析の安定性のため、design 文書内の見出しは英語テンプレートを維持し、`## Dependencies`、`## Status`、`## Definition`、`## Provider`、`## Consumers` は翻訳しないでください。

---

## Module Design Book Template

```markdown
# {ModuleName}

## Responsibility
{このモジュールが何だけを担当するかを 1 文で書く}

## Out of Scope
- {このモジュールが明示的に担当しないもの}

## File Structure
src/{module-name}/
├── index.ts      # 公開 export のみ、ロジックは禁止
├── service.ts    # ビジネスロジック
└── types.ts      # モジュール内ローカル型

## Dependencies
| Interface | Direction |
|---|---|
| {InterfaceName} | CONSUMES |

## Constraints
- Max 500 lines per file
- No direct import of other modules' internal files
- All exported symbols must be typed

## Test Requirements
- Coverage >= 80%
- Must cover: {要件から抽出した主要シナリオ}
```

---

## Interface Contract Template

```markdown
---
name: {InterfaceName}
description: {このインターフェースの目的を 1 文で説明する。orchestrator が必要モジュールを判断できる程度に意味的に明確であること}
consumers:
  - {ModuleName}
---

# {InterfaceName}

## Status
draft

## Definition
\`\`\`typescript
interface {InterfaceName} {
  method(param: Type): ReturnType;
}
\`\`\`

## Provider
- {ModuleName}

## Consumers
- {ModuleName}

## Change Rule
finalized 後に変更する場合は、すべての Consumers へ通知し、Phase 2 review を再実行すること。
\`\`\`

---

## Phase 1 Summary Format

`.phasegate/progress.md` に次のブロックを追記してください。

\`\`\`markdown
## Phase 1 Summary

### Current State
Generated design books: .phasegate/tasks/module-a.md, ...
Generated contracts: .phasegate/contracts/IFoo.md, ...

### Key Decisions
- {このフェーズで行った主要な設計判断}

### Outputs
- .phasegate/tasks/: {N} module design books
- .phasegate/contracts/: {N} interface contracts

### Notes for Phase 2
- {Phase 2 review で重点確認すべき点}
\`\`\`

---

## Gate Conditions（終了前に確認）

- [ ] Every identified module has a `.phasegate/tasks/{module-name}.md`
- [ ] Every cross-module interface has a `.phasegate/contracts/{InterfaceName}.md` with frontmatter
- [ ] The `consumers` field in each contract frontmatter is filled
- [ ] Phase 1 Summary has been appended to `.phasegate/progress.md`
