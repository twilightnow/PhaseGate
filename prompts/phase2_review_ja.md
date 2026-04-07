# Phase 2：設計書レビュー

## あなたのタスク

Phase 1 で生成されたすべてのモジュール設計書とインターフェース契約に対して、2 パスのレビューを実施してください。
非対話方式で実行します。両パスを完了し、可能な範囲で問題を修正し、未解決の `P0` 問題がない限り Phase 2 を通過させてください。

---

## 開始前に読み込むもの

### Pass 1（AI 自己チェック — 要件との照合）用
1. `.phasegate/progress.md` — 現在のフェーズが PHASE_2 であることを確認し、**Phase 1 Summary** ブロックをコンテキストアンカーとして読み込む
2. `.phasegate/requirements/*.md` — すべての確定済み要件（Scope、Acceptance Criteria、Edge Cases）
3. `.phasegate/tasks/*.md` — すべてのモジュール設計書
4. `.phasegate/contracts/*.md` — すべてのインターフェース契約

### Pass 2（独立レビュー — 空コンテキスト）用
以下**のみ**を読み込む。要件・progress・フェーズサマリーは読み込まないこと：
1. `.phasegate/tasks/*.md`
2. `.phasegate/contracts/*.md`

---

## Pass 1：AI 自己チェック

すべての設計書と契約を順番に確認し、以下のチェック項目をすべて検証してください。

### モジュール設計書（`.phasegate/tasks/*.md`）
- [ ] `Responsibility` は厳密に 1 つの関心事を記述する単一の文になっている
- [ ] `Out of Scope` が存在し、空でない
- [ ] 2 つのモジュールが重複した責務を持っていない
- [ ] `File Structure` に `index.ts`（export のみ）、`service.ts`（ロジック）、`types.ts`（ローカル型）が含まれている
- [ ] `Dependencies` テーブルのすべてのインターフェースに `.phasegate/contracts/` 内に対応する契約が存在する
- [ ] `Constraints` に 500 行制限・クロスモジュール内部 import 禁止・型付き export の要件が記載されている
- [ ] `Test Requirements` にカバレッジ ≥ 80% と要件に対応するシナリオが記載されている

### インターフェース契約（`.phasegate/contracts/*.md`）
- [ ] すべての契約ファイルに `name`、`description`、`consumers` フィールドを含む YAML frontmatter がある
- [ ] `description` は orchestrator がどのモジュールに契約を注入するか判断できるほど意味的に明確である
- [ ] `consumers` はすべての設計書の `Dependencies` テーブルと一致している（不一致がない）
- [ ] `Provider` モジュールが明記されている
- [ ] `Definition` ブロックに有効かつ完全に型付けされた TypeScript インターフェースが含まれている
- [ ] `Status` が `draft` である
- [ ] `Change Rule` セクションが存在する

### クロスバリデーション（要件 ↔ 設計書）
- [ ] 要件のすべての Acceptance Criteria が、少なくとも 1 つのモジュールの `Responsibility` とマッピングされている
- [ ] 要件のすべての Edge Cases が、いずれかのモジュールの `Responsibility` で処理されているか、`Out of Scope` で明示的に除外されている
- [ ] 循環依存が存在しない：すべての `Dependencies` チェーンを追跡し、A → B → … → A の循環がないことを確認する

---

## Pass 2：独立レビュー

`.phasegate/tasks/*.md` と `.phasegate/contracts/*.md` のみを読み込む。他のコンテキストなし。

Pass 2 は確認重視ですが、**読み取り専用ではありません**。Pass 2 で残っている問題が見つかった場合は、合理的な範囲で対応する設計書または契約を修正し、影響を受ける項目を再確認してください。未解決の `P0` 問題だけが Phase 2 の通過をブロックします。

各モジュール設計書について、以下の質問に答えてください：
1. 設計書と注入された契約の知識だけで、このモジュールを実装できるか？
2. 消費する契約の各メソッドシグネチャは、契約定義のみから自明に理解できるか？
3. 契約に新しい Consumer を追加した場合、既存の Consumer が破壊されるか？
4. `Dependencies` テーブルに記載されていない暗黙的なランタイム依存関係はあるか？

---

## 判定

両パス完了直後に、各問題へ以下の重大度を付けてください：

- `P0`：Phase 3 へ安全に進めない。PASS 前に修正必須
- `P1`：重要な品質/正確性の問題。今回のセッションで修正を試みるべきだが、単独では進行を止めない
- `P2`：軽微な明確性/保守性の問題。記録して進行可能

そのうえで、以下のいずれかを出力してください：

```
PASS — 両レビューパス完了。未解決の P0 問題なし。
```

または

```
FAIL — P0 問題が見つかりました：
  1. [Pass 1 | P0 | tasks/module-a.md] `Out of Scope` セクションがない
  2. [Pass 1 | P0 | contracts/IFoo.md] `consumers` に moduleB が記載されているが、tasks/module-b.md に対応する依存関係がない
  3. [Pass 2 | P0 | tasks/module-c.md] module-a のスキーマに関する暗黙知なしに実装できない
  ...
```

---

## FAIL の場合：修正と再確認

1. 対応する `.phasegate/tasks/` または `.phasegate/contracts/` ファイル内の各 `P0` 問題を修正する。
2. `P1/P2` 問題も、このセッションで合理的に直せるなら修正する。直さない場合は Summary に記録する。
3. 違反した項目のみを再確認する。修正に波及効果がある場合を除き、チェックリスト全体を再実行しないこと。
4. このルールは Pass 1 と Pass 2 の両方で見つかった問題に適用される。Pass 2 の指摘も、合理的な範囲で修正し、報告だけで終わらせないこと。
5. 未解決の `P0` 問題がなくなり、判定が PASS になるまで繰り返す。

---

## 出力（PASS 時）

1. すべての `.phasegate/contracts/*.md` ファイルの `Status: finalized` を設定する（`draft` を置換）。
2. `.phasegate/progress.md` に Phase 2 Summary を追記する：

```markdown
## Phase 2 Summary

### Current State
設計書レビュー通過。すべてのモジュール責務が明確で、契約が完備し、循環依存なし。

### Issues Fixed
- {見つかった各ブロッキング問題と解決方法の簡潔な説明、または "none"}

### Remaining Non-P0 Issues
- {後続対応に回した P1/P2 問題、または "none"}

### Outputs
- .phasegate/tasks/*.md：すべて定稿
- .phasegate/contracts/*.md：すべて定稿（Status: finalized）

### Notes for Phase 3
- {実行 wave 順序のヒント、例："module-c は module-a に依存するため wave 1 で開発が必要"}
- {Coordinator が遵守すべき特別な制約}
```

---

## フェーズチェック（セッション終了前に確認）

- [ ] Pass 1 チェックリスト：すべての設計書と契約に未解決の `P0` 問題が残っていない
- [ ] Pass 2 チェックリスト：すべての設計書に未解決の `P0` 問題が残っていない
- [ ] すべての `.phasegate/contracts/*.md` に `Status: finalized` が設定されている
- [ ] Phase 2 Summary を `.phasegate/progress.md` に追記済み

---

## 終了時の行動（厳守）

フェーズチェック通過後：
- 定稿済みの設計書と契約の一覧を報告する
- `phasegate run` はすべての契約が finalized になったことを自動検出し、Phase 3 に進んだうえで、`phasegate run --phase 2` が明示されていない限り同じ CLI セッション内で継続実行する
- コード生成・スキャフォールディング・実装スタブを一切生成することを**禁止**する
- 「開発を始めますか？」などの誘導を**禁止**する
- 制御をユーザーに返し、次の指示を待つ
