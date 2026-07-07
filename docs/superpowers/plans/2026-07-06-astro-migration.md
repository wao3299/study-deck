# Astro 移行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** マルチデック（AWS 資格 SAA / DVA / DEA）クイズを Astro に移行し、3ファイルに重複する HTML 骨組みを単一コンポーネントへ集約する。

**Architecture:** クイズエンジン（`quiz.js`）とスタイル（`quiz.css`）は移動のみで維持。骨組みは `Quiz.astro` に集約し、各ページは `deck` 設定を渡す薄い実装にする。問題データは `public/` に置き実行時 fetch を維持。GitHub Pages は GitHub Actions ビルドで配信する。

**Tech Stack:** Astro（静的出力）、Node.js 22、既存の Vanilla JS クイズエンジン、GitHub Actions（Pages デプロイ）。

## Global Constraints

- クイズエンジンのロジックは変更しない。例外は localStorage キー導出の統一のみ（`quiz.js`）。
- 上位のまとまりを指す語彙は `cert` / `資格` ではなく **`deck`**（変数・prop・CSS クラス・UI 文言）。
- 問題データ内の `d`（分野）・`t`（トピック）は既存語彙のまま。
- localStorage キーは全 deck で `quizStats_<code>_v1` / `quizHistory_<code>_v1` に統一。SAA の旧キー（`saaQuizStats_v1` / `saaQuizHistory_v1`）は破棄（移行しない・掃除しない）。
- ファイル命名は `<code小文字>.astro` / `questions-<code小文字>.json` に統一。トップ `/` は deck 選択ハブ。
- `deck.data` は `import.meta.env.BASE_URL` 前置きの絶対パス。
- サイト: `https://wao3299.github.io`、base: `/aws_learning`、`trailingSlash: 'always'`、`build.format: 'directory'`。
- 問題データフォーマット（`d` / `t` / `q` / `o` / `a` / `oe` / `e`）は不変。337問（SAA 297 / DVA 20 / DEA 20）。
- 自動生成ファイル（`package-lock.json`）は必ず `npm install` 経由で生成し、手書きしない。

---

## File Structure

作成/変更するファイルと責務:

- `package.json`（作成）— スクリプト（dev/build/preview/validate）と astro 依存
- `astro.config.mjs`（作成）— site / base / trailingSlash / build.format
- `.gitignore`（作成）— `node_modules/` `dist/` `.astro/`
- `src/layouts/Base.astro`（作成）— `<html><head>`、`quiz.css` import、`<slot />`
- `src/components/Quiz.astro`（作成）— ヘッダ + deck ナビ + home/quiz/result 骨組み（唯一の実体）
- `src/pages/saa.astro` / `dva.astro` / `dea.astro`（作成）— `deck` 定義のみ
- `src/pages/index.astro`（作成）— deck 選択ハブ
- `src/styles/quiz.css`（移動: 現 `quiz.css`）— `.cert-nav` → `.deck-nav` にリネーム
- `src/scripts/quiz.js`（移動: 現 `quiz.js`）— localStorage キー導出を統一
- `public/questions-saa.json`（リネーム: 現 `questions.json`）
- `public/questions-dva.json` / `public/questions-dea.json`（移動）
- `scripts/validate.js`（変更）— `FILES` を `public/questions-<code>.json` に更新
- `.github/workflows/deploy.yml`（作成）— Astro ビルド → Pages デプロイ
- `README.md`（変更）— Astro 前提の手順に更新
- 削除: ルートの `index.html` / `dva.html` / `dea.html`

---

## Task 1: Astro スキャフォールド + 静的資産の再配置 + エンジンのキー統一

**Files:**
- Create: `package.json`, `astro.config.mjs`, `.gitignore`
- Move: `quiz.css` → `src/styles/quiz.css`, `quiz.js` → `src/scripts/quiz.js`, `questions.json` → `public/questions-saa.json`, `questions-dva.json` → `public/questions-dva.json`, `questions-dea.json` → `public/questions-dea.json`
- Modify: `src/scripts/quiz.js`（LS キー）, `src/styles/quiz.css`（`.cert-nav` → `.deck-nav`）, `scripts/validate.js`

**Interfaces:**
- Produces: `npm run build` / `npm run dev` / `npm run validate` スクリプト。`src/scripts/quiz.js`（`window.QUIZ_CONFIG` を読むエンジン、後続タスクが `<script>` で import）。`src/styles/quiz.css`（`.deck-nav` 含む共通スタイル、Base.astro が import）。`public/questions-<code>.json`（実行時 fetch 先）。

- [ ] **Step 1: `package.json` を作成**

```json
{
  "name": "aws-learning-quiz",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "validate": "node scripts/validate.js"
  }
}
```

- [ ] **Step 2: Astro をインストール（`package-lock.json` を生成）**

Run: `npm install astro@latest`
Expected: `package.json` に `devDependencies`（または `dependencies`）として `astro` が追加され、`package-lock.json` と `node_modules/` が生成される。エラーなく完了。

- [ ] **Step 3: `astro.config.mjs` を作成**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://wao3299.github.io',
  base: '/aws_learning',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
```

- [ ] **Step 4: `.gitignore` を作成**

```gitignore
node_modules/
dist/
.astro/
```

- [ ] **Step 5: ディレクトリを作成し、資産を `git mv` で移動**

```bash
mkdir -p src/styles src/scripts public
git mv quiz.css src/styles/quiz.css
git mv quiz.js src/scripts/quiz.js
git mv questions.json public/questions-saa.json
git mv questions-dva.json public/questions-dva.json
git mv questions-dea.json public/questions-dea.json
```

Expected: `git status` で上記5ファイルが renamed として表示される。

- [ ] **Step 6: `src/styles/quiz.css` の `.cert-nav` を `.deck-nav` にリネーム**

`src/styles/quiz.css` 内の `cert-nav` を全て `deck-nav` に置換する（クラスセレクタ定義箇所すべて）。

Run: `sed -i '' 's/cert-nav/deck-nav/g' src/styles/quiz.css`
（macOS の BSD sed。Linux なら `sed -i 's/cert-nav/deck-nav/g' src/styles/quiz.css`）

確認: `grep -c cert-nav src/styles/quiz.css` → `0`、`grep -c deck-nav src/styles/quiz.css` → 1以上。

- [ ] **Step 7: `src/scripts/quiz.js` の localStorage キー導出を統一**

現在の定義（26-29 行目付近）:

```js
/* SAA は既存ユーザーの統計を維持するため旧キー名を使う。他資格は資格コード別 */
const LS_KEY = CFG.code === "SAA" ? "saaQuizStats_v1" : "quizStats_" + (CFG.code || "X") + "_v1";
const LS_HIST = CFG.code === "SAA" ? "saaQuizHistory_v1" : "quizHistory_" + (CFG.code || "X") + "_v1";
```

を次に置換する:

```js
/* localStorage キーは全 deck で統一（quizStats_<code>_v1 / quizHistory_<code>_v1） */
const LS_KEY = "quizStats_" + (CFG.code || "X") + "_v1";
const LS_HIST = "quizHistory_" + (CFG.code || "X") + "_v1";
```

- [ ] **Step 8: `scripts/validate.js` の `FILES` を更新**

現在（4行目付近）:

```js
// 検証対象。資格を追加したらここに足す
const FILES = ["questions.json", "questions-dva.json", "questions-dea.json"];
```

を次に置換する:

```js
// 検証対象。deck を追加したらここに足す
const FILES = ["public/questions-saa.json", "public/questions-dva.json", "public/questions-dea.json"];
```

- [ ] **Step 9: データ検証を実行**

Run: `npm run validate`
Expected: 各ファイルで OK が出て、末尾に `合計 337 問`。非ゼロ終了しない。

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "Astro をセットアップし静的資産を再配置・LSキーを統一

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Base レイアウト + Quiz コンポーネント + SAA ページ

**Files:**
- Create: `src/layouts/Base.astro`, `src/components/Quiz.astro`, `src/pages/saa.astro`
- Delete: `index.html`

**Interfaces:**
- Consumes: `src/scripts/quiz.js`, `src/styles/quiz.css`, `public/questions-saa.json`（Task 1）。
- Produces: `Base` レイアウト（prop `title: string`、default slot）。`Quiz` コンポーネント（prop `deck` — `{ code, active, eyebrow, title, sub, data, practiceN, exam:{enabled,n,minutes,passPct} }`）。ルーティング `/saa/`。後続タスク（DVA/DEA/ハブ）が同じ `Base` / `Quiz` を再利用する。

- [ ] **Step 1: `src/layouts/Base.astro` を作成**

```astro
---
import "../styles/quiz.css";
const { title } = Astro.props;
---
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title}</title>
</head>
<body>
<slot />
</body>
</html>
```

- [ ] **Step 2: `src/components/Quiz.astro` を作成**

```astro
---
const { deck } = Astro.props;
const base = import.meta.env.BASE_URL; // 例: /aws_learning/
const cfg = { code: deck.code, data: deck.data, practiceN: deck.practiceN, exam: deck.exam };
const passPct = Math.round((deck.exam?.passPct ?? 0.72) * 100);
---
<div class="wrap">
  <header>
    <p class="eyebrow">{deck.eyebrow}</p>
    <h1>{deck.title}</h1>
    <p class="sub">{deck.sub}</p>
    <nav class="deck-nav">
      <a href={base}>一覧</a>
      <a href={`${base}saa/`} class={deck.active === "SAA" ? "active" : undefined}>SAA</a>
      <a href={`${base}dva/`} class={deck.active === "DVA" ? "active" : undefined}>DVA</a>
      <a href={`${base}dea/`} class={deck.active === "DEA" ? "active" : undefined}>DEA</a>
    </nav>
    <span class="mode-tag" id="modetag">弱点復習モード</span>
    <div class="progress" id="progress">
      <div class="bar"><span id="barfill"></span></div>
      <div class="counter" id="counter">01 / 10</div>
      <div class="timer" id="timer" hidden></div>
    </div>
    <div class="lifetime" id="lifetime" hidden></div>
  </header>

  <section id="home" class="card">
    <div class="home-modes">
      {deck.exam.enabled && (
        <button class="mode-btn primary" id="startExam">
          <span class="mb-ico">{deck.exam.n}</span>
          <span class="mb-tt"><span class="mb-name">本番形式で挑戦</span><span class="mb-desc">{deck.exam.n}問・{deck.exam.minutes}分・合格ライン{passPct}%。本試験を再現。</span></span>
        </button>
      )}
      <button class={deck.exam.enabled ? "mode-btn" : "mode-btn primary"} id="startTest">
        <span class="mb-ico">{deck.practiceN}</span>
        <span class="mb-tt"><span class="mb-name">腕試し（{deck.practiceN}問）</span><span class="mb-desc">ランダムに{deck.practiceN}問。手軽に力試し。</span></span>
      </button>
      <button class="mode-btn" id="startWeak" hidden>
        <span class="mb-ico">◎</span>
        <span class="mb-tt"><span class="mb-name">苦手中心（{deck.practiceN}問）</span><span class="mb-desc">間違えた・未習得の問題を優先して{deck.practiceN}問。</span></span>
      </button>
    </div>
    <div class="statsbox" id="homestats"></div>
    <div class="home-foot"><button class="btn ghost" id="homereset" hidden>学習データをリセット</button></div>
  </section>

  <section id="quiz" class="card" aria-live="polite">
    <div class="qhead">
      <span class="chip domain" id="domain"></span>
      <span class="chip multi" id="multibadge" hidden>複数選択 — 2つ選べ</span>
    </div>
    <p class="qtext" id="qtext"></p>
    <div class="opts" id="opts"></div>
    <div class="explain" id="explain" hidden>
      <p class="verdict" id="verdict"></p>
      <p class="label">ポイント</p>
      <p class="body" id="expltext"></p>
    </div>
    <div class="nav" style="justify-content:space-between; align-items:center;">
      <span class="keyhint">A–E / 1–5 で選択・Enter で決定</span>
      <button class="btn" id="action" disabled>回答する</button>
    </div>
  </section>

  <section id="result" class="card result" hidden>
    <div class="score-ring">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="70" fill="none" stroke="#243040" stroke-width="12"></circle>
        <circle id="ring" cx="80" cy="80" r="70" fill="none" stroke="#F0A132" stroke-width="12"
                stroke-linecap="round" stroke-dasharray="439.8" stroke-dashoffset="439.8"></circle>
      </svg>
      <div class="num"><b id="scorenum">0</b><span id="scoredenom">/ 10</span></div>
    </div>
    <p class="verdict-line" id="rverdict"></p>
    <p class="verdict-desc" id="rdesc"></p>
    <div class="breakdown" id="breakdown"></div>
    <div class="statsbox" id="statsbox"></div>
    <div class="nav" style="justify-content:center; flex-wrap:wrap;">
      <button class="btn" id="weak" hidden>苦手中心で{deck.practiceN}問</button>
      <button class="btn" id="review" hidden>間違えた問題を復習</button>
      {deck.exam.enabled && <button class="btn" id="exambtn">本番{deck.exam.n}問に挑戦</button>}
      <button class="btn ghost" id="retry">新しい{deck.practiceN}問に挑戦</button>
      <button class="btn ghost" id="tohome">ホームへ</button>
      <button class="btn ghost" id="resetstats" hidden>学習データをリセット</button>
    </div>
  </section>
</div>

<script is:inline set:html={`window.QUIZ_CONFIG = ${JSON.stringify(cfg)};`}></script>
<script>import "../scripts/quiz.js";</script>
```

補足: `#domain` は現状 HTML では初期テキスト（"Storage" 等）が入っていたが、`quiz.js` の `render()` が `el("domain").textContent` で上書きするため空でよい。

- [ ] **Step 3: `src/pages/saa.astro` を作成**

```astro
---
import Base from "../layouts/Base.astro";
import Quiz from "../components/Quiz.astro";
const deck = {
  code: "SAA",
  active: "SAA",
  eyebrow: "AWS Certified · SAA-C03",
  title: "Solutions Architect Associate 腕試し",
  sub: "297問のプールから出題。腕試し10問／本番65問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions-saa.json`,
  practiceN: 10,
  exam: { enabled: true, n: 65, minutes: 130, passPct: 0.72 },
};
---
<Base title="SAA-C03 腕試しクイズ">
  <Quiz deck={deck} />
</Base>
```

- [ ] **Step 4: ルートの旧 `index.html` を削除**

```bash
git rm index.html
```

- [ ] **Step 5: ビルドを実行**

Run: `npm run build`
Expected: エラーなく完了し、`dist/saa/index.html` が生成される。

- [ ] **Step 6: ビルド出力を検証**

```bash
test -f dist/saa/index.html && echo "saa page OK"
grep -q '"code":"SAA"' dist/saa/index.html && echo "config code OK"
grep -q '/aws_learning/questions-saa.json' dist/saa/index.html && echo "data path OK"
grep -q 'deck-nav' dist/saa/index.html && echo "deck-nav OK"
grep -q 'id="startExam"' dist/saa/index.html && echo "exam button OK"
```

Expected: 5行すべて `... OK` が出力される。

- [ ] **Step 7: 手動スモーク（SAA ページ）**

Run: `npm run dev`（別ターミナル可）。ブラウザで `http://localhost:4321/aws_learning/saa/` を開く。
確認:
- 「本番形式で挑戦」ボタンが表示される
- 「腕試し（10問）」を押すと問題が読み込まれ（fetch 成功）、選択→回答→解説→次へ→結果画面まで進む
- 結果画面に「本番65問に挑戦」ボタンがある
- タイマー: 「本番形式で挑戦」を押すと残り時間が表示される
- リロードすると「苦手中心」ボタンとホーム統計が出る（localStorage 動作）
確認後 dev サーバーを停止。

- [ ] **Step 8: コミット**

```bash
git add -A
git commit -m "Base レイアウトと Quiz コンポーネントを追加し SAA ページを移行

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: DVA / DEA ページ

**Files:**
- Create: `src/pages/dva.astro`, `src/pages/dea.astro`
- Delete: `dva.html`, `dea.html`

**Interfaces:**
- Consumes: `Base`, `Quiz`（Task 2）、`public/questions-dva.json` / `public/questions-dea.json`（Task 1）。
- Produces: ルーティング `/dva/`, `/dea/`（本番モード無効の deck）。

- [ ] **Step 1: `src/pages/dva.astro` を作成**

```astro
---
import Base from "../layouts/Base.astro";
import Quiz from "../components/Quiz.astro";
const deck = {
  code: "DVA",
  active: "DVA",
  eyebrow: "AWS Certified · DVA-C02",
  title: "Developer Associate 腕試し",
  sub: "20問のプールから出題。腕試し10問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions-dva.json`,
  practiceN: 10,
  exam: { enabled: false },
};
---
<Base title="DVA-C02 腕試しクイズ">
  <Quiz deck={deck} />
</Base>
```

- [ ] **Step 2: `src/pages/dea.astro` を作成**

```astro
---
import Base from "../layouts/Base.astro";
import Quiz from "../components/Quiz.astro";
const deck = {
  code: "DEA",
  active: "DEA",
  eyebrow: "AWS Certified · DEA-C01",
  title: "Data Engineer Associate 腕試し",
  sub: "20問のプールから出題。腕試し10問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions-dea.json`,
  practiceN: 10,
  exam: { enabled: false },
};
---
<Base title="DEA-C01 腕試しクイズ">
  <Quiz deck={deck} />
</Base>
```

- [ ] **Step 3: ルートの旧 `dva.html` / `dea.html` を削除**

```bash
git rm dva.html dea.html
```

- [ ] **Step 4: ビルドを実行**

Run: `npm run build`
Expected: エラーなく完了し、`dist/dva/index.html` と `dist/dea/index.html` が生成される。

- [ ] **Step 5: ビルド出力を検証（本番ボタンが無いこと）**

```bash
grep -q '"code":"DVA"' dist/dva/index.html && echo "dva config OK"
grep -q '/aws_learning/questions-dva.json' dist/dva/index.html && echo "dva data OK"
grep -q 'id="startExam"' dist/dva/index.html && echo "NG: dva に本番ボタンがある" || echo "dva no-exam OK"
grep -q 'id="exambtn"' dist/dva/index.html && echo "NG: dva に exambtn がある" || echo "dva no-exambtn OK"
grep -q '"code":"DEA"' dist/dea/index.html && echo "dea config OK"
grep -q 'id="startExam"' dist/dea/index.html && echo "NG: dea に本番ボタンがある" || echo "dea no-exam OK"
```

Expected: `dva config OK` / `dva data OK` / `dva no-exam OK` / `dva no-exambtn OK` / `dea config OK` / `dea no-exam OK`。`NG:` は1つも出ない。

- [ ] **Step 6: 手動スモーク（DVA / DEA）**

Run: `npm run dev`。`http://localhost:4321/aws_learning/dva/` と `/aws_learning/dea/` を開く。
確認:
- 本番モードボタンが表示されない（腕試しが primary）
- 腕試しを1周でき、結果画面に「本番…に挑戦」ボタンが無い
- deck ナビの現在 deck が active、他 deck / 一覧リンクで遷移できる
確認後 dev サーバーを停止。

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "DVA / DEA ページを Astro に移行

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: deck 選択ハブ（トップページ）

**Files:**
- Create: `src/pages/index.astro`

**Interfaces:**
- Consumes: `Base`（Task 2）、既存スタイル `card` / `mode-btn` 系（`quiz.css`）。
- Produces: ルーティング `/`（`/aws_learning/`）。各 deck ページへのカードリンク。

- [ ] **Step 1: `src/pages/index.astro` を作成**

```astro
---
import Base from "../layouts/Base.astro";
const base = import.meta.env.BASE_URL;
const decks = [
  { href: `${base}saa/`, code: "SAA", name: "Solutions Architect Associate", note: "SAA-C03 · 297問" },
  { href: `${base}dva/`, code: "DVA", name: "Developer Associate", note: "DVA-C02 · 20問" },
  { href: `${base}dea/`, code: "DEA", name: "Data Engineer Associate", note: "DEA-C01 · 20問" },
];
---
<Base title="腕試しクイズ">
  <div class="wrap">
    <header>
      <p class="eyebrow">Quiz Decks</p>
      <h1>腕試しクイズ</h1>
      <p class="sub">挑戦するデックを選ぶ。</p>
    </header>
    <section class="card">
      <div class="home-modes">
        {decks.map((d) => (
          <a class="mode-btn" href={d.href}>
            <span class="mb-ico">{d.code}</span>
            <span class="mb-tt"><span class="mb-name">{d.name}</span><span class="mb-desc">{d.note}</span></span>
          </a>
        ))}
      </div>
    </section>
  </div>
</Base>
```

補足: `mode-btn` は現状 `<button>` に適用されているが、`display:flex` 等のスタイルは `<a>` でも同様に効く。遷移はリンクの `href` で行う。

- [ ] **Step 2: ビルドを実行**

Run: `npm run build`
Expected: エラーなく完了し、`dist/index.html` が生成される。

- [ ] **Step 3: ビルド出力を検証**

```bash
test -f dist/index.html && echo "hub page OK"
grep -q 'href="/aws_learning/saa/"' dist/index.html && echo "saa link OK"
grep -q 'href="/aws_learning/dva/"' dist/index.html && echo "dva link OK"
grep -q 'href="/aws_learning/dea/"' dist/index.html && echo "dea link OK"
```

Expected: 4行すべて `... OK`。

- [ ] **Step 4: 手動スモーク（ハブ）**

Run: `npm run dev`。`http://localhost:4321/aws_learning/` を開く。
確認: 3つのカードが並び、各カードをクリックすると対応する deck ページへ遷移する。各 deck ページのナビ「一覧」でハブに戻れる。確認後 dev サーバーを停止。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "deck 選択ハブ（トップページ）を追加

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: デプロイワークフロー + README 更新

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `package.json`（`npm ci` / `npm run build`）、`astro.config.mjs`。
- Produces: main への push で `dist/` をビルドし GitHub Pages にデプロイする GitHub Actions ワークフロー。

- [ ] **Step 1: `.github/workflows/deploy.yml` を作成**

```yaml
name: deploy
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

注意: `actions/upload-pages-artifact` / `actions/deploy-pages` / `actions/setup-node` / `actions/checkout` のメジャーバージョンは更新されることがある。実装時に各 action の最新安定版を確認し、必要なら上げること。

- [ ] **Step 2: `README.md` を更新**

`README.md` の内容を次に置き換える:

```markdown
# aws_learning

AWS 認定対策の自習用クイズ。複数のデック（SAA / DVA / DEA）に対応。Astro でビルドし GitHub Pages で配信する。

## デック

| ページ | デック | データ |
|---|---|---|
| `/` | 選択ハブ | — |
| `/saa/` | SAA-C03（297問・本番65問モードあり） | `public/questions-saa.json` |
| `/dva/` | DVA-C02（20問） | `public/questions-dva.json` |
| `/dea/` | DEA-C01（20問） | `public/questions-dea.json` |

## 構成

| ファイル | 役割 |
|---|---|
| `src/layouts/Base.astro` | `<html><head>` と共通スタイル読み込み |
| `src/components/Quiz.astro` | ヘッダ・deck ナビ・home/quiz/result 骨組み（唯一の実体） |
| `src/pages/*.astro` | 各 deck ページ（`deck` 設定を渡すだけ）とハブ |
| `src/scripts/quiz.js` | クイズエンジン。`window.QUIZ_CONFIG` を読む |
| `src/styles/quiz.css` | 全ページ共通スタイル |
| `public/questions-*.json` | 問題プール（マスターデータ） |
| `scripts/validate.js` | 問題データの構造チェック（CI で実行） |

## 開発

```bash
npm install
npm run dev       # http://localhost:4321/aws_learning/
npm run build     # dist/ に静的出力
npm run preview   # ビルド結果を確認
npm run validate  # 問題データの構造チェック
```

## デック（問題）の追加・修正

1. `public/questions-<code>.json` を編集（または新規追加）
2. 新規デックは `scripts/validate.js` の `FILES` に追加し、`src/pages/<code>.astro` を作成、`Quiz.astro` のナビと `src/pages/index.astro` のハブにリンクを足す
3. `npm run validate` で構造チェック
4. push すると GitHub Actions がビルドして Pages に反映

### 問題データの形式

```json
{
 "d": "分野",
 "t": "トピック",
 "q": "問題文",
 "o": ["選択肢1", "..."],
 "a": 1,
 "oe": ["選択肢1の解説", "..."],
 "e": "まとめ解説（HTML可: <code> <strong>）"
}
```

`a` は単一選択=インデックス数値 / 複数選択=インデックス配列。`d|t` は各ファイル内で一意。

### 学習統計（localStorage）

学習履歴は localStorage に `quizStats_<code>_v1` / `quizHistory_<code>_v1` で deck ごとに保存される。
キーは `d|t`。`d` や `t` を変更するとその問題の統計はリセット扱いになる。

## デプロイ

main への push で `.github/workflows/deploy.yml` がビルド・デプロイする。
リポジトリ設定 → Pages → Source は「GitHub Actions」であること。
```

- [ ] **Step 3: ワークフローの YAML 構文を確認**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/deploy.yml','utf8');if(!/upload-pages-artifact/.test(s)||!/deploy-pages/.test(s))process.exit(1);console.log('deploy.yml OK')"`
Expected: `deploy.yml OK`

- [ ] **Step 4: 最終ビルド確認**

Run: `npm run build && npm run validate`
Expected: ビルド成功、`合計 337 問`。

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "GitHub Actions での Pages デプロイと README を追加・更新

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: 統合動作確認とデプロイ切り替え

**Files:** なし（検証と手動操作）

- [ ] **Step 1: preview で全ページ・全モードを通し確認**

Run: `npm run build && npm run preview`。`http://localhost:4321/aws_learning/` から:
- ハブ → 各 deck へ遷移
- SAA: 腕試し10問 / 本番65問（タイマー）/ 苦手中心 / 結果 / 間違い復習 / 学習データリセット
- DVA・DEA: 腕試し / 苦手中心 / 結果（本番ボタン無し）
- deck 間ナビ・「一覧」リンク
- `#domain`（分野チップ）が各問題で正しく表示される
- 複数選択問題で「複数選択 — 2つ選べ」バッジが出る
確認後 preview を停止。

- [ ] **Step 2: エンジン読み込み順序の確認（重要）**

各 deck ページをブラウザで開き、DevTools コンソールに `QUIZ_CONFIG is not defined` 等のエラーが出ないこと、`window.QUIZ_CONFIG` が正しい `code` を返すことを確認する（コンソールで `QUIZ_CONFIG` と入力）。

- [ ] **Step 3: PR を作成しマージ**

変更を PR にまとめ、CI（`validate.yml`）が緑になることを確認してマージする。
（deploy.yml は main への push で走るため、マージ後に初回デプロイが実行される。）

- [ ] **Step 4: GitHub Pages の Source を切り替え（ユーザー手動操作）**

リポジトリ設定 → Pages → Source を「Deploy from branch」から **「GitHub Actions」** に切り替える。
その後 Actions の `deploy` ワークフローが成功し、`https://wao3299.github.io/aws_learning/` にハブが表示され、各 deck が動作することを確認する。

注意: この操作は CLI から行えない。実装エージェントはここでユーザーに切り替えを依頼して待つ。

---

## Self-Review

- **Spec coverage:**
  - Astro 化・骨組み集約 → Task 2（Quiz.astro）
  - deck 語彙・deck-nav → Task 1 Step 6、Task 2
  - ファイル命名統一（saa.astro / questions-saa.json）→ Task 1 Step 5、Task 2/3
  - トップ = ハブ → Task 4
  - localStorage キー統一 → Task 1 Step 7
  - base パス絶対化・trailingSlash → Task 1 Step 3、各ページの `deck.data` と `deck-nav`
  - エンジン読み込み順序（is:inline → bundled module）→ Task 2 Step 2、Task 6 Step 2 で検証
  - validate.js 更新 → Task 1 Step 8
  - deploy.yml + Pages Source 切り替え → Task 5、Task 6 Step 4
  - README → Task 5 Step 2
  - 実行時 fetch 維持（public/）→ Task 1 Step 5
- **Placeholder scan:** プレースホルダなし。全 astro/js/yaml/json は実コード。
- **Type consistency:** `deck` prop の形（`code/active/eyebrow/title/sub/data/practiceN/exam{enabled,n,minutes,passPct}`）は Task 2/3 の各ページと Quiz.astro で一致。`window.QUIZ_CONFIG` は `code/data/practiceN/exam` を持ち、`quiz.js` の `CFG.code` / `CFG.data` / `CFG.practiceN` / `CFG.exam` と一致。DVA/DEA は `exam:{enabled:false}` のみで、`quiz.js` は `EXAM.n || 65` 等でフォールバックするため安全。

## 既知の軽微な変更（実装時に留意）

- 腕試しボタンの説明文から具体的なプール数（「297問から」）を除き「ランダムに10問。」に一般化する（骨組み共通化のため）。構造・id・class は現状と同一。
