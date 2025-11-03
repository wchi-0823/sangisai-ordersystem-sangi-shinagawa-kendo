// static/main.js （最終完成版・セット商品改良版）

document.addEventListener('DOMContentLoaded', () => {

    const itemsMapElement = document.body;
    const itemsMaster = JSON.parse(itemsMapElement.dataset.itemsMap || '{}');

    // --- グローバル変数と共通関数 ---
    const toast = document.getElementById('toast');
    let toastTimeout;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }

    // --- カテゴリフィルター機能 ---
    const categoryButtons = document.querySelectorAll('.category-btn');
    const menuItems = document.querySelectorAll('.item-card');
    categoryButtons.forEach(button => {
        button.addEventListener('click', () => {
            const selectedCategory = button.dataset.category;
            categoryButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            menuItems.forEach(item => {
                const itemStyle = window.innerWidth <= 600 ? 'block' : 'flex';
                if (selectedCategory === 'all' || item.dataset.category === selectedCategory) {
                    item.style.display = itemStyle;
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // --- 単品商品のカート追加機能 ---
    document.querySelectorAll('.add-to-cart-btn').forEach(button => {
        const card = button.closest('.item-card');
        const itemId = card.dataset.itemId;
        const quantityEl = card.querySelector('.quantity');
        
        button.addEventListener('click', () => {
            const quantity = parseInt(quantityEl.textContent);
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            let existingItem = cart.find(item => item.id === itemId && !item.isSet);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    id: itemId,
                    name: button.dataset.itemName,
                    price: parseInt(button.dataset.itemPrice),
                    quantity: quantity,
                    imageUrl: card.querySelector('.item-image')?.src || ''
                });
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            showToast(`${button.dataset.itemName}を${quantity}個カートに追加しました！`);
            quantityEl.textContent = '1';
        });
    });
    document.querySelectorAll('.quantity-minus').forEach(btn => {
        const quantityEl = btn.nextElementSibling;
        btn.addEventListener('click', () => { if (parseInt(quantityEl.textContent) > 1) quantityEl.textContent--; });
    });
    document.querySelectorAll('.quantity-plus').forEach(btn => {
        const quantityEl = btn.previousElementSibling;
        btn.addEventListener('click', () => { quantityEl.textContent++; });
    });

    // --- セット商品モーダルロジック (改良版) ---
    const modal = document.getElementById('set-modal');
    const modalTitle = document.getElementById('set-modal-title');
    const modalCount = document.getElementById('set-modal-count');
    const modalOptions = document.getElementById('set-modal-options');
    const confirmBtn = document.getElementById('set-modal-confirm-btn');
    const cancelBtn = document.getElementById('set-modal-cancel-btn');
    let currentSetInfo = null;

    document.querySelectorAll('.select-set-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentSetInfo = {
                id: button.dataset.itemId,
                name: button.dataset.itemName,
                price: parseInt(button.dataset.itemPrice),
                setCount: parseInt(button.dataset.setCount),
                setItemIds: button.dataset.setItems.split(','), // ItemIDのリスト
                isSet: true
            };
            openSetModal(currentSetInfo);
        });
    });

    function openSetModal(item) {
        modalTitle.textContent = `${item.name}の内容を選択`;
        modalCount.textContent = item.setCount;
        modalOptions.innerHTML = ''; // 中身をリセット

        const table = document.createElement('table');
        let headerHtml = '<thead><tr>';
        for (let i = 1; i <= item.setCount; i++) {
            headerHtml += `<th>${i}個目</th>`;
        }
        headerHtml += '</tr></thead>';

        let bodyHtml = '<tbody>';
        item.setItemIds.forEach(itemId => {
            const choiceName = itemsMaster[itemId]?.name || '不明な商品';
            bodyHtml += `<tr>`;
            for (let i = 1; i <= item.setCount; i++) {
                bodyHtml += `<td>
                    <label style="display: block; padding: 5px; cursor: pointer;">
                        <input type="checkbox" name="set-choice-col-${i}" value="${choiceName}">
                        ${choiceName}
                    </label>
                </td>`;
            }
            bodyHtml += `</tr>`;
        });
        bodyHtml += '</tbody>';
        
        table.innerHTML = headerHtml + bodyHtml;
        modalOptions.appendChild(table);

        confirmBtn.disabled = true;
        modal.style.display = 'flex';
    }

    modalOptions.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
            const colName = e.target.name;
            // 同じ列（例: 1個目）の他のチェックボックスを外す
            modalOptions.querySelectorAll(`input[name="${colName}"]`).forEach(cb => {
                if (cb !== e.target) {
                    cb.checked = false;
                }
            });

            // 全ての列で1つずつ選択されているかチェック
            let allColsSelected = true;
            for (let i = 1; i <= currentSetInfo.setCount; i++) {
                if (modalOptions.querySelectorAll(`input[name="set-choice-col-${i}"]:checked`).length !== 1) {
                    allColsSelected = false;
                    break;
                }
            }
            confirmBtn.disabled = !allColsSelected;
        }
    });

    confirmBtn.addEventListener('click', () => {
        const selectedChoices = [];
        for (let i = 1; i <= currentSetInfo.setCount; i++) {
            const checkedBox = modalOptions.querySelector(`input[name="set-choice-col-${i}"]:checked`);
            if (checkedBox) {
                selectedChoices.push(checkedBox.value);
            }
        }

        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart.push({
            id: currentSetInfo.id,
            name: currentSetInfo.name,
            price: currentSetInfo.price,
            quantity: 1,
            isSet: true,
            selectedItems: selectedChoices, // 選択した商品名の配列
            imageUrl: document.querySelector(`[data-item-id="${currentSetInfo.id}"] .item-image`)?.src || ''
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        showToast(`${currentSetInfo.name}をカートに追加しました！`);
        closeModal();
    });

    cancelBtn.addEventListener('click', () => closeModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    function closeModal() {
        modal.style.display = 'none';
        currentSetInfo = null;
    }
});