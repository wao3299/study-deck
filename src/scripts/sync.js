/* 認証と Firestore 同期。quiz.js からは initSync + notify 系 3 関数だけを使う。
   設計: docs/superpowers/specs/2026-07-08-firebase-login-sync-design.md
   firebase/* は apiKey 未設定時にバンドルへ含めないよう initSync 内で動的 import する */
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

// 動的 import で読み込む firebase 関数（initSync 完了後に使える）
let signOut, doc, getDoc, setDoc, deleteDoc, serverTimestamp;

export async function initSync(opts){
  if (!firebaseConfig.apiKey) return; // 設定未投入ならログイン UI ごと無効
  ctx = opts;
  const [appMod, authMod, fsMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  ({ doc, getDoc, setDoc, deleteDoc, serverTimestamp } = fsMod);
  ({ signOut } = authMod);
  const app = appMod.initializeApp(firebaseConfig);
  auth = authMod.getAuth(app);
  db = fsMod.getFirestore(app);
  el("loginbtn").onclick = () => authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()).catch(()=>{});
  el("logoutbtn").onclick = async () => {
    await flushPending();
    signOut(auth);
  };
  authMod.onAuthStateChanged(auth, u => {
    if (timerId){ clearTimeout(timerId); timerId = null; }
    user = u;
    denied = false;
    docRef = u ? doc(db, "users", u.uid, "decks", ctx.code) : null;
    updateAuthUi();
    if (u) pullAndReconcile(u);
  });
  window.addEventListener("pagehide", () => { flushPending(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPending();
  });
}

/* ペンディングのデバウンス push があれば即時実行する（ベストエフォート） */
function flushPending(){
  if (!timerId) return Promise.resolve();
  clearTimeout(timerId);
  timerId = null;
  return push(ctx.loadLocal()).catch(handleSyncError);
}

/* u と一致しない currentUser になっていたら中断（ログアウト/別アカウント切替の競合対策） */
function staleAuth(u){
  return !auth.currentUser || auth.currentUser.uid !== u.uid;
}

/* ログイン時の取り込み。このブラウザでこの uid が初回ならローカルをマージして
   クラウドへ書き戻し、2 回目以降はクラウドを正としてローカルを上書きする */
async function pullAndReconcile(u){
  const uDocRef = doc(db, "users", u.uid, "decks", ctx.code);
  let snap;
  try { snap = await getDoc(uDocRef); }
  catch(e){ if (!staleAuth(u)) handleSyncError(e); return; }
  if (staleAuth(u)) return;
  const cloud = snap.exists() ? snap.data() : { stats: {}, hist: [] };
  const flagKey = syncedUidKey(ctx.code);
  let next;
  if (localStorage.getItem(flagKey) === u.uid){
    next = { stats: cloud.stats || {}, hist: cloud.hist || [] };
  } else {
    next = mergeDeckData(ctx.loadLocal(), cloud);
    try { await push(next, uDocRef); }
    catch(e){ if (!staleAuth(u)) handleSyncError(e); return; }
    if (staleAuth(u)) return;
    localStorage.setItem(flagKey, u.uid);
  }
  ctx.saveLocal(next);
  ctx.onCloudApplied();
}

async function push(data, ref){
  await setDoc(ref || docRef, { stats: data.stats, hist: data.hist, updatedAt: serverTimestamp() });
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
