document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('toast');
    let toastTimeout;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => { toast.classList.remove('show'); }, 3000);
    }

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

    document.querySelectorAll('.item-card').forEach(card => {
        const itemId = card.dataset.itemId;
        const minusBtn = card.querySelector('.quantity-minus');
        const plusBtn = card.querySelector('.quantity-plus');
        const quantityEl = card.querySelector('.quantity');
        const addToCartBtn = card.querySelector('.add-to-cart-btn');

        if (minusBtn) minusBtn.addEventListener('click', () => { if (parseInt(quantityEl.textContent) > 1) quantityEl.textContent--; });
        if (plusBtn) plusBtn.addEventListener('click', () => { quantityEl.textContent++; });

        if (addToCartBtn) addToCartBtn.addEventListener('click', () => {
            const quantity = parseInt(quantityEl.textContent);
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            let existingItem = cart.find(item => item.id === itemId);

            if (existingItem) {
                existingItem.quantity += quantity;
            } else {
                cart.push({
                    id: itemId,
                    name: addToCartBtn.dataset.itemName,
                    price: parseInt(addToCartBtn.dataset.itemPrice),
                    quantity: quantity,
                    imageUrl: card.querySelector('.item-image')?.src || ''
                });
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            showToast(`${addToCartBtn.dataset.itemName}を${quantity}個カートに追加しました！`);
            quantityEl.textContent = '1';
        });
    });

    // --- セット商品モーダルロジック ---
    const modal = document.getElementById('set-modal');
    const modalTitle = document.getElementById('set-modal-title');
    const modalCount = document.getElementById('set-modal-count');
    const modalSelectedCount = document.getElementById('set-modal-selected-count');
    const modalOptions = document.getElementById('set-modal-options');
    const confirmBtn = document.getElementById('set-modal-confirm-btn');
    const cancelBtn = document.getElementById('set-modal-cancel-btn');
    let currentSetItem = null;

    document.querySelectorAll('.select-set-btn').forEach(button => {
        button.addEventListener('click', () => {
            currentSetItem = {
                id: button.dataset.itemId,
                name: button.dataset.itemName,
                price: parseInt(button.dataset.itemPrice),
                setCount: parseInt(button.dataset.setCount),
                setItems: button.dataset.setItems.split(','),
                isSet: true
            };
            openSetModal(currentSetItem);
        });
    });

    function openSetModal(item) {
        modalTitle.textContent = `${item.name}の内容を選択`;
        modalCount.textContent = item.setCount;
        modalSelectedCount.textContent = '0';
        modalOptions.innerHTML = '';

        const table = document.createElement('table');
        let tableHtml = '<tbody>';
        item.setItems.forEach(choiceName => {
            tableHtml += `<tr><td>${choiceName}</td><td><input type="checkbox" name="set-choice" value="${choiceName}"></td></tr>`;
        });
        tableHtml += '</tbody>';
        table.innerHTML = tableHtml;
        modalOptions.appendChild(table);

        confirmBtn.disabled = true;
        modal.style.display = 'flex';
    }

    modalOptions.addEventListener('change', () => {
        const checkedCount = modalOptions.querySelectorAll('input[name="set-choice"]:checked').length;
        modalSelectedCount.textContent = checkedCount;
        confirmBtn.disabled = checkedCount !== currentSetItem.setCount;
    });

    confirmBtn.addEventListener('click', () => {
        const selectedChoices = Array.from(modalOptions.querySelectorAll('input[name="set-choice"]:checked')).map(cb => cb.value);
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cart.push({
            id: currentSetItem.id,
            name: currentSetItem.name,
            price: currentSetItem.price,
            quantity: 1,
            isSet: true,
            selectedItems: selectedChoices,
            imageUrl: document.querySelector(`[data-item-id="${currentSetItem.id}"] .item-image`)?.src || ''
        });
        localStorage.setItem('cart', JSON.stringify(cart));
        showToast(`${currentSetItem.name}をカートに追加しました！`);
        closeModal();
    });

    cancelBtn.addEventListener('click', () => closeModal());
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    function closeModal() {
        modal.style.display = 'none';
        currentSetItem = null;
    }
});