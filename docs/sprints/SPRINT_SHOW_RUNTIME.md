# Sprint SHOW-RUNTIME: 運営者主導の本番演目ランタイム

> **ステータス**: 設計レビュー中

## 目的

運営者の呼びかけ、参加者の集団動作、映像特徴量、投影演出を一つの短い演目として接続する。会場条件による自動判定の不確実性を演目進行へ持ち込まず、運営者が必ずクライマックスと次セッションへの復旧を制御できるようにする。

## ユーザージャーニー

1. 演出担当がカメラを開始し、`READY`で参加者を待つ。
2. カメラ担当が参加者へ両手を上げるよう促し、演出担当が`1`で`CHARGE`へ進める。
3. 参加者の動きに応じてエネルギーが蓄積し、演出担当が`2`で`VORTEX`へ進める。
4. カメラ担当が左右へ動くよう促し、画面全体の動きが渦と粒子を増幅する。
5. 演出担当が`3`で`FREEZE`へ進め、カメラ担当が参加者へ完全停止を促す。
6. 静止が続くほど画面が収束する。演出担当は任意の時点で`X`を押し、`CLIMAX`を確実に発火する。
7. クライマックス終了後、演出担当が`R`を押して`READY`へ戻し、次の参加者を迎える。

## 採用方式

### 運営者主導＋解析連動

場面遷移はボタンとキーボードだけが決定する。カメラ解析値は現在の場面内の色、発光量、粒子量、収束度を変えるが、次場面へ自動遷移しない。

完全自動進行は、60人規模の会場、照明、構図で閾値を調整していないため採用しない。固定タイムラインは、参加者の動作と画面変化の因果を弱めるため採用しない。

## アーキテクチャ

```text
Camera / analyzeFrame
  -> EffectState（平滑化済み motion / brightness / centroid）
  -> ShowRuntime（phase / energy / stillness / climax）
  -> SceneRenderer（場面別の描画パラメーター）

Operator button / keyboard
  -> ShowRuntime event
  -> Operator UI + projection canvas
```

`ShowRuntime`はブラウザAPIへ依存しない純粋な状態遷移として実装する。カメラ取得、運営操作、Canvas描画を分離し、状態遷移は合成入力による自動テストで保証する。

解析イベントは`motion / brightness / centroid / deltaSeconds`を受け取る。エネルギーと静止ゲージは`deltaSeconds`に基づいて更新し、解析フレームレートが30 FPSと60 FPSのどちらでも同じ時間変化になるようにする。蓄積値は`0.0...1.0`へ制限する。

## 状態と操作契約

| 状態 | 目的 | 解析値の使い方 | 入場操作 |
|---|---|---|---|
| `READY` | 参加者待機とカメラ確認 | 低強度の背景反応だけを表示 | `R`または初期状態 |
| `CHARGE` | 集団の動きからエネルギーを蓄積 | `motion`でエネルギーと暖色発光を増やす | `1` |
| `VORTEX` | 左右運動を大きな渦へ変換 | `motion`と`centroid`で粒子速度・発生位置を変える | `2` |
| `FREEZE` | 集団の静止で画面を収束させる | `motion`が低いほど静止ゲージを増やす | `3` |
| `CLIMAX` | 最大演出を保証する | 解析値に依存せず最大強度を維持する | `X` |

- `X`はどの状態からでも`CLIMAX`へ遷移する。
- `R`はどの状態からでも`READY`へ戻り、エネルギー、静止ゲージ、粒子を初期化する。
- `1 / 2 / 3`は対応状態へ直接遷移する。誤操作から即時復旧できることを、順送りより優先する。
- カメラ切断中も状態操作は可能とし、演出担当が操作リハーサルと復旧確認を行えるようにする。
- キー入力はフォーム部品へフォーカス中は無視し、カメラ選択操作を妨げない。

`ShowRuntime`は`R`で蓄積値を初期化する。Canvasが保持する既存粒子はブラウザ統合層が同じ`R`イベントを受けて消去する。

## 場面別の視覚設計

### READY

暗いグリッドと低密度の呼吸する光を表示する。カメラ映像は薄く見せ、接続と構図を確認できる状態にする。

### CHARGE

動きの重心へ暖色の光を集め、動き量に応じて画面周辺から粒子を吸い込む。蓄積したエネルギーは運営画面のゲージと投映画面の光量へ同時に反映する。

### VORTEX

粒子へ回転方向の速度を与え、重心を中心とする渦を作る。既存の粒子ごとの`shadowBlur`は再導入せず、`screen`合成と単純図形で60 FPSを守る。[FACT: issues/2026-07-18-canvas-particle-shadow-performance.md → 個別shadowBlurが4 FPS低下の主因]

### FREEZE

動きが少ないほど既存映像の残像を弱め、粒子を中心へ収束させる。完全静止を厳密認識せず、運営担当が静止ゲージを見て発火時点を判断する。

### CLIMAX

解析値に依存せず、画面全体のパルス、放射状の粒子、白へのフラッシュ、最終シンボル用の空間を最大強度で描画する。Blossom画像そのものと音響は後続タスクで接続する。

## 運営画面

- 現在状態を日本語名と英語コードで常時表示する。
- `READY / CHARGE / VORTEX / FREEZE / CLIMAX`の各ボタンを一列で表示する。
- ボタンには対応キーを表示し、選択中の状態を色と枠で識別する。
- `X`の最大演出は他ボタンと視覚的に分離する。
- カメラ状態、動き、高輝度、エネルギー、静止ゲージ、FPSを同時に確認できる。
- 投映画面の全画面表示中も、キーボード操作を受け付ける。

## エラーと復旧

- カメラ取得失敗は既存の具体的なエラーメッセージを維持する。
- カメラ切断時も`X`と`R`は機能する。
- 状態遷移や描画中に外部通信を行わない。
- `R`は次セッションの開始点を一意に復元し、直前のエネルギー・静止状態を残さない。

## テスト

### 自動テスト

- 初期状態が`READY`である。
- `1 / 2 / 3`相当イベントが対応状態へ直接遷移する。
- どの状態からも強制発火で`CLIMAX`へ遷移する。
- どの状態からもリセットで全蓄積値が初期化される。
- `CHARGE`では動きに応じてエネルギーが増加し、上限を超えない。
- `FREEZE`では低い動きで静止ゲージが増え、高い動きで減る。
- 同じ信号を異なるフレームレートで与えても、同じ経過時間なら蓄積値が一致する。
- 状態から描画パラメーターへの変換が有限値を返す。

### 実機受け入れ

- Continuity Camera接続中に全状態を操作できる。
- 各状態で参加者の動きに応じた異なる映像変化を確認できる。
- 動作中60 FPSを維持する。
- 全画面表示中に`1 / 2 / 3 / X / R`が機能する。
- `X`が解析値に関係なく最大演出を発火する。
- `R`で次の参加者用の待機画面へ復旧する。

## 変更対象

- `src/show-runtime.js`: 状態、イベント、蓄積値、描画パラメーター
- `tests/show-runtime.test.js`: 状態遷移と信号反応
- `public/index.html`: 状態ボタン、ゲージ、現在状態
- `public/app.js`: キー操作、解析入力、状態別描画
- `public/styles.css`: 運営UIと状態別表示
- `docs/TASKS.md`: Task状態
- 本文書: 実装結果と実機受け入れ

## 今回行わないこと

- Blossom自動判定と参加者用画像ページ
- BGM、効果音、参加者音声の入力
- 自動場面遷移
- 人数・人物・姿勢の認識
- 外部プロジェクターを使った会場リハーサル
- GitHubへのpush、PR、release

---

# SHOW-RUNTIME Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 運営者が5つの演目状態を確実に操作し、既存のカメラ特徴量が各場面固有の60 FPS演出へ反映される本番ランタイムを構築する。

**Architecture:** ブラウザ非依存の`show-runtime.js`が状態遷移と時間ベース蓄積を所有する。`public/app.js`は運営イベントと解析信号を状態へ渡し、導出済みの場面パラメーターだけをCanvas描画へ利用する。

**Tech Stack:** Vanilla JavaScript ES Modules、Node.js標準テスト、MediaDevices API、Canvas 2D

## Global Constraints

- 場面遷移を解析値で自動実行しない。
- `X`は常に`CLIMAX`、`R`は常に蓄積値0の`READY`へ遷移する。
- カメラ切断中も運営操作を受け付ける。
- 全蓄積値は`0.0...1.0`、時間変化は`deltaSeconds`基準とする。
- Canvasの`filter`と粒子ごとの`shadowBlur`を使用しない。
- 映像、解析値、操作履歴を保存・外部送信しない。

---

### Task 1: 演目状態と時間ベース蓄積

**Files:**
- Create: `src/show-runtime.js`
- Create: `tests/show-runtime.test.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: `{ motion: number, brightness: number, centroid: {x: number, y: number} }`と`deltaSeconds: number`
- Produces: `SHOW_PHASE`、`createShowRuntime()`、`selectShowPhase(state, phase)`、`triggerClimax(state)`、`resetShowRuntime(state)`、`updateShowRuntime(state, signal, deltaSeconds)`、`deriveSceneParameters(state, signal)`

- [x] **Step 1: 状態遷移の失敗テストを書く**

```js
test("強制発火とリセットは現在状態に依存しない", () => {
  const vortex = selectShowPhase(createShowRuntime(), SHOW_PHASE.VORTEX);
  assert.equal(triggerClimax(vortex).phase, SHOW_PHASE.CLIMAX);
  assert.deepEqual(resetShowRuntime({ ...vortex, energy: 0.8 }), {
    phase: SHOW_PHASE.READY,
    energy: 0,
    stillness: 0,
    sceneTime: 0,
    session: 1,
  });
});
```

- [x] **Step 2: Redを確認する**

Run: `node --test tests/show-runtime.test.js`

Expected: `SHOW_PHASE`または`createShowRuntime`が未定義でFAIL。

- [x] **Step 3: 最小の状態遷移を実装する**

```js
export const SHOW_PHASE = Object.freeze({
  READY: "ready",
  CHARGE: "charge",
  VORTEX: "vortex",
  FREEZE: "freeze",
  CLIMAX: "climax",
});

export function createShowRuntime(session = 0) {
  return { phase: SHOW_PHASE.READY, energy: 0, stillness: 0, sceneTime: 0, session };
}
```

`selectShowPhase`は未知の状態を`RangeError`で拒否し、`sceneTime`だけを0へ戻す。`resetShowRuntime`は`session`を1増やした初期状態を返す。

- [x] **Step 4: 状態遷移テストのGreenを確認する**

Run: `node --test tests/show-runtime.test.js`

Expected: 状態遷移テストがPASS。

- [x] **Step 5: 蓄積とフレームレート不変性の失敗テストを書く**

```js
test("同じ経過時間なら解析頻度によらず蓄積値が一致する", () => {
  const signal = { motion: 0.6, brightness: 0.2, centroid: { x: 0.5, y: 0.5 } };
  const start = selectShowPhase(createShowRuntime(), SHOW_PHASE.CHARGE);
  const at30 = repeatUpdate(start, signal, 1 / 30, 30);
  const at60 = repeatUpdate(start, signal, 1 / 60, 60);
  assert.ok(Math.abs(at30.energy - at60.energy) < 0.0001);
});
```

`FREEZE`では`motion < 0.08`の間、静止ゲージが毎秒`0.5`増え、それ以外は毎秒`1.0`減ることもテストする。

- [x] **Step 6: 時間ベース更新と描画パラメーターを実装する**

`CHARGE`のエネルギーは`(motion * 0.9 - 0.03) * deltaSeconds`、`VORTEX`は`motion * 0.25 * deltaSeconds`で増加させる。`deriveSceneParameters`は次を返す。

```js
{
  intensity: number,
  videoAlpha: number,
  particleRate: number,
  convergence: number,
  flash: number,
  hue: number,
}
```

すべて有限値かつ`0.0...1.0`へ制限する。`hue`だけは`0...360`とする。

- [x] **Step 7: 全自動テストを実行する**

Run: `npm test`

Expected: 既存5件とSHOW-RUNTIMEテストがすべてPASS。

#### Task 1 実装結果（2026-07-18）

- 5場面の状態遷移、任意状態からの強制`CLIMAX`、セッション番号つきリセットをブラウザ非依存の純粋関数として実装した。[FACT: src/show-runtime.js:1-39 → SHOW_PHASEと状態操作関数]
- `deltaSeconds`基準のエネルギー・静止蓄積と、範囲制限済みの描画パラメーター導出を実装した。[FACT: src/show-runtime.js:41-148 → 時間ベース更新、場面パラメーター、入力制約]
- 状態遷移、30/60 FPS相当の不変性、静止ゲージ、全場面の有限値を5テストで固定した。[FACT: tests/show-runtime.test.js:21-99 → SHOW-RUNTIMEの振る舞いテスト]
- 検証: `node --test tests/show-runtime.test.js`は5/5、`npm test`は10/10、`npm run check`と`git diff --check`はexit 0。
- Task 2の運営UI統合とTask 3の場面描画・実機受け入れは未着手。

### Task 2: 運営UIとキーボード統合

**Files:**
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`

**Interfaces:**
- Consumes: Task 1の`SHOW_PHASE`と全状態操作関数
- Produces: `[data-show-phase]`ボタン、`#showPhase`、`#energyMeter`、`#stillnessMeter`、`handleShowCommand(command)`

- [ ] **Step 1: 運営コントロールをHTMLへ追加する**

```html
<section class="show-control" aria-label="演目進行">
  <p id="showPhase">READY / 待機</p>
  <div class="show-buttons">
    <button data-show-phase="charge">1 CHARGE</button>
    <button data-show-phase="vortex">2 VORTEX</button>
    <button data-show-phase="freeze">3 FREEZE</button>
    <button data-show-command="climax">X CLIMAX</button>
    <button data-show-command="reset">R RESET</button>
  </div>
</section>
```

エネルギーと静止ゲージは既存メーターと同じ`role="meter"`契約を使う。

- [ ] **Step 2: 運営イベントを状態へ接続する**

`handleShowCommand`は`charge / vortex / freeze / climax / reset`を対応関数へ渡す。`reset`時は`particles = []`とし、カメラストリームは停止しない。

- [ ] **Step 3: キーボードを接続する**

```js
const SHOW_KEYS = new Map([
  ["1", "charge"], ["2", "vortex"], ["3", "freeze"],
  ["x", "climax"], ["r", "reset"],
]);
```

`input / select / textarea / button`へフォーカス中は無視する。全画面の`stage`へフォーカスが移っても操作できる。

- [ ] **Step 4: 描画ループを時間ベース更新へ接続する**

`analyzeVideoFrame`は`effectState`の更新だけを担う。`render()`で前回描画時刻との差を最大`0.1`秒へ制限し、現在の`effectState`とともに`updateShowRuntime`へ渡す。カメラの有無にかかわらず演目時間を一つの描画ループだけで更新し、解析頻度による二重更新を防ぐ。

- [ ] **Step 5: UI状態を同期する**

現在状態、選択ボタン、エネルギー、静止ゲージ、`stage.dataset.phase`を一つの`updateShowUi()`で更新する。`aria-pressed`と`aria-valuenow`も同時に更新する。

- [ ] **Step 6: 構文検査と既存テストを実行する**

Run: `npm run check && npm test`

Expected: 構文検査と全テストがPASS。

### Task 3: 場面別描画と受け入れ

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `docs/sprints/SPRINT_SHOW_RUNTIME.md`
- Modify: `docs/TASKS.md`

**Interfaces:**
- Consumes: Task 1の`deriveSceneParameters`、Task 2の`showRuntime`
- Produces: READY、CHARGE、VORTEX、FREEZE、CLIMAXの視覚差、検証記録

- [ ] **Step 1: 既存描画を場面パラメーターへ接続する**

`drawCameraFeed`は`videoAlpha`、`spawnParticles`は`particleRate`を使う。粒子へ`mode`を持たせず、現在状態に応じて生成時の速度だけを変える。

- [ ] **Step 2: 場面固有の描画を追加する**

- `READY`: グリッドと薄い映像。
- `CHARGE`: 重心を中心とする暖色リングと内向き粒子。
- `VORTEX`: 重心周囲の円弧と接線方向の粒子。
- `FREEZE`: 粒子を中心へ補間し、静止ゲージに応じて円を収束。
- `CLIMAX`: 放射粒子と`Math.sin(sceneTime * 8)`による白パルス。

全描画は単純図形と`screen`合成だけを使う。

- [ ] **Step 3: カメラなしのヘッドレス表示を確認する**

Run: `npm start`後、Chrome headlessで1440×900のスクリーンショットを取得する。

Expected: 運営ボタン、READY表示、4つのメーターが見切れず表示される。

- [ ] **Step 4: 自動検証を実行する**

Run: `npm test && npm run check && git diff --check`

Expected: 全コマンドがexit 0。

- [ ] **Step 5: 実機受け入れを行う**

ChromeでContinuity Cameraを開始し、`1 / 2 / 3 / X / R`、各場面の視覚差、動作中60 FPS、全画面操作を確認する。

- [ ] **Step 6: 台帳を同期する**

実機受け入れがすべて合格した場合だけ、`docs/TASKS.md`を`[x] / 完了 / 2026-07-18`へ更新する。未確認項目があれば`ブロック`と解除条件を記録する。
