/* Firebase コンソールの「プロジェクトの設定 > マイアプリ」の firebaseConfig から転記する。
   apiKey は公開前提の識別子でシークレットではない（保護は Firestore セキュリティルール）。
   apiKey が空の間はログイン UI ごと無効になる（sync.js 参照） */
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
};
