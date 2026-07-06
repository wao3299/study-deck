# aws_learning

AWS 認定資格対策の自習用クイズ。GitHub Pages でホストする静的ページ。
SAA-C03 / DVA-C02 / DEA-C01 の3資格に対応。

## 構成

共通ロジックを `quiz.js` / `quiz.css` に切り出し、資格ごとに薄い HTML ページを置く構成。

| ファイル | 役割 |
|---|---|
| `quiz.css` | 全ページ共通のスタイル |
| `quiz.js` | 全ページ共通のクイズロジック。`window.QUIZ_CONFIG` を読んで動作 |
| `index.html` | SAA-C03 ページ（本番65問モードあり） |
| `dva.html` | DVA-C02 ページ |
| `dea.html` | DEA-C01 ページ |
| `questions.json` | SAA-C03 問題プール（297問） |
| `questions-dva.json` | DVA-C02 問題プール（20問） |
| `questions-dea.json` | DEA-C01 問題プール（20問） |
| `scripts/validate.js` | 全問題ファイルの構造チェック。CI（push / PR 時）でも実行される |

### QUIZ_CONFIG

各 HTML が `quiz.js` 読み込み前に定義する設定オブジェクト:

```js
window.QUIZ_CONFIG = {
  code: "SAA",              // localStorage キー接頭辞・資格識別
  data: "questions.json",   // 問題データファイル名
  practiceN: 10,            // 腕試し・苦手モードの出題数
  exam: { enabled: true, n: 65, minutes: 130, passPct: 0.72 } // 本番モード。無効なら { enabled: false }
};
```

- SAA: `exam.enabled = true`（本番65問/130分/72%）
- DVA / DEA: `exam.enabled = false`（腕試し10問＋苦手中心の2モード）

資格を追加するときは、問題 JSON を作り、`QUIZ_CONFIG` を書いた HTML を用意し、
`scripts/validate.js` の `FILES` 配列に JSON を追加する。

## 問題データの形式

```json
{
 "d": "Storage",            // 分野（出題カテゴリ）
 "t": "S3ストレージクラス",   // トピック
 "q": "問題文",
 "o": ["選択肢1", "..."],
 "a": 1,                    // 正解。単一選択=インデックス数値 / 複数選択=インデックス配列
 "oe": ["選択肢1の解説", "..."],  // o と同順・同数
 "e": "まとめ解説（HTML可: <code> <strong>）"
}
```

## 問題の追加・修正

1. 該当の問題ファイル（`questions.json` / `questions-dva.json` / `questions-dea.json`）を編集する
2. `node scripts/validate.js` で構造チェック（全ファイルを検証）
3. push すれば Pages に反映される

### 注意: 学習統計のキー

ブラウザの学習履歴（正答率・苦手判定）は localStorage に `"分野|トピック"`（`d|t`）をキーとして保存される。したがって:

- 問題文・選択肢・解説の修正、問題の並び替えは統計に影響しない
- **`d` や `t` を変更するとその問題の統計はリセット扱いになる**
- `d|t` は各ファイル内で一意にすること（validate.js がチェックする。資格をまたいだ重複は許容）

学習統計は資格ごとに別の localStorage キーで分離される（`quizStats_<code>_v1`）。
ただし SAA は既存ユーザーの統計を維持するため旧キー名（`saaQuizStats_v1`）を使う。
また localStorage はオリジン単位のため、ホスト移転で過去の統計は引き継がれない。

## ローカルでの動作確認

問題 JSON を fetch するため `file://` では動かない。HTTP サーバー経由で開く:

```bash
python3 -m http.server 8000
# → http://localhost:8000        (SAA)
#   http://localhost:8000/dva.html
#   http://localhost:8000/dea.html
```

## 経緯

もとは claude.ai の Artifact として SAA-C03 用に作成（2026-07 に全297問の正誤検証・修正を実施）。
claude.ai の Artifact は CSP により外部 fetch ができないため、データ分離にあたり GitHub Pages へ移行。
その後、共通ロジックを `quiz.js` / `quiz.css` に切り出し、DVA-C02 / DEA-C01 を各20問追加してマルチ資格対応にした。
