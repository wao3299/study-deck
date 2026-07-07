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
