// static/kitchen.js

document.addEventListener('DOMContentLoaded', () => {

    // Firebase Authenticationのインスタンスを取得
    const auth = firebase.auth();

    /**
     * Flaskサーバーからカスタムトークンを取得し、Firebaseにサインインする関数
     */
    async function signInWithCustomToken() {
        try {
            const response = await fetch('/api/get_firebase_token');
            const data = await response.json();

            if (data.token) {
                await auth.signInWithCustomToken(data.token);
                console.log('Firebase Authentication successful for kitchen.');
            } else {
                throw new Error(data.error || 'Custom token not received.');
            }
        } catch (error) {
            console.error('Error during Firebase Authentication:', error);
            alert('厨房モニターの認証に失敗しました。ページを再読み込みします。');
            window.location.reload();
        }
    }

    /**
     * 認証後に実行される、このページのメイン処理
     */
    function initializeApp() {
        // --- HTML要素の取得 ---
        const ordersContainer = document.getElementById('orders-container');
        const notificationSound = new Audio('/static/ping.mp3');
        const unmuteButton = document.getElementById('unmute-button');
        const fullscreenBtn = document.getElementById('fullscreen-btn');
        const inputPreview = document.getElementById('input-preview');

        // --- 状態を管理する変数 ---
        let isSoundEnabled = false;
        let previousOrdersCount = 0;
        let inputBuffer = '';

        // --- イベントリスナーの設定 ---
        unmuteButton.addEventListener('click', () => {
            unmuteButton.classList.add('active');
            unmuteButton.textContent = '音声有効化済';
            notificationSound.play().then(() => {
                isSoundEnabled = true;
                notificationSound.pause();
                notificationSound.currentTime = 0;
            }).catch(error => console.error("音声の有効化に失敗:", error));
        });

        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
        });

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
        function updatePreview() {
            if (inputBuffer.length > 0) {
                inputPreview.textContent = inputBuffer;
                inputPreview.classList.add('visible');
            } else {
                inputPreview.classList.remove('visible');
            }
        }

        function processOrder(ticketNumber) {
            let targetButton = null;
            document.querySelectorAll('.order-card').forEach(card => {
                const ticketNumberEl = card.querySelector('.ticket-number');
                if (ticketNumberEl && ticketNumberEl.textContent === ticketNumber) {
                    targetButton = card.querySelector('.status-btn');
                }
            });

            if (targetButton) {
                targetButton.click();
            } else {
                alert(`注文番号 ${ticketNumber} は見つかりません。`);
            }
        }

        // --- Firebaseリアルタイムリスナー ---
        db.collection('orders').where('status', '==', '調理中').orderBy('createdAt', 'asc')
            .onSnapshot(querySnapshot => {
                const currentOrdersCount = querySnapshot.size;
                if (isSoundEnabled && currentOrdersCount > previousOrdersCount) {
                    notificationSound.play().catch(error => console.warn("音声再生失敗:", error));
                }
                previousOrdersCount = currentOrdersCount;
                ordersContainer.innerHTML = '';
                if (querySnapshot.empty) {
                    ordersContainer.innerHTML = '<p style="padding-left:20px;">新しい注文を待っています...</p>';
                    return;
                }
                querySnapshot.forEach(doc => {
                    const order = doc.data();
                    const orderId = doc.id;
                    let itemsHtml = '<ul>';
                    order.items.forEach(item => {
                        itemsHtml += `<li>${item.name} <strong>x ${item.quantity}</strong></li>`;
                    });
                    itemsHtml += '</ul>';
                    const orderDiv = document.createElement('div');
                    orderDiv.className = 'order-card';
                    orderDiv.innerHTML = `
                        <div class="order-card-header">
                            <span class="ticket-number">${order.ticketNumber}</span>
                            <span class="total-price">${order.totalPrice}円</span>
                        </div>
                        <div class="order-card-body">${itemsHtml}</div>
                        <div class="order-card-footer">
                            <button class="status-btn" data-id="${orderId}">提供可能にする</button>
                        </div>
                    `;
                    ordersContainer.appendChild(orderDiv);
                });
                document.querySelectorAll('.status-btn').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const docId = event.target.dataset.id;
                        db.collection('orders').doc(docId).update({ status: '提供可能' });
                    });
                });
            });
    }

    // --- メインの実行フロー ---
    // ページが読み込まれたら、まず最初にFirebaseの認証を行う
    signInWithCustomToken().then(() => {
        // 認証が成功した後に、メインの処理を開始する
        initializeApp();
    });

});