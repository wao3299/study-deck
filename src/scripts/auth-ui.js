/* 認証 UI（ログインボタン・ログイン状態表示）。deck ページ（sync.js 経由）と
   トップページの両方から使う。firebase/* は apiKey 未設定時にバンドルへ
   含めないよう動的 import する */
import { firebaseConfig } from "./firebase-config.js";

const el = id => document.getElementById(id);

/* firebase app + auth を初期化する。設定未投入・読み込み失敗時は null
   （ログイン UI は hidden のまま = 機能ごと無効） */
export async function initFirebaseAuth(){
  if (!firebaseConfig.apiKey) return null;
  let appMod, authMod;
  try {
    [appMod, authMod] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
  } catch(e){
    console.warn("firebase の読み込みに失敗したためログイン機能を無効化", e);
    return null;
  }
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  return { app, auth, authMod };
}

/* ログイン/ログアウトボタンを結合し、状態変化で表示を更新する。
   onAuthChanged は表示更新後に呼ばれる */
export function bindAuthUi(auth, authMod, { beforeSignOut, onAuthChanged } = {}){
  el("loginbtn").onclick = () => authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()).catch(()=>{});
  el("logoutbtn").onclick = async () => {
    if (beforeSignOut) await beforeSignOut();
    authMod.signOut(auth);
  };
  authMod.onAuthStateChanged(auth, u => {
    updateAuthUi(u);
    if (onAuthChanged) onAuthChanged(u);
  });
}

function updateAuthUi(user){
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

export function showAuthWarn(msg){
  const w = el("syncwarn");
  w.textContent = msg;
  w.hidden = false;
}
