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
