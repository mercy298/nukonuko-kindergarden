# Sprint REPOSITORY-BOOTSTRAP: Public GitHubリポジトリの準備

> **ステータス**: 進行中

## 目的

本番前の技術リスク検証プロトタイプを、GitHubのPublicリポジトリから取得・実行できる状態にする。

## 公開構成

- 所有者: `mercy298`
- リポジトリ: `nukonuko-kindergarden`
- 可視性: Public
- 既定ブランチ: `master`
- 公開対象: 現在の技術リスク検証プロトタイプ、テスト、設計・検証記録、Incident

## 成功条件

- 公開対象に認証情報、ローカル一時ファイル、依存物が含まれない。
- READMEから目的、起動方法、実機確認済み範囲を追跡できる。
- `npm test`、`npm run check`、`git diff --check`に合格する。
- GitHub上のリポジトリがPublicである。
- GitHub上の既定ブランチが`master`で、ローカル`master`と同期している。

## 今回行わないこと

- ライセンスの選択
- Pull Requestの作成
- release、tag、配布パッケージの作成
- 完成演目、Blossom判定、参加者用QRページの実装

## 検証結果

未実施。
