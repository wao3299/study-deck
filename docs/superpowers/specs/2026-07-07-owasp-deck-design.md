# OWASP Top 10:2025 デック追加 設計

## 目的

学習用クイズサイトに、OWASP Top 10:2025（Web アプリケーションセキュリティリスク）を題材とした新デックを追加する。初の非 AWS 資格デックであり、deck 抽象が資格以外のテーマでも機能することの実証も兼ねる。

## 対象リスト（公式サイトで検証済み）

OWASP Top 10:2025（https://owasp.org/Top10/2025/）の 10 カテゴリ:

| ID | 正式名 | `d`（分野表記） |
|----|--------|----------------|
| A01 | Broken Access Control | A01 アクセス制御 |
| A02 | Security Misconfiguration | A02 設定ミス |
| A03 | Software Supply Chain Failures | A03 サプライチェーン |
| A04 | Cryptographic Failures | A04 暗号化の不備 |
| A05 | Injection | A05 インジェクション |
| A06 | Insecure Design | A06 安全でない設計 |
| A07 | Authentication Failures | A07 認証の不備 |
| A08 | Software or Data Integrity Failures | A08 整合性の不備 |
| A09 | Security Logging and Alerting Failures | A09 ログ・アラート |
| A10 | Mishandling of Exceptional Conditions | A10 例外処理 |

## デック構成

- **問題数**: 20 問（各カテゴリ 2 問）
- **分野 `d`**: 上表の「ID + 日本語短縮名」。苦手分析が OWASP カテゴリ単位で機能する
- **トピック `t`**: 問題ごとの具体テーマ（例: 「IDOR」「パストラバーサル」）。`d|t` はファイル内一意（validate.js が検査）
- **構成**: 各カテゴリにつき
  1. 知識確認 1 問 — 定義・分類・「このインシデントはどのカテゴリに該当するか」
  2. シナリオ 1 問 — 実装/構成/インシデントを提示し、脆弱性の特定または最適な対策を選択
- **文体**: 既存デック（DVA/DEA）に合わせる。`oe` で全選択肢に個別解説、`e` に `<strong>` / `<code>` を用いた要点まとめ
- **内容の裏取り**: 2025 版で新設・再編されたカテゴリ（特に A03 サプライチェーン、A10 例外処理）は、問題作成時に公式の各カテゴリ詳細ページを取得して事実確認してから作問する

## 変更ファイル（README「デックの追加・修正」手順に準拠）

1. `public/questions-owasp.json` — 問題データ本体（新規、20 問）
2. `scripts/validate.js` — `FILES` に `public/questions-owasp.json` を追加
3. `src/pages/owasp.astro` — deck 設定ページ（新規）
4. `src/components/Quiz.astro` — ナビにリンク追加
5. `src/pages/index.astro` — ハブにデックカード追加

## deck 設定（owasp.astro）

```js
const deck = {
  code: "OWASP",
  active: "OWASP",
  eyebrow: "Web Security · OWASP Top 10:2025",
  title: "OWASP Top 10 腕試し",
  sub: "20問のプールから出題。腕試し10問／苦手中心モード。",
  data: `${import.meta.env.BASE_URL}questions-owasp.json`,
  practiceN: 10,
  exam: { enabled: false },
};
```

## 検証

- `bun run validate` が 20 問すべて合格すること
- `bun run build` が成功すること
- `bun run dev` で `/aws_learning/owasp` が動作し、ナビ・ハブからの導線があること

## 検討して却下した案

- **d を大分類（設計・実装・運用など）にまとめる案**: 分野数は減るが、Top 10 の学習という目的にはカテゴリ単位の苦手統計のほうが有用なため却下。

## 備考

- localStorage 統計キーは `quizStats_OWASP_v1` 等、問題単位は `d|t`。公開後に `d` / `t` を変更すると統計がリセットされる点は既存デックと同様。
