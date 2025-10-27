// HTMLドキュメントが完全に読み込まれてから、中のコードを実行する
document.addEventListener('DOMContentLoaded', () => {

    // --- HTML要素の取得 ---
    const cartItemsContainer = document.getElementById('cart-items-container');
    const totalQuantityElement = document.getElementById('total-quantity');
    const totalPriceElement = document.getElementById('total-price');
    const orderBtn = document.getElementById('order-btn');


    /**
     * カートの中身を読み取り、画面に表示/再描画するメインの関数
     */
    function displayCart() {
        // ローカルストレージからカート情報を取得（なければ空の配列）
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cartItemsContainer.innerHTML = ''; // 表示エリアを一度空にする

        let totalQuantity = 0;
        let totalPrice = 0;

        if (cart.length === 0) {
            // カートが空の場合の表示
            cartItemsContainer.innerHTML = '<p class="card">カートは空です。</p>';
            orderBtn.disabled = true; // 注文ボタンを無効化
        } else {
            // カート内の商品を一つずつループしてHTMLを生成
            cart.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'card cart-item-card';

                // 画像URLがあればimgタグを、なければ空文字を生成
                const imageHtml = item.imageUrl 
                    ? `<img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">` 
                    : '';
                
                // 商品カードのHTML構造
                itemDiv.innerHTML = `
                    ${imageHtml}
                    <div class="cart-item-info">
                        <h3>${item.name}</h3>
                        <p>単価: ${item.price}円</p>
                        <div class="cart-item-controls">
                            <button class="quantity-minus" data-index="${index}">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="quantity-plus" data-index="${index}">+</button>
                            <button class="delete-btn" data-index="${index}">削除</button>
                        </div>
                    </div>
                `;
                cartItemsContainer.appendChild(itemDiv);

                // 合計点数と合計金額を計算
                totalQuantity += item.quantity;
                totalPrice += item.price * item.quantity;
            });
            orderBtn.disabled = false; // 注文ボタンを有効化
        }

        // 計算結果を画面に反映
        totalQuantityElement.textContent = totalQuantity;
        totalPriceElement.textContent = totalPrice;
        
        // 新しく生成されたボタンたちに、クリックイベントを設定する
        addEventListenersToCartButtons();
    }


    /**
     * カート内のすべてのボタン（+/-/削除）にイベントリスナーを設定する関数
     */
    function addEventListenersToCartButtons() {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];

        // 「-」ボタンの処理
        document.querySelectorAll('.quantity-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                if (cart[index].quantity > 1) {
                    cart[index].quantity--;
                }
                localStorage.setItem('cart', JSON.stringify(cart));
                displayCart(); // 画面を再描画
            });
        });

        // 「+」ボタンの処理
        document.querySelectorAll('.quantity-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                cart[index].quantity++;
                localStorage.setItem('cart', JSON.stringify(cart));
                displayCart();
            });
        });

        // 「削除」ボタンの処理
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                cart.splice(index, 1); // 配列から商品を削除
                localStorage.setItem('cart', JSON.stringify(cart));
                displayCart();
            });
        });
    }


    // --- 「注文を確定する」ボタンの処理 ---
    orderBtn.addEventListener('click', () => {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart.length === 0) {
            alert('カートは空です。');
            return;
        }

        // サーバーに注文データを送信する
        fetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cart),
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                // 注文成功後、ローカルストレージを空にして注文完了ページへ移動
                localStorage.removeItem('cart');
                window.location.href = `/order_complete?ticket_number=${data.ticketNumber}&order_id=${data.orderId}`;
            } else {
                alert('注文処理中にエラーが発生しました。');
            }
        })
        .catch(error => {
            console.error('注文APIエラー:', error);
            alert('通信エラーが発生しました。');
        });
    });


    // --- ページが最初に読み込まれた時に実行 ---
    displayCart();
});