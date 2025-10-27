/**
 * ====================================================================
 * 会計・受取ページ (cashier.js)
 * ====================================================================
 * 担当：会計・商品受け渡し係
 * 機能：
 * 1. QRコードまたは番号手入力で注文を呼び出す
 * 2. 支払い状況を確認し、未会計の場合は会計ページへ遷移
 * 3. 「提供可能」な注文をリアルタイムでリスト表示
 * 4. リストの注文をクリックし、商品受け渡し後に「完了」ステータスにする
 */

document.addEventListener('DOMContentLoaded', () => {

    // Firebase Authenticationのインスタンスを取得
const auth = firebase.auth();

/**
 * Flaskサーバーからカスタムトークンを取得し、Firebaseにサインインする関数
 */
async function signInWithCustomToken() {
    try {
        // 1. まずFlaskサーバーに「証明書ください」とお願いする
        const response = await fetch('/api/get_firebase_token');
        const data = await response.json();

        if (data.token) {
            // 2. 受け取った証明書を使って、Firebaseに「この証明書でログインします」と伝える
            await auth.signInWithCustomToken(data.token);
            console.log('Firebase Authentication successful.');
        } else {
            console.error('Failed to get custom token:', data.error);
        }
    } catch (error) {
        console.error('Error during Firebase Authentication:', error);
        // 認証に失敗した場合、ページをリロードするか、ログインページにリダイレクトする
        alert('認証に失敗しました。ページを再読み込みします。');
        window.location.reload();
    }
}

    // --- 1. HTML要素の取得 ---
    const toastEl = document.getElementById('toast');
    const ticketInputEl = document.getElementById('ticket-input');
    const submitBtnEl = document.getElementById('submit-ticket');
    const readyListContainerEl = document.getElementById('ready-list-container');
    let html5QrcodeScanner; // QRスキャナのインスタンスを保持

    // --- 全画面表示ボタンの処理 ---
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            }
        });
        document.addEventListener('fullscreenchange', () => {
            document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
        });
    }

    // --- 2. 関数定義 ---

    /**
     * 画面下部に短時間メッセージを表示します。
     * @param {string} message - 表示するテキスト
     * @param {string} type - 'success' (緑) または 'error' (赤)
     */
    function showToast(message, type = 'normal') {
        toastEl.textContent = message;
        toastEl.className = 'toast show';
        if (type === 'error') toastEl.classList.add('error');
        else if (type === 'success') toastEl.classList.add('success');
        
        setTimeout(() => { toastEl.classList.remove('show'); }, 2000);
    }

    /**
     * チケット番号を元に支払い状況を確認し、適切な処理を行います。
     * @param {string} ticketNumber - 確認するチケット番号
     */
    function checkOrderStatus(ticketNumber) {
        fetch(`/api/get_order_by_ticket?ticket=${ticketNumber}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (data.order.paymentStatus === '未会計') {
                        // 未会計なら、スキャナをクリアしてから会計ページへ
                        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
                            html5QrcodeScanner.clear().catch(err => console.error("Scanner clear failed.", err));
                        }
                        window.location.href = `/payment?ticket=${ticketNumber}`;
                    } else {
                        // 会計済なら通知を表示（スキャンは継続）
                        showToast(`番号 ${ticketNumber} は会計済みです`, 'success');
                        ticketInputEl.value = '';
                    }
                } else {
                    showToast(`番号 ${ticketNumber} は見つかりません`, 'error');
                    ticketInputEl.value = '';
                }
            })
            .catch(error => {
                console.error('注文情報取得APIエラー:', error);
                showToast('通信エラーが発生しました', 'error');
            });
    }


    // --- 3. メイン処理の実行 ---

    // 3-1. QRコードリーダーの初期化
    try {
        // スキャン成功時のコールバック関数
        const onScanSuccess = (decodedText, decodedResult) => {
            // 処理中に連続でスキャンされるのを防ぐ
            if (html5QrcodeScanner.getState() !== 2) { // 2 = SCANNING
                return;
            }
            // スキャンを一時停止
            html5QrcodeScanner.pause();
            checkOrderStatus(decodedText);
            
            // 2秒後にスキャンを自動で再開
            setTimeout(() => {
                if(html5QrcodeScanner) html5QrcodeScanner.resume();
            }, 2000);
        };
        
        // スキャナのインスタンスを作成
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { 
                fps: 10,
                qrbox: { width: 250, height: 250 },
                rememberLastUsedCamera: true
            },
            false // verbose-modeをオフに
        );
        
        // スキャナを描画
        html5QrcodeScanner.render(onScanSuccess, (error) => {});

    } catch(e) {
        console.error("QRリーダーの初期化に失敗しました:", e);
        alert("QRコードリーダーの起動に失敗しました。");
    }

    // 3-2. 番号手入力フォームのイベント設定
    submitBtnEl.addEventListener('click', () => {
        const ticketNumber = ticketInputEl.value;
        if (ticketNumber) checkOrderStatus(ticketNumber);
    });
    ticketInputEl.addEventListener('keydown', (event) => { 
        if (event.key === 'Enter') {
            const ticketNumber = ticketInputEl.value;
            if (ticketNumber) checkOrderStatus(ticketNumber);
        }
    });

    // 3-3. Firebaseリアルタイムリストの初期化
    try {
        // 'db'変数はfirebase-config.jsでグローバルに定義されている
        db.collection('orders').where('status', '==', '提供可能').orderBy('createdAt', 'asc')
          .onSnapshot(querySnapshot => {
            readyListContainerEl.innerHTML = '';
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const docId = doc.id;
                const ticketDiv = document.createElement('div');
                ticketDiv.className = 'ready-ticket';
                ticketDiv.textContent = order.ticketNumber;
                
                // 支払い状況に応じてクラスを付与
                ticketDiv.classList.add(order.paymentStatus === '未会計' ? 'unpaid' : 'paid');

                // クリックで「完了」にするイベント
                ticketDiv.addEventListener('click', () => {
                    if (order.paymentStatus === '未会計') {
                        alert(`【未会計】番号 ${order.ticketNumber}\n\nお客様に、先にQRコードを提示してお会計を済ませるよう案内してください。`);
                        return;
                    }
                    if (confirm(`番号 ${order.ticketNumber} の商品を渡しましたか？`)) {
                        db.collection('orders').doc(docId).update({ status: '完了' });
                    }
                });
                readyListContainerEl.appendChild(ticketDiv);
            });
        });
    } catch (e) {
        console.error("Firebaseの接続またはリアルタイム更新に失敗しました:", e);
        alert("データベースとの接続に失敗しました。");
    }
});