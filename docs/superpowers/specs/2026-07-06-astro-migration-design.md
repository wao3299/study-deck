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
- `questions.json`（SAA 297問）/ `questions-dva.json`（20問）/ `questions-dea.json`（20問）
- `scripts/validate.js` … 3ファイルを構造検証（CI: `validate.yml`）
- 学習統計は localStorage にオリジン単位で保存。SAA は旧キー（`saaQuizStats_v1` /
  `saaQuizHistory_v1`）、他資格は `quizStats_<code>_v1` / `quizHistory_<code>_v1`
- デプロイ: GitHub Pages「Deploy from branch: main / (root)」。URL は
  `https://wao3299.github.io/aws_learning/`（base パス `/aws_learning/`、カスタムドメインなし）
- データは実行時に相対 `fetch(DATA_FILE)` で読み込み

### 残っている重複（移行で解消する対象）

3枚の HTML の `home` / `quiz` / `result` セクションのマークアップがほぼ丸ごと重複している。
資格ごとの差分は「タイトル・eyebrow・sub・ナビの active・本番モードボタンの有無・`QUIZ_CONFIG`」のみ。

## 方針

Astro を導入し、骨組みを単一コンポーネント化する。ただしクイズエンジンのロジックは変更しない
（移行は構造のみ）。実行時 fetch アーキテクチャと localStorage キーは維持し、既存ユーザーの
学習統計を保持する。

## プロジェクト構成（移行後）

```
astro.config.mjs          # site + base:'/aws_learning' 設定
package.json              # astro 依存・build / dev スクリプト
src/
  layouts/Base.astro       # <html><head>、quiz.css 読み込み、<slot />
  components/Quiz.astro     # ヘッダ+資格ナビ+home/quiz/result 骨組み（唯一の実体）
  pages/
    index.astro            # SAA: cert を定義して <Quiz> に渡すだけ
    dva.astro              # DVA
    dea.astro              # DEA
  styles/quiz.css          # 現 quiz.css を移動
  scripts/quiz.js          # 現 quiz.js をほぼそのまま（DOM 操作・ロジック不変）
public/
  questions.json           # データ3つは static 資産として据え置き（実行時 fetch 維持）
  questions-dva.json
  questions-dea.json
scripts/validate.js        # 据え置き（参照パスのみ public/ に調整）
```

ルート直下の `index.html` / `dva.html` / `dea.html` は削除し、`src/pages/*.astro` に置き換える。
現 `quiz.css` / `quiz.js` はルートから `src/` 配下へ移動する。

## コンポーネント設計

### `cert` prop スキーマ

各ページが定義し `<Quiz cert={cert} />` で渡す。表示文言と `QUIZ_CONFIG` 相当を一体化する。

```js
const cert = {
  code: "SAA",                 // localStorage キー導出・資格識別
  active: "SAA",               // 資格ナビの active 表示
  eyebrow: "AWS Certified · SAA-C03",
  title: "Solutions Architect Associate 腕試し",
  sub: "297問のプールから出題。腕試し10問／本番65問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions.json`, // base 前置きの絶対パス
  practiceN: 10,
  exam: { enabled: true, n: 65, minutes: 130, passPct: 0.72 },
};
```

- **SAA**: `exam.enabled = true`、`data = .../questions.json`
- **DVA**: `exam.enabled = false`、`data = .../questions-dva.json`
- **DEA**: `exam.enabled = false`、`data = .../questions-dea.json`

### `Quiz.astro` の責務

- ヘッダ（eyebrow / title / sub）と資格ナビ（`cert.active` で active を付与）を描画
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
`quiz.js` の DOM 操作・グレーディング・localStorage・統計ロジックは一切変更しない。

## base パス処理

`cert.data` を `import.meta.env.BASE_URL` 前置きの絶対パス（例 `/aws_learning/questions.json`）にする。
これで `/aws_learning/dva` の末尾スラッシュ有無に関わらず fetch 先が一意に解決する。
現状の相対 fetch は末尾スラッシュ依存で壊れやすいため、この点のみ改善する。

## デプロイ変更

- `.github/workflows/deploy.yml` を新設: `actions/checkout` → `actions/setup-node` →
  `npm ci` → `astro build` → `actions/upload-pages-artifact` → `actions/deploy-pages`
- `astro.config.mjs` に `site: 'https://wao3299.github.io'`、`base: '/aws_learning'` を設定
- **リポジトリ設定 → Pages → Source を「GitHub Actions」に切り替える**（現在の「Deploy from
  branch」から）。この設定変更は CLI からは行えないため、ユーザーが手動で実施する
- `validate.yml` は現状維持（データ検証を継続）

## validate.js / CI

`FILES` の参照パスを `public/` 配下に合わせるのみ。ロジック・CI（`validate.yml`）は変更しない。

## ローカル開発

- `npm run dev` … Astro 開発サーバー（`file://` 制約が消え、fetch も動く）
- `npm run build` / `npm run preview` … 本番同等の確認
- README を Astro 前提の手順に更新する

## 保持されるもの

- localStorage キー（SAA=旧キー維持、他=資格コード別）→ 既存ユーザーの統計は消えない
- 実行時 fetch アーキテクチャ、337問、キーボード操作、本番タイマー等の挙動
- 問題データフォーマット（`d` / `t` / `q` / `o` / `a` / `oe` / `e`）

## 非対象（YAGNI）

- 問題データの import 化・バンドル（実行時 fetch を維持）
- Astro アイランドでの React 等の部分導入
- 資格の動的追加 UI・問題データの外部 CMS 化
- DVA / DEA の本番タイマーモード（問題数が揃うまで保留）

## 作業手順（概略）

1. Astro プロジェクトを初期化（`package.json` / `astro.config.mjs`、`.gitignore` に `node_modules` `dist`）
2. `quiz.css` → `src/styles/`、`quiz.js` → `src/scripts/`、`questions*.json` → `public/` へ移動
3. `Base.astro` / `Quiz.astro` を作成（現 HTML と同一の要素・id・class を維持）
4. `src/pages/index.astro` / `dva.astro` / `dea.astro` を作成（`cert` 定義のみ）
5. ルートの旧 `index.html` / `dva.html` / `dea.html` を削除
6. `validate.js` の参照パスを `public/` に調整し、構造チェックを通す
7. `deploy.yml` を追加、`astro build` がローカルで通ることを確認
8. `npm run dev` で3ページの全モード（腕試し / 苦手中心 / SAA 本番タイマー / 結果 / リセット）を動作確認
9. Pages Source の「GitHub Actions」切り替えをユーザーに依頼し、本番反映を確認
