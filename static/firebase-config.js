// ▼▼▼【超重要】このファイルに、あなたのFirebaseプロジェクトの情報を一度だけ設定します ▼▼▼
const firebaseConfig = {
    apiKey: "AIzaSyDVRqM-lpb-d7qyg_XybSj8NNODJzQfl54",
    authDomain: "order-system-6988d.firebaseapp.com",
    projectId: "order-system-6988d",
    storageBucket: "order-system-6988d.firebasestorage.app",
    messagingSenderId: "483065639673",
    appId: "1:483065639673:web:c16edc113c2335072ea828",
    measurementId: "G-JHSLB3GWZS"
};
// ▲▲▲【超重要】このファイルに、あなたのFirebaseプロジェクトの情報を一度だけ設定します ▲▲▲

// Firebaseアプリを初期化する（もし未初期化の場合のみ）
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 他のJSファイルで使えるように、データベースのインスタンスをグローバル変数として定義
const db = firebase.firestore();