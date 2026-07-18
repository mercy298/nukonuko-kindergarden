# Nukonuko Kindergarden

iPhoneのカメラ映像をMacへ取り込み、画面全体の動きへリアルタイムに反応するインタラクティブ演出のプロジェクトです。

## 現在地

現在公開しているのは、カメラ入力、低解像度の特徴解析、Canvas演出を接続した技術リスク検証プロトタイプです。完成演目、Blossom判定、参加者用QRページは未実装です。[FACT: docs/sprints/SPRINT_TECH_RISK_PROTOTYPE.md:46-53 → 今回実装しなかった範囲]

M4 MacBook Air、iPhone 17 Pro、Google Chromeを使い、USB接続のカメラ映像、動き連動エフェクト、動作中60 FPS、Mac画面での全画面表示を実機確認しています。[FACT: docs/sprints/SPRINT_TECH_RISK_PROTOTYPE.md:68-78 → 実機受け入れ結果]

## 構成

```text
iPhone
  -> USB-C / Continuity Camera
  -> Chrome MediaDevices API
  -> 160x90 フレーム差分解析
  -> Canvas 2D 発光・粒子演出
```

映像と解析結果は保存・外部送信しません。[FACT: docs/sprints/SPRINT_TECH_RISK_PROTOTYPE.md:17-28 → データフローと非保存方針]

## 起動

```bash
npm start
```

Google Chromeで次を開きます。

```text
http://127.0.0.1:4173
```

初回はカメラ名が「カメラ1」のように匿名表示されます。「カメラを開始」を押してChromeのカメラ権限を許可した後、「再取得」からiPhoneのカメラを選択してください。

## 検証

```bash
npm test
npm run check
```

自動テストは、静止フレーム、部分的な画面変化、初回基準値、演出強度の立ち上がりと減衰を対象にします。[FACT: tests/frame-analysis.test.js:21-66 → フレーム解析テスト] [FACT: tests/effect-state.test.js:7-42 → 演出状態テスト]

## 記録

- [タスク台帳](docs/TASKS.md)
- [技術リスク検証Sprint](docs/sprints/SPRINT_TECH_RISK_PROTOTYPE.md)
- [Canvas性能Incident](issues/2026-07-18-canvas-particle-shadow-performance.md)

## ライセンス

現時点ではライセンスを設定していません。Publicリポジトリであることは、再利用・再配布の許諾を意味しません。
