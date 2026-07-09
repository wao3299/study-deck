# study-deck

自習用クイズ。複数のデック（AWS 認定 SAA / DVA / DEA、OWASP Top 10）に対応。Astro でビルドし GitHub Pages で配信する。

## デック

| ページ | デック | データ |
|---|---|---|
| `/` | 選択ハブ | — |
| `/saa/` | SAA-C03（297問・本番65問モードあり） | `public/questions-saa.json` |
| `/dva/` | DVA-C02（20問） | `public/questions-dva.json` |
| `/dea/` | DEA-C01（20問） | `public/questions-dea.json` |
| `/owasp/` | OWASP Top 10:2025（20問） | `public/questions-owasp.json` |

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
bun install
bun run dev       # http://localhost:4321/study-deck/
bun run build     # dist/ に静的出力
bun run preview   # ビルド結果を確認
bun run validate  # 問題データの構造チェック
```

## デック（問題）の追加・修正

1. `public/questions-<code>.json` を編集（または新規追加）
2. 新規デックは `scripts/validate.js` の `FILES` に追加し、`src/pages/<code>.astro` を作成、`Quiz.astro` のナビと `src/pages/index.astro` のハブにリンクを足す
3. `bun run validate` で構造チェック
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

## ログインと統計同期（Firebase）

Google ログインすると学習統計（成績・苦手記録・履歴）が Firestore に保存され、
デバイス間で同期される。未ログインでも従来通り localStorage のみで動作する。

### 初回セットアップ（Firebase コンソール）

1. [Firebase コンソール](https://console.firebase.google.com/)でプロジェクトを作成（Analytics 不要）
2. Authentication → Sign-in method で **Google** を有効化
3. Firestore Database を作成（本番モード）し、ルールに以下を設定。
   `email in [...]` の配列が利用を許可する人の許可リスト。知人の追加・削除は
   この配列を書き換えるだけでよい（コード変更・デプロイ不要）

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null
           && request.auth.uid == uid
           && request.auth.token.email in [
                'example@gmail.com'
              ];
       }
     }
   }
   ```

4. Authentication → Settings → 承認済みドメインに `wao3299.github.io` を追加
5. プロジェクトの設定 → マイアプリでウェブアプリを追加し、表示される
   `firebaseConfig` の `apiKey` / `authDomain` / `projectId` を
   `src/scripts/firebase-config.js` に転記してコミット

`apiKey` は公開前提の識別子でシークレットではない。データ保護は上記の
セキュリティルールが担う。

### 同期の仕様

- deck ごとに `users/{uid}/decks/{code}` の 1 ドキュメントに保存
- 各ブラウザで初回ログイン時はローカル統計をクラウドへマージ（回数は加算、履歴は連結）。
  2 回目以降はクラウドが正
- ログアウト中に解いた分は再ログイン時に反映されない（二重計上を避けるため）
- 許可リスト外のアカウントでログインすると「このアカウントは同期を許可されていません」と
  表示され、ローカルのみの従来動作になる
- 「学習データをリセット」はログイン中ならクラウド側も削除する
