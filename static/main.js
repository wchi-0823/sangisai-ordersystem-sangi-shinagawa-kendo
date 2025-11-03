// HTMLドキュメントが完全に読み込まれてから、中のコードを実行する
document.addEventListener('DOMContentLoaded', () => {

    // --- トースト通知機能 ---
    const toast = document.getElementById('toast');
    let toastTimeout; // 通知を非表示にするタイマーのIDを保持

    /**
     * 画面上部に短時間メッセージを表示する関数
     * @param {string} message 表示するメッセージ
     */
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        
        // 以前のタイマーが残っていればクリアする（連続でボタンが押された場合のため）
        clearTimeout(toastTimeout);

        // 3秒後に.showクラスを削除して通知を非表示にする
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }


    // --- カテゴリ絞り込み機能 ---
    const categoryButtons = document.querySelectorAll('.category-btn');
    const menuItems = document.querySelectorAll('.item-card');

    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedCategory = button.dataset.category;

            // すべてのボタンから選択状態(.active)を解除
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            // クリックされたボタンを選択状態にする
            button.classList.add('active');

            // すべての商品カードをチェック
            menuItems.forEach(item => {
                // 「すべて」が選択されたか、商品のカテゴリが一致する場合
                if (selectedCategory === 'all' || item.dataset.category === selectedCategory) {
                    item.style.display = 'flex'; // 横並びレイアウトを維持するためにflexを指定
                } else {
                    item.style.display = 'none'; // それ以外は非表示
                }
            });
        });
    });


    // --- 各商品カードのカート追加機能 ---
    document.querySelectorAll('.item-card').forEach(card => {
        // 各カードから操作に必要な要素を取得
        const itemId = card.dataset.itemId;
        const minusBtn = card.querySelector('.quantity-minus');
        const plusBtn = card.querySelector('.quantity-plus');
        const quantityEl = card.querySelector('.quantity');
        const addToCartBtn = card.querySelector('.add-to-cart-btn');

        // 売り切れ商品（ボタンがない場合）は何もしない
        if (!addToCartBtn) {
            return;
        }

        // 「-」ボタンの処理
        minusBtn.addEventListener('click', () => {
            let quantity = parseInt(quantityEl.textContent);
            if (quantity > 1) { // 1より大きい場合のみ減らす
                quantityEl.textContent = quantity - 1;
            }
        });

        // 「+」ボタンの処理
        plusBtn.addEventListener('click', () => {
            let quantity = parseInt(quantityEl.textContent);
            quantityEl.textContent = quantity + 1;
        });

        // 「カートに追加」ボタンの処理
        addToCartBtn.addEventListener('click', () => {
            const itemName = addToCartBtn.dataset.itemName;
            const itemPrice = parseInt(addToCartBtn.dataset.itemPrice, 10);
            const quantity = parseInt(quantityEl.textContent);
            // ?.（オプショナルチェイニング）で、.item-imageが存在しない場合でもエラーにならないようにする
            const imageUrl = card.querySelector('.item-image')?.src || '';

            // ローカルストレージから現在のカート情報を取得
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            let existingItem = cart.find(item => item.id === itemId);

            if (existingItem) {
                // カートに同じ商品があれば、数量を加算
                existingItem.quantity += quantity;
            } else {
                // なければ、新しい商品としてカートに追加
                cart.push({
                    id: itemId,
                    name: itemName,
                    price: itemPrice,
                    quantity: quantity,
                    imageUrl: imageUrl
                });
            }

            // 更新したカート情報をローカルストレージに保存
            localStorage.setItem('cart', JSON.stringify(cart));
            
            // ユーザーに通知
            showToast(`${itemName}を${quantity}個カートに追加しました！`);
            
            // 数量表示を1にリセット
            quantityEl.textContent = '1';

            // セット商品用モーダルの処理
            const modal = document.getElementById('set-modal');
            const modalTitle = document.getElementById('set-modal-title');
            const modalCount = document.getElementById('set-modal-count');
            const modalOptions = document.getElementById('set-modal-options');
            const confirmBtn = document.getElementById('set-modal-confirm-btn');
            const cancelBtn = document.getElementById('set-modal-cancel-btn');
            let currentSetItem = null;

            // 「セット内容を選択する」ボタンのイベント
            document.querySelectorAll('.select-set-btn').forEach(button => {
                button.addEventListener('click', () => {
                    currentSetItem = {
                        id: button.dataset.itemId,
                        name: button.dataset.itemName,
                        price: parseInt(button.dataset.itemPrice),
                        setCount: parseInt(button.dataset.setCount),
                        setItems: button.dataset.setItems.split(','),
                        isSet: true // セット商品であることを示すフラグ
                    };
                    openSetModal(currentSetItem);
                });
            });

            function openSetModal(item) {
                modalTitle.textContent = `${item.name}の内容を選択`;
                modalCount.textContent = item.setCount;
                modalOptions.innerHTML = ''; // 中身をリセット

                const table = document.createElement('table');
                let tableHtml = '<thead><tr><th>商品</th><th>選択</th></tr></thead><tbody>';

                item.setItems.forEach(choiceName => {
                    tableHtml += `
                        <tr>
                            <td>${choiceName}</td>
                            <td><input type="checkbox" name="set-choice" value="${choiceName}"></td>
                        </tr>
                    `;
                });
                tableHtml += '</tbody>';
                table.innerHTML = tableHtml;
                modalOptions.appendChild(table);

                confirmBtn.disabled = true;
                modal.style.display = 'flex';
            }

            // モーダル内のチェックボックスが変更された時のイベント
            modalOptions.addEventListener('change', (e) => {
                if (e.target.name === 'set-choice') {
                    const checkedCount = modalOptions.querySelectorAll('input[name="set-choice"]:checked').length;
                    if (checkedCount === currentSetItem.setCount) {
                        confirmBtn.disabled = false;
                    } else {
                        confirmBtn.disabled = true;
                    }
                }
            });

            // モーダルの「決定」ボタン
            confirmBtn.addEventListener('click', () => {
                const selectedChoices = Array.from(modalOptions.querySelectorAll('input[name="set-choice"]:checked'))
                                            .map(checkbox => checkbox.value);
                
                let cart = JSON.parse(localStorage.getItem('cart')) || [];
                cart.push({
                    id: currentSetItem.id,
                    name: currentSetItem.name,
                    price: currentSetItem.price,
                    quantity: 1, // セット商品は常に1つ
                    isSet: true,
                    selectedItems: selectedChoices // 選択した商品を配列で保存
                });

                localStorage.setItem('cart', JSON.stringify(cart));
                showToast(`${currentSetItem.name}をカートに追加しました！`);
                closeModal();
            });

            // モーダルの「キャンセル」ボタン
            cancelBtn.addEventListener('click', () => {
                closeModal();
            });

            function closeModal() {
                modal.style.display = 'none';
                currentSetItem = null;
            }
        });
    });
});