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

### Sprint SHOW-RUNTIME: 運営者主導の本番演目ランタイム

> **依存**: Sprint TECH-RISK-PROTOTYPE完了
> **目的**: 運営者が参加者へ呼びかけながら三段階の演目を確実に進行し、任意の時点で最大演出を発火・リセットできるようにする
> **設計書**: `docs/sprints/SPRINT_SHOW_RUNTIME.md`
> **ステータス**: ブロック

| # | 完了 | タスク | 内容 | ステータス | 完了日 |
|---:|:---:|---|---|---|---|
| 1 | [ ] | 本番演目ランタイム | `READY / CHARGE / VORTEX / FREEZE / CLIMAX`を運営ボタンとキーから切り替え、各場面が既存の映像特徴量へ反応する。`X`の強制発火と`R`のリセットを保証し、自動テストと実機受け入れを記録する | ブロック | — |

> **ブロック理由**: 入力安定性、光跡、CLIMAXはContinuity Camera実機で暫定合格。最新変更後の動作中60 FPSと全画面中の`1 / 2 / 3 / X / R`が未確認であり、両項目の実機合格を解除条件とする。[FACT: docs/sprints/SPRINT_SHOW_RUNTIME.md §Task 3 再受け入れ不合格と入力安定化・CLIMAX再設計 → 実機合格済み範囲と未確認項目]
