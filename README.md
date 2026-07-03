# aws_learning

AWS 認定 SAA-C03 対策の自習用クイズ。GitHub Pages でホストする静的ページ。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | クイズアプリ本体。起動時に `questions.json` を fetch で読み込む |
| `questions.json` | 問題プール（297問）。これがマスターデータ |
| `scripts/validate.js` | `questions.json` の構造チェック。CI（push / PR 時）でも実行される |

## 問題データの形式

```json
{
 "d": "Storage",            // ドメイン（出題カテゴリ）
 "t": "S3ストレージクラス",   // トピック
 "q": "問題文",
 "o": ["選択肢1", "..."],
 "a": 1,                    // 正解。単一選択=インデックス数値 / 複数選択=インデックス配列
 "oe": ["選択肢1の解説", "..."],  // o と同順・同数
 "e": "まとめ解説（HTML可: <code> <strong>）"
}
```

## 問題の追加・修正

1. `questions.json` を編集する
2. `node scripts/validate.js` で構造チェック
3. push すれば Pages に反映される

### 注意: 学習統計のキー

ブラウザの学習履歴（正答率・苦手判定）は localStorage に `"ドメイン|トピック"`（`d|t`）をキーとして保存される。したがって:

- 問題文・選択肢・解説の修正、問題の並び替えは統計に影響しない
- **`d` や `t` を変更するとその問題の統計はリセット扱いになる**
- `d|t` は全問題で一意にすること（validate.js がチェックする）

また localStorage はオリジン単位のため、ホスト移転（claude.ai Artifact → Pages）で過去の統計は引き継がれない。

## ローカルでの動作確認

`questions.json` を fetch するため `file://` では動かない。HTTP サーバー経由で開く:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## 経緯

もとは claude.ai の Artifact として作成（2026-07 に全297問の正誤検証・修正を実施）。
claude.ai の Artifact は CSP により外部 fetch ができないため、データ分離にあたり GitHub Pages へ移行した。
