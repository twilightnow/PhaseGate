# Self-Review: Architecture Refactoring Plan

- Type: review
- Status: complete
- Created: 2026-04-08
- Reviewer: plan author (self-review)

## Review Method

コード照合：`src/` 全体の実コードを読み、計画内の仮定・ファイルパス・関数シグネチャが正確であるかを検証した。

---

## Findings

### F1 — M4: Phase 2 skip の正確な実装箇所が誤り [CORRECTED]

**問題：**

M4 では「`PhaseExecutor.prepare(phase=2)` が no-op PreparedPhase を返すことで Phase 2 をスキップする」と記述していた。しかし `run.ts` の実際の制御フローは次のとおり：

```
phase === 3 → executor.execute(cwd, 3)
else        → executor.prepare(cwd, phase) + runSinglePhase(prepared, ...)
```

Phase 2 は `else` 分岐を通るため、`prepare` が no-op PreparedPhase を返しても `runSinglePhase` が空プロンプトで AI をコールしてしまう。

**正しい実装箇所：**

Phase 2 の skip / migration ロジックは `run.ts` の action handler 内、`prepare` を呼ぶ前に置く：

```typescript
// run.ts の while ループ内
if (phase === 2) {
  console.log(chalk.yellow('! Phase 2 has been folded into Phase 1...'));
  executionResult = { phase: 2 as ExecutablePhaseId, output: 'phase2_migrated' };
} else if (phase === 3) {
  executionResult = await executor.execute(cwd, 3);
} else {
  const prepared = await executor.prepare(cwd, phase as Exclude<ExecutablePhaseId, 2 | 3>);
  const output = await runSinglePhase(...);
  executionResult = { phase, output };
}
```

**影響する module：** M4 + M7（両方を修正済み）

---

### F2 — M3: `getPhase4Verdict` が既存関数であり REPLACEMENT が必要 [CORRECTED]

**問題：**

M3 に `tryParseVerdict` を「追加」するように記述していたが、`phase-transition-manager.ts` には既存の `getPhase4Verdict(output)` 関数があり、単純な PASS/FAIL キーワード検索を行っている。

**正しい扱い：**

`tryParseVerdict`（JSON block 解析）は `getPhase4Verdict` の REPLACEMENT として機能する。

- `resolvePhase4WithResult` 内で `getPhase4Verdict` を `tryParseVerdict` に置き換える  
- `getPhase4Verdict` はファイルから削除し、`tryParseVerdict` がその職責を担う  
- Fallback（JSON なし）の場合は legacy artifact チェック（`checkPhase4Gate`）に委ねる

M3 のコード例を修正済み。

---

### F3 — M4: Phase 4 の context loading は既存でほぼ正しい状態 [ACKNOWLEDGED]

**観察：**

`buildPhaseContextFiles` の Phase 4 case を実際に読んだところ、既に次の内容を注入していた：

- `progress.json`
- task books（全部）
- contracts（全部）
- requirement files
- scratchpad/summaries の全 markdown
- worker report.json files（`listWorkerReportFiles` 経由）

M4 の主な改善点は「全量 contracts → done-module 関連のみ」「全量 tasks → done-modules のみ」へのフィルタリングであり、worker reports の追加は不要（既に入っている）。

M4 の記述を「新規追加」から「フィルタリング改善」に修正済み。

---

### F4 — M3: `resolvePhase1` は現在 `currentPhase` を書き込まない [VERIFIED]

**観察：**

現在の `resolvePhase1` は `syncPhase1Outputs(cwd)` を呼ぶだけで、`currentPhase` を 2 に更新しない。その後 `run.ts` のループで Phase 2 が実行され、Phase 2 完了時に `currentPhase = 3` が書き込まれる。

新設計では `resolvePhase1` で直接 `currentPhase = 3` を書き込むことが正しい（Phase 2 をスキップするため）。M3 の記述通り。✓

---

### F5 — M8: 既存テストの期待値が変わる範囲の特定 [VERIFIED]

**既存テスト `phase-transition-manager.test.ts` の現状：**

- Phase 2 テスト：contracts が finalized ならば `nextPhase=3`, `currentPhase=3`, `reviewPassed=true` を期待
- 新設計で Phase 2 は no-op + migration メッセージになるため、contracts 状態に関係なく `nextPhase=3`, `currentPhase=3` になる

したがって既存の Phase 2 テストは：
- 結果（`nextPhase=3`, `currentPhase=3`）は引き続き pass する可能性がある
- ただし `message` の内容が変わるため、message の assert があれば更新が必要
- `checkPhase2Gate` が呼ばれなくなるため、contracts ファイルの存在有無に依存するテストパス/フェイルは無意味になる

M8 に上記の注記を追加済み。

---

### F6 — `PhaseExecutor.execute` と `prepare` + `runSinglePhase` の二重構造 [NOTED]

**観察：**

`PhaseExecutor` には `execute(cwd, phase)` と `prepare(cwd, phase)` の 2 つの公開 API がある。  
`run.ts` は Phase 3 以外では `prepare` + `runSinglePhase` を使用し、`execute` は Phase 3 のみ呼ぶ。  
テストコードは `execute` を直接呼ぶ可能性がある。

**計画への影響：**

- Phase 2 の no-op 処理は `run.ts` に置く（F1 修正）
- `PhaseExecutor.execute` での Phase 2 分岐は、テストや直接呼び出しのための safety net として残す
- `prepare` は Phase 2 も正常に処理できる状態を保つ（フォールthrough で既存ロジック）

---

## Plan Files Updated

以下のファイルを F1〜F5 の知見に基づき修正した：

- `04-phase-executor.md` → F1, F3 反映
- `07-cli-commands.md` → F1 反映（Phase 2 skip を run.ts action handler に移動）

---

## Feasibility Assessment

| 観点 | 評価 | 根拠 |
|---|---|---|
| 実装可能性 | ✅ 高い | 既存コードに型・関数の置き場所が揃っている |
| 後方互換性 | ✅ 担保可能 | `phaseStates`/`phase4Verdict` は可選 field；旧 workspace は `normalizeProgress` で吸収 |
| テスト更新コスト | 🟡 中程度 | Phase 2 テストの期待値変更が主；増加テストは明確に特定済み |
| ドキュメント量 | 🟡 中程度 | 9 ドキュメント中 5 が "high" 優先度だが、変更は部分的 |
| Stage 間の依存 | ✅ 明確 | 依存関係チェーン M1→M2→M3→M4/M5→M6→M7/M8/M9 は安全 |
| リスク | 🟡 低〜中 | 最大リスクは prompt 品質 (M6)；既存コードの質が高いため型変更リスクは低 |

---

## Self-Review Verdict

計画は概ね実装に進める水準に達している。F1（Phase 2 skip 箇所）が最も重要な訂正で、すでに M4 / M7 に反映済み。各 Module の Acceptance Criteria は具体的かつ検証可能。Stage 間の gate 条件も明確。

**推奨次ステップ：**

1. `plan/00-overview.md` を参照し、Stage 1（M1 → M2 → M3）の実装から開始する
2. 各 module の Acceptance Criteria をチェックリストとして使用する
3. Phase 4 のサンプル end-to-end テストは Stage 3 完了後に実施する
