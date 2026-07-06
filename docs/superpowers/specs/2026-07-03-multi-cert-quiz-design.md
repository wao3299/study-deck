# マルチ資格クイズ設計

作成日: 2026-07-03

## 目的

現在 SAA-C03 専用のクイズアプリを、複数の AWS 認定資格に対応させる。
第一弾として **AWS Certified Developer - Associate (DVA-C02)** と
**AWS Certified Data Engineer - Associate (DEA-C01)** の問題を各20問追加する。

## 現状

- `index.html` に CSS・ロジック・SAA固有の文言がすべて含まれる単一ファイル構成
- `questions.json`（SAA 297問）を `fetch` で読み込む静的ページ（GitHub Pages ホスト）
- CI は `scripts/validate.js` で `questions.json` の構造を検証するのみ
- 学習統計は localStorage（`saaQuizStats_v1` / `saaQuizHistory_v1`）にオリジン単位で保存

## 方針

React 等のビルドツールは導入しない（静的 Pages 構成を維持）。
index.html のロジックを共通 JS に切り出し、資格ごとに薄い HTML ページを用意する。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `quiz.css` | 現 index.html の `<style>` を切り出し（全ページ共通） |
| `quiz.js` | 現 index.html の `<script>` を切り出した汎用ロジック。設定を `window.QUIZ_CONFIG` から読む |
| `index.html` | SAA-C03 ページ（設定 + データ指定の薄いラッパー） |
| `dva.html` | DVA-C02 ページ |
| `dea.html` | DEA-C01 ページ |
| `questions.json` | SAA 既存297問（**変更なし**） |
| `questions-dva.json` | DVA-C02 新規20問 |
| `questions-dea.json` | DEA-C01 新規20問 |

各ページ間の相互リンク（他資格への遷移）はヘッダーに簡易ナビとして置く。

## QUIZ_CONFIG スキーマ

各 HTML が `quiz.js` 読み込み前に定義するグローバル設定。

```js
window.QUIZ_CONFIG = {
  code: "SAA",                 // localStorage キー接頭辞・資格識別
  eyebrow: "AWS Certified · SAA-C03",
  title: "Solutions Architect Associate 腕試し",
  sub: "297問のプールから出題。…",
  data: "questions.json",      // 問題データファイル名
  exam: { enabled: true, n: 65, minutes: 130, passPct: 0.72 }, // 本番モード。無効なら enabled:false
  practiceN: 10                // 腕試しモードの出題数
};
```

- **SAA**: `exam.enabled = true`（65問/130分/72%）、`practiceN = 10`
- **DVA / DEA**: `exam.enabled = false`（本番タイマーモードなし）、`practiceN = 10`
  - モードは「10問腕試し」＋「苦手中心」の2つ

## localStorage 互換性

- 資格ごとにキーを分離する。キーは `code` から導出（例: `quizStats_DVA_v1`）
- **SAA の既存キーは維持**する: `code === "SAA"` のとき従来の `saaQuizStats_v1` /
  `saaQuizHistory_v1` を使い、既存ユーザーの統計をリセットしない
  - 実装上は `code` → キー名のマッピングで SAA のみ旧名にフォールバック

## 問題コンテンツ

既存フォーマットを踏襲する:

```json
{ "d": "分野", "t": "トピック", "q": "問題文",
  "o": ["選択肢…"], "a": 0, "oe": ["各選択肢の解説…"], "e": "まとめ解説(HTML可)" }
```

- `a` は単一選択=数値 / 複数選択=インデックス配列
- `d|t` は各ファイル内で一意
- `d`（分野）は既存 SAA と同じ「技術カテゴリ」粒度。各試験の主要ドメインをカバーする

### DVA-C02（20問）のカバー範囲

DVA-C02 の4ドメイン（開発32% / セキュリティ26% / デプロイ24% / トラブルシュート・最適化18%）を反映:

- 開発: Lambda（環境変数・レイヤー・同時実行）, DynamoDB（キー設計・LSI/GSI・条件付き書き込み）, API Gateway, SQS/SNS, Step Functions, ElastiCache
- セキュリティ: Cognito（User/Identity Pool）, IAM ロール, KMS 暗号化, Secrets Manager / Parameter Store
- デプロイ: CodePipeline / CodeBuild / CodeDeploy（デプロイ戦略）, SAM, Elastic Beanstalk, CloudFormation
- トラブルシュート・最適化: X-Ray, CloudWatch Logs/メトリクス, Lambda コールドスタート, DynamoDB スロットリング

### DEA-C01（20問）のカバー範囲

DEA-C01 の4ドメイン（取り込み・変換34% / ストア管理26% / 運用・サポート22% / セキュリティ・ガバナンス18%）を反映:

- 取り込み・変換: Kinesis（Data Streams / Firehose）, Glue（ETL・クローラ・Data Catalog）, EMR, Lambda, MSK, AWS DMS
- ストア管理: Redshift（分散キー・ソートキー・Spectrum）, S3（パーティション・ファイル形式 Parquet）, DynamoDB, Lake Formation
- 運用・サポート: Athena, Step Functions / MWAA（Airflow）, EventBridge, CloudWatch, Glue Data Quality
- セキュリティ・ガバナンス: Lake Formation 権限, KMS 暗号化, IAM, データマスキング, タグベースアクセス

## validate.js の拡張

- 現状 `questions.json` 固定 → 検証対象を3ファイル（`questions.json` /
  `questions-dva.json` / `questions-dea.json`）に拡張
- `d|t` 一意チェックは**ファイル単位**（資格をまたいだ重複は許容）
- いずれかのファイルで NG があれば非ゼロ終了。CI（validate.yml）はそのまま流用できる

## 作業手順

1. `quiz.css` / `quiz.js` を index.html から切り出し、`QUIZ_CONFIG` 対応に汎用化
2. `index.html` を薄いラッパーに書き換え（SAA 設定・既存 localStorage キー維持を確認）
3. `questions-dva.json` / `questions-dea.json` を作成（各20問、サブエージェントで分担生成）
4. `dva.html` / `dea.html` を作成
5. `validate.js` を3ファイル対応に拡張し、全ファイルの構造チェックを通す
6. ローカル HTTP サーバーで各ページの動作確認

## 非対象（YAGNI）

- 資格の動的追加 UI・管理画面
- 問題データの外部 CMS 化
- DVA/DEA の本番65問タイマーモード（問題数が揃うまで保留）
