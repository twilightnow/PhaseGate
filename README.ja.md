# PhaseGate

PhaseGate は、フェーズ分離、契約先行、マルチモジュール実行を重視したエンジニアリング向け AI コーディングワークフローです。

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

## 基本モデル

PhaseGate は 2 層で動作します。

- 要件プール: `.phasegate/requirements/`
- 単一のアクティブ実行フロー: `.phasegate/progress.json`

要件は実行中でも追加や修正ができます。
実行は常に 1 つの requirement だけを対象にします。

## クイックスタート

```bash
npm install
npm run build
phasegate init
phasegate chat --feature login
phasegate select login
phasegate run
```

選択と実行を一度に行うこともできます。

```bash
phasegate run --requirement login
```

## ワークスペース

```text
.phasegate/
  requirements/
  tasks/
  contracts/
  scratchpad/
  archive/
  progress.json
  phasegate.config.json
```

- `progress.json` が唯一の状態ソースです
- `scratchpad/` には一時成果物、worker report、phase summary を保存します
- `archive/` には保持価値のある実行成果物を保存します

## 主なコマンド

- `phasegate init`
- `phasegate chat`
- `phasegate select <requirement>`
- `phasegate run`
- `phasegate status`
- `phasegate progress`
- `phasegate review <module>`

## ドキュメント

- [docs/guides/getting-started.md](./docs/guides/getting-started.md)
- [docs/core/workflow-phases.md](./docs/core/workflow-phases.md)
- [docs/core/progress-model.md](./docs/core/progress-model.md)
