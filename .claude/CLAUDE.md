# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

学習用クイズサイト。複数のデック（現状は AWS 資格 SAA-C03 / DVA-C02 / DEA-C01）に対応。Astro で静的ビルドし、main への push で GitHub Actions（`.github/workflows/deploy.yml`）が GitHub Pages にデプロイする。

## コマンド

```bash
npm install
npm run dev       # http://localhost:4321/aws_learning/ （base パス付きに注意）
npm run build     # dist/ に静的出力
npm run preview   # ビルド結果の確認
npm run validate  # 問題データの構造チェック（CI の validate.yml でも実行）
```

テストフレームワークはない。検証は `npm run validate`（`scripts/validate.js`）のみ。

## アーキテクチャ

データフロー: 各ページ（`src/pages/<code>.astro`）が `deck` 設定オブジェクトを定義して `<Quiz deck={deck} />` に渡す → `Quiz.astro` が骨組み HTML を描画し、`window.QUIZ_CONFIG` をインライン script で注入してから `src/scripts/quiz.js`（クイズエンジン）を読み込む → エンジンは実行時に `deck.data`（`public/questions-<code>.json`）を fetch する。

- `src/components/Quiz.astro` が home/quiz/result 骨組みの唯一の実体。deck ごとの差分はすべて `deck` prop で注入する
- `quiz.js` はフレームワーク非依存の Vanilla JS エンジン。DOM ID 前提で `Quiz.astro` のマークアップと結合している
- `QUIZ_CONFIG` の注入はエンジン module より先に実行される必要がある（`Quiz.astro:90-91` の `is:inline` がその保証）
- `deck.data` は `import.meta.env.BASE_URL` 前置きの絶対パスにする（base=`/aws_learning` のため相対パスは壊れる）

### 語彙: deck

上位のまとまり（現状は AWS 資格だが将来は非資格テーマもありうる）は **deck** と呼ぶ。変数名・prop・CSS クラス・UI 文言で `cert` / 「資格」を使わない。問題データ内の `d`（分野）/ `t`（トピック）は既存語彙のまま。

### deck の追加手順

README.md の「デック（問題）の追加・修正」参照。要点: `public/questions-<code>.json` 作成 → `scripts/validate.js` の `FILES` に追加 → `src/pages/<code>.astro` 作成 → `Quiz.astro` のナビと `index.astro` のハブにリンク追加。

## 重要: localStorage の学習統計

学習統計は localStorage に deck ごと（`quizStats_<code>_v1` / `quizHistory_<code>_v1`）、問題ごとには `"d|t"` をキーとして保存される。**問題の `d` や `t` を変更するとその問題の統計がリセットされる**ので、問題修正時はむやみに変えない。`d|t` はファイル内で一意（validate.js がチェック。deck をまたいだ重複は可）。

## ドキュメント運用

設計ドキュメント（`docs/superpowers/specs/`）はリポジトリに残す。実装計画（`docs/superpowers/plans/`）は実行完了後に削除コミットする。
