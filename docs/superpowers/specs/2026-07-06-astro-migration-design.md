# Astro 移行 設計

作成日: 2026-07-06

## 目的

現在フレームワークなしで実装されているマルチ資格クイズ（SAA / DVA / DEA）を Astro に移行する。
狙いは、3ファイルに重複している HTML 骨組み（`home` / `quiz` / `result` セクション、約55行）を
共通コンポーネントに集約し、資格ページを「設定だけの薄い実装」にすること。

## 現状（移行前）

前回設計（`2026-07-03-multi-cert-quiz-design.md`）でフレームワークなしの共通化が完了・マージ済み:

- `quiz.css` … 全ページ共通スタイル（重複なし）
- `quiz.js` … 共通クイズエンジン。`window.QUIZ_CONFIG` で資格差分を注入
- `index.html`（SAA）/ `dva.html`（DVA）/ `dea.html`（DEA）… 設定＋データ指定の薄いラッパー
  （SAA だけ `index.html` と命名が特例。移行で `saa` に統一する。下記「命名の統一」参照）
- `questions.json`（SAA 297問）/ `questions-dva.json`（20問）/ `questions-dea.json`（20問）
  （SAA だけ `questions.json` と命名が特例。移行で `questions-saa.json` に統一する）
- `scripts/validate.js` … 3ファイルを構造検証（CI: `validate.yml`）
- 学習統計は localStorage にオリジン単位で保存。SAA は旧キー（`saaQuizStats_v1` /
  `saaQuizHistory_v1`）、他資格は `quizStats_<code>_v1` / `quizHistory_<code>_v1`
  （移行でこの SAA 特例を廃止し統一する。下記「localStorage キー統一」参照）
- デプロイ: GitHub Pages「Deploy from branch: main / (root)」。URL は
  `https://wao3299.github.io/aws_learning/`（base パス `/aws_learning/`、カスタムドメインなし）
- データは実行時に相対 `fetch(DATA_FILE)` で読み込み

### 残っている重複（移行で解消する対象）

3枚の HTML の `home` / `quiz` / `result` セクションのマークアップがほぼ丸ごと重複している。
資格ごとの差分は「タイトル・eyebrow・sub・ナビの active・本番モードボタンの有無・`QUIZ_CONFIG`」のみ。

## 方針

Astro を導入し、骨組みを単一コンポーネント化する。クイズエンジンのロジックは変更しない
（移行は構造のみ。例外は localStorage キー導出の統一）。実行時 fetch アーキテクチャは維持する。
併せて SAA だけ特例だったファイル命名（`index.html` / `questions.json`）を他資格と同じ規則に統一し、
トップ（`/`）には資格選択のハブページを置く。

## プロジェクト構成（移行後）

```
astro.config.mjs          # site + base:'/aws_learning' 設定
package.json              # astro 依存・build / dev スクリプト
src/
  layouts/Base.astro       # <html><head>、quiz.css 読み込み、<slot />
  components/Quiz.astro     # ヘッダ+資格ナビ+home/quiz/result 骨組み（唯一の実体）
  pages/
    index.astro            # 資格選択ハブ（3資格へのカード）
    saa.astro              # SAA: cert を定義して <Quiz> に渡すだけ
    dva.astro              # DVA
    dea.astro              # DEA
  styles/quiz.css          # 現 quiz.css を移動
  scripts/quiz.js          # 現 quiz.js をほぼそのまま（DOM 操作・ロジック不変）
public/
  questions-saa.json       # データ3つは static 資産として据え置き（実行時 fetch 維持）
  questions-dva.json
  questions-dea.json
scripts/validate.js        # 据え置き（参照パスのみ public/ に調整）
```

ルート直下の `index.html` / `dva.html` / `dea.html` は削除し、`src/pages/*.astro` に置き換える。
現 `quiz.css` / `quiz.js` はルートから `src/` 配下へ移動する。
`questions.json` は `public/questions-saa.json` にリネームする（`git mv` で履歴を保つ）。

## コンポーネント設計

### `cert` prop スキーマ

各ページ（`saa.astro` / `dva.astro` / `dea.astro`）が定義し `<Quiz cert={cert} />` で渡す。
表示文言と `QUIZ_CONFIG` 相当を一体化する。

```js
// src/pages/saa.astro
const cert = {
  code: "SAA",                 // localStorage キー導出・資格識別
  active: "SAA",               // 資格ナビの active 表示
  eyebrow: "AWS Certified · SAA-C03",
  title: "Solutions Architect Associate 腕試し",
  sub: "297問のプールから出題。腕試し10問／本番65問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions-saa.json`, // base 前置きの絶対パス
  practiceN: 10,
  exam: { enabled: true, n: 65, minutes: 130, passPct: 0.72 },
};
```

- **SAA**: `exam.enabled = true`、`data = .../questions-saa.json`
- **DVA**: `exam.enabled = false`、`data = .../questions-dva.json`
- **DEA**: `exam.enabled = false`、`data = .../questions-dea.json`

データファイル名は資格コードの小文字（`questions-<code小文字>.json`）で統一する。

### `Quiz.astro` の責務

- ヘッダ（eyebrow / title / sub）と資格ナビを描画。ナビは各資格ページ（`saa` / `dva` / `dea`、
  base 前置き）へのリンクとトップ（ハブ `/`）への導線を持ち、`cert.active` で現在資格を active 表示
- `home` / `quiz` / `result` セクションの骨組みを描画（現 HTML と同一の要素・id・class を維持）
- `cert.exam.enabled` の真偽で本番モード関連要素（`#startExam` ボタン、結果画面の `#exambtn`）を
  条件レンダリング。無効時は現 DVA/DEA と同じ構成になる
- エンジンへ設定を渡す（下記「エンジン読み込み順序」）

### エンジン読み込み順序（低リスク維持）

`quiz.js` は読み込み時に `window.QUIZ_CONFIG` を参照する前提を維持する。`Quiz.astro` は次の順で出力する:

1. `<script is:inline set:html={`window.QUIZ_CONFIG = ${JSON.stringify(cfg)}`}>` で設定を定義
   （`cfg` は `cert` から `code` / `data` / `practiceN` / `exam` を抜き出したもの）
2. その後に `<script>import "../scripts/quiz.js";</script>`（Astro がバンドルする module スクリプト）で
   エンジン本体を読み込む

順序の根拠: `is:inline` の非 module スクリプトはパース時に即時実行され、Astro がバンドルする
`<script>` は module（`defer` 相当）で後から実行される。したがって `window.QUIZ_CONFIG` の定義が
必ずエンジン実行より前になり、現状と同じ実行順序・挙動を保証できる。module スコープ化しても
`quiz.js` は `window.QUIZ_CONFIG` を読むだけで外部にグローバルを公開していないため、影響はない。
`quiz.js` の DOM 操作・グレーディング・統計ロジックは変更しない（localStorage キーの導出のみ
下記「localStorage キー統一」に従って変更する）。

## base パス処理

`cert.data` を `import.meta.env.BASE_URL` 前置きの絶対パス（例 `/aws_learning/questions-saa.json`）にする。
これで `/aws_learning/dva` の末尾スラッシュ有無に関わらず fetch 先が一意に解決する。
現状の相対 fetch は末尾スラッシュ依存で壊れやすいため、この点のみ改善する。

## 命名の統一

SAA だけ特例だった命名を、他資格と同じ規則に揃える:

| 種類 | 旧（SAA） | 新（SAA） | 規則 |
|---|---|---|---|
| ページ | `index.html` | `saa.astro`（`/saa`） | `<code小文字>` |
| データ | `questions.json` | `questions-saa.json` | `questions-<code小文字>.json` |

- `index`（トップ `/`）は SAA ページではなく資格選択ハブになる（下記）
- リネームは `git mv` で行い履歴を保つ

## トップ（ハブ）ページ

`src/pages/index.astro` に資格選択のハブページを置く。

- 3資格（SAA / DVA / DEA）へのカードを並べ、各カードは対応ページ（`/saa` など）へ遷移
- 既存の `card` / `mode-btn` などのスタイル（`quiz.css`）を流用し、新規 CSS は最小限
- カードには資格名・正式名称・問題数程度を表示
- **非対象**: ハブでの通算統計の集計表示（資格をまたぐ集計は YAGNI。各資格ページ内の統計に留める）

## localStorage キー統一

現状は SAA のみ旧キー（`saaQuizStats_v1` / `saaQuizHistory_v1`）を使い、他資格は
`quizStats_<code>_v1` / `quizHistory_<code>_v1` を使う分岐がある。移行でこの SAA 特例を廃止し、
**全資格を統一パターンに揃える**:

```js
const LS_KEY  = "quizStats_"   + CFG.code + "_v1";   // 例: quizStats_SAA_v1
const LS_HIST = "quizHistory_"  + CFG.code + "_v1";   // 例: quizHistory_SAA_v1
```

- `quiz.js` の `LS_KEY` / `LS_HIST` 導出から `CFG.code === "SAA"` 分岐を削除する
- **SAA の旧キー（`saaQuizStats_v1` / `saaQuizHistory_v1`）のデータは破棄する**（移行しない）。
  結果として SAA の既存学習統計はリセットされる（ユーザー了承済み）
- 旧キーの自動移行・クリーンアップ処理は行わない（YAGNI。ブラウザに残るが未参照）

## デプロイ変更

- `.github/workflows/deploy.yml` を新設: `actions/checkout` → `actions/setup-node` →
  `npm ci` → `astro build` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- `astro.config.mjs` に `site: 'https://wao3299.github.io'`、`base: '/aws_learning'` を設定
- **リポジトリ設定 → Pages → Source を「GitHub Actions」に切り替える**（現在の「Deploy from
  branch」から）。この設定変更は CLI からは行えないため、ユーザーが手動で実施する
- `validate.yml` は現状維持（データ検証を継続）

## validate.js / CI

`FILES` を `public/questions-saa.json` / `public/questions-dva.json` / `public/questions-dea.json`
に更新する（パスの `public/` 対応と `questions.json` → `questions-saa.json` のリネーム反映）。
ロジック・CI（`validate.yml`）は変更しない。

## ローカル開発

- `npm run dev` … Astro 開発サーバー（`file://` 制約が消え、fetch も動く）
- `npm run build` / `npm run preview` … 本番同等の確認
- README を Astro 前提の手順に更新する

## 保持されるもの

- 実行時 fetch アーキテクチャ、337問、キーボード操作、本番タイマー等の挙動
- 問題データフォーマット（`d` / `t` / `q` / `o` / `a` / `oe` / `e`）
- localStorage による統計保存の仕組み（キー名のみ統一。SAA の既存統計はリセットされる）

## 非対象（YAGNI）

- 問題データの import 化・バンドル（実行時 fetch を維持）
- Astro アイランドでの React 等の部分導入
- 資格の動的追加 UI・問題データの外部 CMS 化
- DVA / DEA の本番タイマーモード（問題数が揃うまで保留）

## 作業手順（概略）

1. Astro プロジェクトを初期化（`package.json` / `astro.config.mjs`、`.gitignore` に `node_modules` `dist`）
2. `quiz.css` → `src/styles/`、`quiz.js` → `src/scripts/` へ移動。`questions*.json` を `public/` へ移動し
   `questions.json` は `questions-saa.json` にリネーム（`git mv`）。併せて `quiz.js` の localStorage
   キー導出を統一（`CFG.code === "SAA"` 分岐を削除）
3. `Base.astro` / `Quiz.astro` を作成（現 HTML と同一の要素・id・class を維持。ナビは `/saa` `/dva` `/dea`
   とハブへのリンク）
4. `src/pages/saa.astro` / `dva.astro` / `dea.astro` を作成（`cert` 定義のみ）
5. `src/pages/index.astro`（資格選択ハブ）を作成
6. ルートの旧 `index.html` / `dva.html` / `dea.html` を削除
7. `validate.js` の `FILES` を `public/questions-<code>.json` に更新し、構造チェックを通す
8. `deploy.yml` を追加、`astro build` がローカルで通ることを確認
9. `npm run dev` で全ページの全モード（ハブ → 各資格 / 腕試し / 苦手中心 / SAA 本番タイマー / 結果 /
   リセット / 資格間ナビ）を動作確認
10. Pages Source の「GitHub Actions」切り替えをユーザーに依頼し、本番反映を確認
