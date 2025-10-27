document.addEventListener('DOMContentLoaded', () => {
    // --- HTML要素の取得 ---
    const ticketNumberDisplay = document.getElementById('ticket-number-display');
    const receiptContainer = document.getElementById('receipt-container');
    const placeholder = document.getElementById('order-details-placeholder');
    const confirmBtn = document.getElementById('confirm-payment-btn');

    // --- 状態を管理する変数 ---
    const ticketNumber = ticketNumberDisplay.textContent.trim();
    let orderDocId = null; // FirestoreのドキュメントIDを保存

    // 1. チケット番号を元に、APIから注文データを取得して表示
    fetch(`/api/get_order_by_ticket?ticket=${ticketNumber}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const order = data.order;
                orderDocId = data.docId; // 後で使うのでIDを保存

                // レシートHTMLの生成
                let itemsHtml = `
                    <div class="receipt-box">
                        <div class="payment-status ${order.paymentStatus === '未会計' ? 'unpaid' : 'paid'}">
                            ${order.paymentStatus}
                        </div>
                        <div class="receipt-items">
                            <table>
                                <thead><tr><th class="col-item">商品名</th><th class="col-qty">数量</th><th class="col-price">金額</th></tr></thead>
                                <tbody>`;
                order.items.forEach(item => {
                    itemsHtml += `<tr><td class="col-item">${item.name}</td><td class="col-qty">${item.quantity}</td><td class="col-price">${item.price * item.quantity}円</td></tr>`;
                });
                itemsHtml += `
                                </tbody>
                            </table>
                        </div>
                        <div class="receipt-total">
                            <span>合計:</span>
                            <span>${order.totalPrice}円</span>
                        </div>
                    </div>`;

                placeholder.style.display = 'none'; // 「読み込み中」を非表示
                receiptContainer.insertAdjacentHTML('afterbegin', itemsHtml);

                // 未会計の場合のみ「会計完了」ボタンを有効化
                if (order.paymentStatus === '未会計') {
                    confirmBtn.disabled = false;
                }
            } else {
                placeholder.innerHTML = `<p style="color:red;">エラー: ${data.error}</p>`;
            }
        })
        .catch(error => {
            console.error("注文情報取得APIエラー:", error);
            placeholder.innerHTML = `<p style="color:red;">通信エラーが発生しました。</p>`;
        });
    
    // 2. 「会計完了にする」ボタンのクリックイベント
    confirmBtn.addEventListener('click', () => {
        if (!orderDocId) return;

        // バックエンドのAPIに、支払いステータス更新をリクエスト
        fetch('/api/update_payment_status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ docId: orderDocId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert('会計処理が完了しました。');
                window.location.href = '/cashier'; // QRリーダー画面に戻る
            } else {
                alert('エラーが発生しました: ' + data.error);
            }
        })
        .catch(error => {
            console.error("会計ステータス更新APIエラー:", error);
            alert('通信エラーが発生しました。');
        });
    });
});