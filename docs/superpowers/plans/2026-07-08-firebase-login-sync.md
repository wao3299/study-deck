# Firebase ログイン + 学習統計同期 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GitHub Pages のクイズサイトに Google ログインを追加し、学習統計（quizStats / quizHistory）を Firestore でデバイス間同期できるようにする。

**Architecture:** Firebase Auth（Google ログイン）+ Cloud Firestore をクライアント JS のみで利用。認証・同期は新規モジュール `src/scripts/sync.js` に分離し、`quiz.js` は統計変更時に sync.js へ通知するだけ。マージ計算は Firebase 非依存の純関数 `src/scripts/merge.js` に分離して `bun test` で検証する。未ログイン時は従来の localStorage のみの動作を一切変えない。

**Tech Stack:** Astro 7 / Vanilla JS / Bun / firebase（npm パッケージ、モジュラー API）

**Spec:** `docs/superpowers/specs/2026-07-08-firebase-login-sync-design.md`

## Global Constraints

- パッケージ管理は **bun**（`bun add` / `bun.lock`）。npm / yarn は使わない
- 上位のまとまりは **deck** と呼ぶ。変数名・UI 文言で `cert` / 「資格」を使わない
- 問題データの `d` / `t` と localStorage キー（`quizStats_<code>_v1` / `quizHistory_<code>_v1`）は変更しない
- Firestore ドキュメントは `users/{uid}/decks/{code}`、フィールドは `stats` / `hist` / `updatedAt`
- 未ログイン時の挙動は現状維持（localStorage のみ）
- Firebase 設定値は公開前提としてコミットする。ただし未投入（apiKey 空）の間はログイン UI を出さない
- コミットメッセージは日本語・末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

## 手動セットアップ（ユーザー作業・コード外）

実装と並行してユーザーが Firebase コンソールで行う。Task 6 の README にも記載する。

1. https://console.firebase.google.com/ でプロジェクト作成（Analytics 不要）
2. Authentication → Sign-in method → **Google を有効化**
3. Firestore Database を作成（本番モード）→ ルールに Task 6 記載の許可リスト付きルールを設定
4. Authentication → Settings → 承認済みドメインに `wao3299.github.io` を追加（localhost はデフォルトで許可済み）
5. プロジェクトの設定 → マイアプリ → ウェブアプリを追加し、表示される `firebaseConfig` の `apiKey` / `authDomain` / `projectId` を `src/scripts/firebase-config.js` に転記

---

### Task 1: 統計マージの純関数 `merge.js`

**Files:**
- Create: `src/scripts/merge.js`
- Test: `src/scripts/merge.test.js`
- Modify: `package.json`（scripts に `"test": "bun test"` を追加）

**Interfaces:**
- Consumes: なし（依存ゼロの純関数）
- Produces: `mergeDeckData(local, cloud) -> {stats, hist}`
  - 引数はどちらも `{stats: {"d|t": {seen,correct,wrong,lastWrong,lastSeen}}, hist: [{d,score,total,mode}]}` 形。`stats` / `hist` が undefined でも動く
  - Task 3 の sync.js がこのシグネチャで呼ぶ

- [ ] **Step 1: 失敗するテストを書く**

`src/scripts/merge.test.js` を作成:

```js
import { test, expect } from "bun:test";
import { mergeDeckData } from "./merge.js";

const S = (seen, correct, wrong, lastWrong, lastSeen) => ({ seen, correct, wrong, lastWrong, lastSeen });

test("両方に存在するトピックは回数を加算し日時は新しい方を取る", () => {
  const local = { stats: { "EC2|AMI": S(4, 3, 1, 100, 200) }, hist: [] };
  const cloud = { stats: { "EC2|AMI": S(2, 1, 1, 300, 150) }, hist: [] };
  const out = mergeDeckData(local, cloud);
  expect(out.stats["EC2|AMI"]).toEqual(S(6, 4, 2, 300, 200));
});

test("片方にしかないトピックはそのまま残る", () => {
  const local = { stats: { "A|x": S(1, 1, 0, 0, 10) }, hist: [] };
  const cloud = { stats: { "B|y": S(2, 0, 2, 20, 20) }, hist: [] };
  const out = mergeDeckData(local, cloud);
  expect(out.stats["A|x"]).toEqual(S(1, 1, 0, 0, 10));
  expect(out.stats["B|y"]).toEqual(S(2, 0, 2, 20, 20));
});

test("履歴は連結して重複排除し時系列でソートされる", () => {
  const h1 = { d: 100, score: 5, total: 10, mode: "practice" };
  const h2 = { d: 200, score: 8, total: 10, mode: "exam" };
  const h3 = { d: 150, score: 6, total: 10, mode: "practice" };
  const local = { stats: {}, hist: [h1, h2] };
  const cloud = { stats: {}, hist: [h1, h3] }; // h1 が重複
  const out = mergeDeckData(local, cloud);
  expect(out.hist).toEqual([h1, h3, h2]);
});

test("stats や hist が欠けていても空として扱う", () => {
  const out = mergeDeckData({}, { stats: { "A|x": S(1, 0, 1, 5, 5) } });
  expect(out.stats["A|x"]).toEqual(S(1, 0, 1, 5, 5));
  expect(out.hist).toEqual([]);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `bun test src/scripts/merge.test.js`
Expected: FAIL（`Cannot find module './merge.js'`）

- [ ] **Step 3: 最小実装を書く**

`src/scripts/merge.js` を作成:

```js
/* ログイン時にローカル統計とクラウド統計を突き合わせる純関数。
   Firebase に依存させず bun test で検証できるよう sync.js から分離している */
export function mergeDeckData(local, cloud){
  const ls = local.stats || {}, cs = cloud.stats || {};
  const stats = {};
  new Set([...Object.keys(ls), ...Object.keys(cs)]).forEach(k=>{
    const l = ls[k], c = cs[k];
    if (!l || !c){ stats[k] = l || c; return; }
    stats[k] = {
      seen: l.seen + c.seen,
      correct: l.correct + c.correct,
      wrong: l.wrong + c.wrong,
      lastWrong: Math.max(l.lastWrong || 0, c.lastWrong || 0),
      lastSeen: Math.max(l.lastSeen || 0, c.lastSeen || 0),
    };
  });
  const seen = new Set();
  const hist = [...(local.hist || []), ...(cloud.hist || [])]
    .filter(h=>{
      const key = h.d + "|" + h.score + "|" + h.total + "|" + h.mode;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a,b)=> a.d - b.d);
  return { stats, hist };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `bun test src/scripts/merge.test.js`
Expected: 4 pass, 0 fail

- [ ] **Step 5: package.json に test スクリプトを追加**

`package.json` の `"scripts"` に 1 行追加:

```json
"test": "bun test"
```

Run: `bun run test`
Expected: 4 pass

- [ ] **Step 6: コミット**

```bash
git add src/scripts/merge.js src/scripts/merge.test.js package.json
git commit -m "統計マージの純関数 mergeDeckData を追加"
```

---

### Task 2: firebase 依存と設定モジュール、同期モジュール `sync.js`

**Files:**
- Modify: `package.json` / `bun.lock`（`bun add firebase` による自動更新のみ。手編集しない）
- Create: `src/scripts/firebase-config.js`
- Create: `src/scripts/sync.js`

**Interfaces:**
- Consumes: Task 1 の `mergeDeckData(local, cloud)`
- Produces（Task 4 の quiz.js が使う）:
  - `initSync({code, loadLocal, saveLocal, onCloudApplied})` — ページロード時に 1 回呼ぶ。`loadLocal()` は `{stats, hist}` を返す関数、`saveLocal({stats, hist})` は localStorage へ書く関数、`onCloudApplied()` はクラウド反映後の再描画コールバック
  - `notifyStatsChanged()` — 回答のたびに呼ぶ（2 秒デバウンスで Firestore へ書き込み）
  - `notifySessionEnd()` — セッション終了時に呼ぶ（即時書き込み）
  - `notifyReset()` — 学習データリセット時に呼ぶ（クラウドのドキュメントを削除）
  - 未ログイン・設定未投入・許可リスト外のとき、notify 系はすべて no-op
- Produces（Task 3 の Quiz.astro が用意する DOM ID に結合）: `loginbtn` / `authuser` / `authavatar` / `authname` / `logoutbtn` / `syncwarn`

- [ ] **Step 1: firebase を依存に追加**

```bash
bun add firebase
```

Expected: `package.json` の dependencies に `firebase` が追加され `bun.lock` が更新される

- [ ] **Step 2: 設定モジュールを作成**

`src/scripts/firebase-config.js` を作成:

```js
/* Firebase コンソールの「プロジェクトの設定 > マイアプリ」の firebaseConfig から転記する。
   apiKey は公開前提の識別子でシークレットではない（保護は Firestore セキュリティルール）。
   apiKey が空の間はログイン UI ごと無効になる（sync.js 参照） */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
};
```

- [ ] **Step 3: sync.js を実装**

`src/scripts/sync.js` を作成:

```js
/* 認証と Firestore 同期。quiz.js からは initSync + notify 系 3 関数だけを使う。
   設計: docs/superpowers/specs/2026-07-08-firebase-login-sync-design.md */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config.js";
import { mergeDeckData } from "./merge.js";

const el = id => document.getElementById(id);
const DEBOUNCE_MS = 2000;
const syncedUidKey = code => "quizSyncedUid_" + code + "_v1";

let ctx = null;      // initSync の引数
let auth = null, db = null, docRef = null;
let user = null;
let denied = false;  // 許可リスト外（permission-denied）を検知したら true
let timerId = null;

export function initSync(opts){
  if (!firebaseConfig.apiKey) return; // 設定未投入ならログイン UI ごと無効
  ctx = opts;
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  el("loginbtn").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(()=>{});
  el("logoutbtn").onclick = () => signOut(auth);
  onAuthStateChanged(auth, u => {
    user = u;
    denied = false;
    docRef = u ? doc(db, "users", u.uid, "decks", ctx.code) : null;
    updateAuthUi();
    if (u) pullAndReconcile();
  });
}

/* ログイン時の取り込み。このブラウザでこの uid が初回ならローカルをマージして
   クラウドへ書き戻し、2 回目以降はクラウドを正としてローカルを上書きする */
async function pullAndReconcile(){
  let snap;
  try { snap = await getDoc(docRef); }
  catch(e){ handleSyncError(e); return; }
  const cloud = snap.exists() ? snap.data() : { stats: {}, hist: [] };
  const flagKey = syncedUidKey(ctx.code);
  let next;
  if (localStorage.getItem(flagKey) === user.uid){
    next = { stats: cloud.stats || {}, hist: cloud.hist || [] };
  } else {
    next = mergeDeckData(ctx.loadLocal(), cloud);
    try { await push(next); } catch(e){ handleSyncError(e); return; }
    localStorage.setItem(flagKey, user.uid);
  }
  ctx.saveLocal(next);
  ctx.onCloudApplied();
}

async function push(data){
  await setDoc(docRef, { stats: data.stats, hist: data.hist, updatedAt: serverTimestamp() });
}

function schedulePush(immediate){
  if (!user || denied || !docRef) return;
  if (timerId){ clearTimeout(timerId); timerId = null; }
  const run = () => { timerId = null; push(ctx.loadLocal()).catch(handleSyncError); };
  if (immediate) run(); else timerId = setTimeout(run, DEBOUNCE_MS);
}

export function notifyStatsChanged(){ schedulePush(false); }
export function notifySessionEnd(){ schedulePush(true); }

export function notifyReset(){
  if (!user || denied || !docRef) return;
  if (timerId){ clearTimeout(timerId); timerId = null; }
  deleteDoc(docRef).catch(handleSyncError);
}

function updateAuthUi(){
  el("syncwarn").hidden = true;
  if (user){
    el("loginbtn").hidden = true;
    el("authuser").hidden = false;
    el("authavatar").src = user.photoURL || "";
    el("authname").textContent = user.displayName || user.email || "";
  } else {
    el("loginbtn").hidden = false;
    el("authuser").hidden = true;
  }
}

function handleSyncError(e){
  const w = el("syncwarn");
  if (e && e.code === "permission-denied"){
    denied = true;
    w.textContent = "このアカウントは同期を許可されていません";
  } else {
    w.textContent = "同期に失敗しました";
  }
  w.hidden = false;
}
```

- [ ] **Step 4: ビルドが通ることを確認**

Run: `bun run build`
Expected: エラーなく `dist/` が生成される（sync.js はまだどこからも import されていないが、構文エラー等はこの時点で拾えない点に注意。`bun build src/scripts/sync.js --outdir /tmp/synccheck --external firebase/*` でバンドルできることを確認してもよい）

Run: `bun run test`
Expected: Task 1 のテストが引き続き 4 pass

- [ ] **Step 5: コミット**

```bash
git add package.json bun.lock src/scripts/firebase-config.js src/scripts/sync.js
git commit -m "Firebase 認証と Firestore 同期モジュールを追加"
```

---

### Task 3: ログイン UI（Quiz.astro + quiz.css）

**Files:**
- Modify: `src/components/Quiz.astro:7-9`（header 冒頭に認証 UI を追加）
- Modify: `src/styles/quiz.css`（末尾にスタイル追加）

**Interfaces:**
- Consumes: なし（静的マークアップのみ）
- Produces: Task 2 の sync.js が参照する DOM ID `loginbtn` / `authuser` / `authavatar` / `authname` / `logoutbtn` / `syncwarn`

- [ ] **Step 1: Quiz.astro に認証 UI を追加**

`src/components/Quiz.astro` の `<header>` 直後（`<p class="eyebrow">` の前）に追加:

```html
<div class="auth-box">
  <span class="auth-warn" id="syncwarn" hidden></span>
  <button class="btn ghost auth-btn" id="loginbtn" hidden>Google でログイン</button>
  <span class="auth-user" id="authuser" hidden>
    <img class="auth-avatar" id="authavatar" alt="" referrerpolicy="no-referrer">
    <span id="authname"></span>
    <button class="btn ghost auth-btn" id="logoutbtn">ログアウト</button>
  </span>
</div>
```

`loginbtn` は `hidden` 始まりで、Firebase 設定投入済みのときだけ sync.js が表示する（設定未投入なら何も出ない）。

- [ ] **Step 2: quiz.css にスタイルを追加**

`src/styles/quiz.css` の末尾に追加:

```css
/* 認証 UI（ヘッダー右上） */
.auth-box { display: flex; justify-content: flex-end; align-items: center; gap: 10px; min-height: 30px; margin-bottom: 4px; }
.auth-btn { font-size: 12px; padding: 4px 12px; }
.auth-user { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-soft); }
.auth-avatar { width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line); }
.auth-warn { font-size: 12px; color: var(--bad); }
```

- [ ] **Step 3: ビルドと表示確認**

Run: `bun run build`
Expected: エラーなし

Run: `bun run dev` → http://localhost:4321/study-deck/saa/ を開く
Expected: 見た目は従来と変わらない（設定未投入のため認証 UI は全部 hidden。ヘッダー右上に 30px の余白だけ増える）

- [ ] **Step 4: コミット**

```bash
git add src/components/Quiz.astro src/styles/quiz.css
git commit -m "ヘッダーにログイン UI を追加"
```

---

### Task 4: quiz.js への同期組み込み

**Files:**
- Modify: `src/scripts/quiz.js:1`（import 追加）、`quiz.js:42`（recordAnswer）、`quiz.js:408`（showResult）、`quiz.js:427`（resetAll）、`quiz.js:453`（boot 前に initSync）
  ※ 行番号は組み込み前のもの

**Interfaces:**
- Consumes: Task 2 の `initSync` / `notifyStatsChanged` / `notifySessionEnd` / `notifyReset`
- Produces: なし（最終統合）

- [ ] **Step 1: import を追加**

`quiz.js` 先頭のコメントブロック直後（`const CFG = ...` の前）に追加:

```js
import { initSync, notifyStatsChanged, notifySessionEnd, notifyReset } from "./sync.js";
```

- [ ] **Step 2: 統計変更の通知を 3 箇所に追加**

recordAnswer 内 `saveLS(LS_KEY, STATS);` の直後に:

```js
  notifyStatsChanged();
```

showResult 内 `saveLS(LS_HIST, hist);` の直後に:

```js
  notifySessionEnd();
```

resetAll 内 `STATS = {}; saveLS(LS_KEY, STATS); saveLS(LS_HIST, []);` の直後に:

```js
    notifyReset();
```

- [ ] **Step 3: initSync 呼び出しを追加**

ファイル末尾の `boot();` の直前に追加:

```js
initSync({
  code: CFG.code || "X",
  loadLocal: () => ({ stats: loadLS(LS_KEY, {}), hist: loadLS(LS_HIST, []) }),
  saveLocal: (d) => { saveLS(LS_KEY, d.stats); saveLS(LS_HIST, d.hist); },
  onCloudApplied: () => {
    STATS = loadLS(LS_KEY, {});
    /* 問題データ取得前（ALL 未設定）なら boot 側の初回描画に任せる */
    if (ALL.length && !el("home").hidden) renderHomeStats();
  },
});
```

- [ ] **Step 4: ビルドと退行確認**

Run: `bun run build`
Expected: エラーなし

Run: `bun run dev` → http://localhost:4321/study-deck/saa/ で 1 セッション解く
Expected: 未ログイン（設定未投入）で従来通り動く。回答・結果・統計表示・リセットに変化なし。コンソールにエラーが出ない

Run: `bun run test` と `bun run validate`
Expected: どちらも pass

- [ ] **Step 5: コミット**

```bash
git add src/scripts/quiz.js
git commit -m "quiz.js に統計同期の通知と初期化を組み込み"
```

---

### Task 5: README にセットアップ手順を追記

**Files:**
- Modify: `README.md`（末尾にセクション追加）

**Interfaces:**
- Consumes: なし
- Produces: なし（ドキュメントのみ）

- [ ] **Step 1: README にセクションを追加**

`README.md` 末尾に追加:

````markdown
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
````

- [ ] **Step 2: コミット**

```bash
git add README.md
git commit -m "README に Firebase セットアップ手順と同期仕様を追記"
```

---

### Task 6: 実機での手動検証（Firebase プロジェクト作成後）

**Files:**
- Modify: `src/scripts/firebase-config.js`（実際の設定値を転記）

**Interfaces:**
- Consumes: 全タスクの成果物 + ユーザーの Firebase コンソール作業（冒頭「手動セットアップ」参照）

前提: ユーザーが Firebase プロジェクトを作成し設定値を提供していること。未提供ならこのタスクはスキップし、提供後に実施する。

- [ ] **Step 1: 設定値を転記**

`src/scripts/firebase-config.js` の `apiKey` / `authDomain` / `projectId` にコンソールの値を転記する。

- [ ] **Step 2: 手動検証チェックリスト**

`bun run dev` で http://localhost:4321/study-deck/saa/ を開き:

1. ヘッダー右上に「Google でログイン」が表示される
2. 許可リスト内のアカウントでログイン → アバターと名前が表示される
3. 数問解く → Firebase コンソールの Firestore で `users/{uid}/decks/SAA` に stats が書かれている
4. 別ブラウザ（またはシークレットウィンドウ）で同じアカウントでログイン → ホームの統計に反映されている
5. ログアウト → ローカル統計はそのまま残り従来動作
6. 許可リスト外のアカウントでログイン → 「このアカウントは同期を許可されていません」が表示され、クイズは通常通り遊べる
7. ログイン中に「学習データをリセット」→ Firestore のドキュメントが消えている

- [ ] **Step 3: コミット**

```bash
git add src/scripts/firebase-config.js
git commit -m "Firebase プロジェクトの設定値を投入"
```

---

## 完了後

- 実装計画（このファイル）は実行完了後に削除コミットする（プロジェクトのドキュメント運用ルール）
- push・PR 作成はユーザーの指示を待つ
