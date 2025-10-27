// --- HTML要素の取得 ---
const ordersContainer = document.getElementById('orders-container');
const notificationSound = new Audio('/static/ping2.mp3'); 
const unmuteButton = document.getElementById('unmute-button');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const inputPreview = document.getElementById('input-preview');

// --- 状態を管理する変数 ---
let isSoundEnabled = false;
let previousOrdersCount = 0;
let inputBuffer = '';

// --- イベントリスナーの設定 ---

// 【修正】音声有効化ボタンのロジックをdisplay.jsと統一
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
    // fullscreenElementが存在するかどうかで、bodyにクラスを付け外しする
    document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
});

// キーボード入力の監視
document.addEventListener('keydown', (event) => {
    if (!isNaN(event.key) && event.key !== ' ') { inputBuffer += event.key; updatePreview(); }
    if (event.key === 'Enter' && inputBuffer.length > 0) {
        processOrder(inputBuffer);
        inputBuffer = '';
        updatePreview();
    }
    if (event.key === '.') { inputBuffer = ''; updatePreview(); }
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
 * 入力された番号に対応する注文を処理（提供可能に）する関数
 * @param {string} ticketNumber 処理するチケット番号
 */
function processOrder(ticketNumber) {
    let targetButton = null;
    // 表示されている全注文カードから、番号が一致するものを探す
    document.querySelectorAll('.order-card').forEach(card => {
        const ticketNumberEl = card.querySelector('.ticket-number');
        if (ticketNumberEl && ticketNumberEl.textContent === ticketNumber) {
            targetButton = card.querySelector('.status-btn');
        }
    });

    if (targetButton) {
        targetButton.click(); // 対応するボタンをプログラム的にクリック
    } else {
        alert(`注文番号 ${ticketNumber} は見つかりません。`);
    }
}

// --- Firebaseリアルタイムリスナー ---

// 「調理中」の注文を監視し、画面に表示する
db.collection('orders').where('status', '==', '調理中').orderBy('createdAt', 'asc')
  .onSnapshot(querySnapshot => {
    const currentOrdersCount = querySnapshot.size;

    // 新しい注文が入ったら効果音を鳴らす
    if (isSoundEnabled && currentOrdersCount > previousOrdersCount) {
        notificationSound.play().catch(error => console.warn("音声再生失敗:", error));
    }
    previousOrdersCount = currentOrdersCount;

    ordersContainer.innerHTML = ''; 
    if (querySnapshot.empty) {
        ordersContainer.innerHTML = '<p style="padding-left:20px;">新しい注文を待っています...</p>';
        return;
    }

    // 取得した注文を一つずつカードとして描画
    querySnapshot.forEach(doc => {
        const order = doc.data();
        const orderId = doc.id;

        // 商品リストのHTMLを生成
        let itemsHtml = '<ul>';
        order.items.forEach(item => {
            itemsHtml += `<li>${item.name} <strong>x ${item.quantity}</strong></li>`;
        });
        itemsHtml += '</ul>';

        // 注文カード全体のHTMLを生成
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-card';
        orderDiv.innerHTML = `
            <div class="order-card-header">
                <span class="ticket-number">${order.ticketNumber}</span>
                <span class="total-price">${order.totalPrice}円</span>
            </div>
            <div class="order-card-body">
                ${itemsHtml}
            </div>
            <div class="order-card-footer">
                <button class="status-btn" data-id="${orderId}">提供可能にする</button>
            </div>
        `;
        ordersContainer.appendChild(orderDiv);
    });

    // 新しく生成された「提供可能にする」ボタンにクリックイベントを設定
    document.querySelectorAll('.status-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const docId = event.target.dataset.id;
            db.collection('orders').doc(docId).update({ status: '提供可能' });
        });
    });
});