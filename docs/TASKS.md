# タスク

### Sprint TECH-RISK-PROTOTYPE: Continuity Camera入力と反応描画の実証

> **依存**: iPhone 17 Pro、USB-C接続、M4 MacBook Air、Chromeのカメラ権限
> **目的**: iPhone映像をMacへ取り込み、画面全体の動きに応じた演出をリアルタイム表示できることを実機で判断可能にする
> **設計書**: `docs/sprints/SPRINT_TECH_RISK_PROTOTYPE.md`
> **ステータス**: 完了

| # | 完了 | タスク | 内容 | ステータス | 完了日 |
|---:|:---:|---|---|---|---|
| 1 | [x] | 技術リスク検証プロトタイプ | ChromeでContinuity Cameraを選択し、ライブ映像、フレーム差分メーター、動き連動のCanvas演出を確認できる。自動テストに合格し、実機確認結果をSprint文書へ記録する | 完了 | 2026-07-18 |

### Sprint REPOSITORY-BOOTSTRAP: Public GitHubリポジトリの準備

> **依存**: Sprint TECH-RISK-PROTOTYPE完了、GitHub CLI認証
> **目的**: 本番前の成果物をPublic GitHubリポジトリの`master`ブランチから取得・実行できる状態にする
> **設計書**: `docs/sprints/SPRINT_REPOSITORY_BOOTSTRAP.md`
> **ステータス**: 完了

| # | 完了 | タスク | 内容 | ステータス | 完了日 |
|---:|:---:|---|---|---|---|
| 1 | [x] | Publicリポジトリ公開 | READMEと除外設定を整備し、公開対象を監査して、GitHubのPublicリポジトリ`mercy298/nukonuko-kindergarden`の`master`へ検証済み成果物をpushする | 完了 | 2026-07-18 |
