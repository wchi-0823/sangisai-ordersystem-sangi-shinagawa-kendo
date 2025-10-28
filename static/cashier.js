//QRコードは株式会社デンソーウェーブの登録商標です

document.addEventListener('DOMContentLoaded', () => {
    const toastEl = document.getElementById('toast');
    const ticketInputEl = document.getElementById('ticket-input');
    const submitBtnEl = document.getElementById('submit-ticket');
    const readyListContainerEl = document.getElementById('ready-list-container');
    let html5QrcodeScanner;

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

    function showToast(message, type = 'normal') {
        toastEl.textContent = message;
        toastEl.className = 'toast show';
        if (type === 'error') toastEl.classList.add('error');
        else if (type === 'success') toastEl.classList.add('success');
        setTimeout(() => { toastEl.classList.remove('show'); }, 2000);
    }

    function checkOrderStatus(ticketNumber) {
        fetch(`/api/get_order_by_ticket?ticket=${ticketNumber}`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    if (data.order.paymentStatus === '未会計') {
                        if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
                            html5QrcodeScanner.clear().catch(err => console.error("Scanner clear failed.", err));
                        }
                        window.location.href = `/payment?ticket=${ticketNumber}`;
                    } else {
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

    try {
        const onScanSuccess = (decodedText, decodedResult) => {
            if (html5QrcodeScanner.getState() !== 2) { return; }
            html5QrcodeScanner.pause();
            checkOrderStatus(decodedText);
            setTimeout(() => {
                if (html5QrcodeScanner) html5QrcodeScanner.resume();
            }, 2000);
        };
        html5QrcodeScanner = new Html5QrcodeScanner(
            "qr-reader",
            { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true },
            false
        );
        html5QrcodeScanner.render(onScanSuccess, (error) => {});
    } catch (e) {
        console.error("QRリーダーの初期化に失敗しました:", e);
        // alert("QRコードリーダーの起動に失敗しました。"); // カメラがないPCなどでうるさいのでコメントアウト
    }

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

    try {
        db.collection('orders').where('status', '==', '提供可能').orderBy('createdAt', 'asc')
            .onSnapshot(querySnapshot => {
                readyListContainerEl.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const order = doc.data();
                    const docId = doc.id;
                    const ticketDiv = document.createElement('div');
                    ticketDiv.className = 'ready-ticket';
                    ticketDiv.textContent = order.ticketNumber;
                    ticketDiv.classList.add(order.paymentStatus === '未会計' ? 'unpaid' : 'paid');

                    ticketDiv.addEventListener('click', () => {
                        if (order.paymentStatus === '未会計') {
                            alert(`【未会計】番号 ${order.ticketNumber}\n\nお客様に、先に二次元コードを提示してお会計を済ませるよう案内してください。`);
                            return;
                        }
                        if (confirm(`番号 ${order.ticketNumber} の商品を渡しましたか？`)) {
                            fetch('/api/update_order_status', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ docId: docId, status: '完了' })
                            }).then(res => res.json()).then(data => {
                                if (!data.success) { alert('ステータスの更新に失敗しました: ' + data.error); }
                            });
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