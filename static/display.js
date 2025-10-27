// --- HTML要素の取得 ---
const notificationSound = new Audio('/static/ping.mp3');
const unmuteButton = document.getElementById('unmute-button');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const cookingTicketsList = document.getElementById('cooking-tickets-list');
const readyTicketsList = document.getElementById('ready-tickets-list');
const inputPreview = document.getElementById('input-preview');

// --- 状態を管理する変数 ---
let isSoundEnabled = false;       // 音声が有効か
let previousReadyCount = 0;       // 前回の提供可能件数（音を鳴らす判定用）
let inputBuffer = '';             // キーボード入力を保持するバッファ

// --- イベントリスナーの設定 ---

// 音声有効化ボタン
unmuteButton.addEventListener('click', () => {
    unmuteButton.classList.add('active');
    unmuteButton.textContent = '音声有効化済';
    notificationSound.play().then(() => {
        isSoundEnabled = true;
        notificationSound.pause();
        notificationSound.currentTime = 0;
    }).catch(error => console.error("音声の有効化に失敗:", error));
});

// 【修正】全画面表示ボタンのロジックをより堅牢に変更
fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
});

// 【修正】全画面表示状態の変更を監視（Escキーでの解除にも対応）
document.addEventListener('fullscreenchange', () => {
    document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
});

// キーボード入力の監視
document.addEventListener('keydown', (event) => {
    // 数字が押されたらバッファに追加
    if (!isNaN(event.key) && event.key !== ' ') {
        inputBuffer += event.key;
        updatePreview();
    }
    // Enterキーで注文処理
    if (event.key === 'Enter' && inputBuffer.length > 0) {
        processOrder(inputBuffer);
        inputBuffer = ''; // 処理後にバッファをクリア
        updatePreview();
    }
    // '.'キーでバッファをクリア
    if (event.key === '.') {
        inputBuffer = '';
        updatePreview();
    }
    // Backspaceキーで一文字削除
    if (event.key === 'Backspace') {
        inputBuffer = inputBuffer.slice(0, -1);
        updatePreview();
    }
});


// --- ヘルパー関数 ---

/**
 * キーボード入力のプレビュー表示を更新する関数
 */
function updatePreview() {
    if (inputBuffer.length > 0) {
        inputPreview.textContent = inputBuffer;
        inputPreview.classList.add('visible');
    } else {
        inputPreview.classList.remove('visible');
    }
}

/**
 * 入力された番号に対応する注文を処理（完了に）する関数
 * @param {string} ticketNumber 処理するチケット番号
 */
function processOrder(ticketNumber) {
    let found = false;
    // 「お渡しできます」リストに表示されている全番号タイルを取得
    const targetTickets = readyTicketsList.querySelectorAll('.ticket-number');
    
    targetTickets.forEach(ticket => {
        if (ticket.textContent === ticketNumber) {
            ticket.click(); // 対応する番号タイルをプログラム的にクリック
            found = true;
        }
    });

    if (!found) {
        alert(`呼び出し中の番号 ${ticketNumber} は見つかりません。`);
    }
}


// --- Firebaseリアルタイムリスナー ---

// 1. 「調理中」の注文を監視し、左カラムに表示
db.collection('orders').where('status', '==', '調理中').orderBy('createdAt', 'asc')
  .onSnapshot(querySnapshot => {
    cookingTicketsList.innerHTML = '';
    querySnapshot.forEach(doc => {
        const order = doc.data();
        const ticketDiv = document.createElement('div');
        ticketDiv.className = 'ticket-number';
        ticketDiv.textContent = order.ticketNumber;
        cookingTicketsList.appendChild(ticketDiv);
    });
});

// 2. 「提供可能」の注文を監視し、右カラムに表示
db.collection('orders').where('status', '==', '提供可能').orderBy('createdAt', 'asc')
  .onSnapshot(querySnapshot => {
    const currentReadyCount = querySnapshot.size;
    
    // 新しい呼び出しがあったら効果音を鳴らす
    if (isSoundEnabled && currentReadyCount > previousReadyCount) {
        notificationSound.play().catch(error => console.warn("音声再生失敗:", error));
    }
    previousReadyCount = currentReadyCount; // 今回の件数を次回のために保存

    readyTicketsList.innerHTML = '';
    querySnapshot.forEach(doc => {
        const order = doc.data();
        const orderId = doc.id;
        const ticketDiv = document.createElement('div');
        ticketDiv.className = 'ticket-number';
        ticketDiv.textContent = order.ticketNumber;
        ticketDiv.dataset.id = orderId; // 完了処理のためにFirestoreのIDを埋め込む

        // 番号タイルがクリックされたら、注文を「完了」ステータスに更新
        ticketDiv.addEventListener('click', () => {
            if (confirm(`注文番号 ${ticketDiv.textContent} を完了にしてよろしいですか？`)) {
                db.collection('orders').doc(orderId).update({ status: '完了' });
            }
        });
        readyTicketsList.appendChild(ticketDiv);
    });
});