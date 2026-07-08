# Firebase によるユーザログイン + 学習統計のデバイス間同期

日付: 2026-07-08
ステータス: 承認済み

## 目的

GitHub Pages でホストしている本クイズサイトに Google ログインを追加し、学習統計
（`quizStats_<code>_v1` / `quizHistory_<code>_v1`）をデバイス間で同期できるようにする。

- 利用者: 少人数の知人。各自が自分のアカウントを持ち、統計は個人ごとに分離する
- 運用方針: 管理ゼロ。サーバーコードや常時運用の面倒を持たない
- 未ログイン利用者の体験は一切変えない

## 方式選定

Supabase / Firebase / Auth0 / Cloudflare Workers + D1 / AWS (Cognito + Lambda +
DynamoDB) を比較し、**Firebase（Auth の Google ログイン + Cloud Firestore）** を採用。

- Auth0 は認証専業でデータ保存先が別途必要になるため落選
- Workers は認証の自作が必要でセキュリティ責任が重いため落選
- AWS は構成要素が多く管理ゼロ方針に反するため落選
- Supabase との比較では「無料プロジェクトは DB 無活動 7 日で一時停止する」仕様が
  少人数・不定期利用と相性が悪く、休止のない Firebase を選択
- Firebase 無料枠（Spark）: 認証 50,000 MAU、Firestore 1GB・読み取り 5 万/日・
  書き込み 2 万/日。本用途には十分

## 全体構成

- ホスティングは GitHub Pages のまま変更なし
- `bun add firebase` で依存に追加し、新規モジュール `src/scripts/sync.js` に
  認証・同期ロジックを分離する。`quiz.js` は「統計が変わったら sync.js に通知する」
  だけにして、クイズエンジンと同期の責務を分ける
- Firebase の設定値（apiKey 等）は公開前提の値なのでリポジトリにコミットする。
  保護は Firestore セキュリティルールが担う

## データモデル（Firestore）

```
users/{uid}/decks/{code}   ← deck ごとに 1 ドキュメント
  stats:  { "d|t": {seen, correct, wrong, lastWrong, lastSeen}, ... }
  hist:   [ {d, score, total, mode}, ... ]
  updatedAt: <timestamp>
```

localStorage の構造をそのまま写す。1 ドキュメント上限 1MiB に対して統計は
数十 KB 程度なので余裕がある。

## 同期ロジック

- **未ログイン時**: 従来通り localStorage のみ。挙動変化なし
- **ログイン時の取り込み**: ブラウザごとに「最後に同期した uid」フラグを localStorage
  に持つ。この uid で初回のログインならローカル統計をクラウドへ**マージ**する
  - seen / correct / wrong は加算
  - lastWrong / lastSeen は新しい方
  - 履歴は連結してタイムスタンプで重複排除し、時系列でソート
  - 2 回目以降のログイン（フラグ一致）はクラウドを正としてローカルを上書き
- **ログイン中**: 回答のたびにローカル保存（従来通り）+ 2 秒デバウンスで Firestore
  へ書き込み。セッション終了（履歴追加）時は即時書き込み。読み込みはページロード時の
  1 回のみ（リアルタイムリスナーは使わない。2 デバイス同時利用は last-write-wins で許容）
- **割り切り**: ログアウト中に解いた分は再ログイン時に反映されない（二重計上を
  避けるため）
- **リセット**: 学習データリセットはログイン中ならクラウド側のドキュメントも削除する

## UI 変更

- ホーム画面のヘッダーに「Google でログイン」ボタンを追加。ログイン中はアバター +
  名前 + ログアウトボタンを表示（`Quiz.astro` に追加、全 deck 共通）
- 同期状態の表示は最小限とし、同期失敗時のみ小さく警告を出す

## セキュリティルール

最初からメールアドレスの許可リストで利用者を絞る。

```
match /users/{uid}/{document=**} {
  allow read, write: if request.auth != null
    && request.auth.uid == uid
    && request.auth.token.email in [
         // 利用を許可する知人のメールアドレスを列挙
       ];
}
```

- 自分のデータしか読み書きできず、かつ許可リストにあるメールアドレスの
  アカウントでなければ一切保存・読み込みできない
- リスト外の人は Google ログイン自体は成功するが同期は動かず、ローカルのみの
  従来動作になる。クライアント側では同期失敗を検知して「このアカウントは同期を
  許可されていません」と表示する
- 知人の追加・削除は Firebase コンソールでルールを書き換えるだけ。コード変更や
  デプロイは不要

## コード外のセットアップ（手作業）

Firebase コンソールで以下を行う。手順は README に記載する。

1. Firebase プロジェクト作成
2. Authentication で Google サインインを有効化
3. Cloud Firestore を作成し、上記セキュリティルールを設定（許可する知人の
   メールアドレスを列挙する）
4. Authentication の承認済みドメインに GitHub Pages のドメインを追加

## 検証

テストフレームワークがないため手動検証とする。dev サーバーで 2 つのブラウザ
（またはシークレットウィンドウ）を使い、ログイン → 回答 → もう一方のブラウザで
統計が反映されることを確認する。`bun run validate` には影響しない。
