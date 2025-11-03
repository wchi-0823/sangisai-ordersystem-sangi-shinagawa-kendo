document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cart-items-container');
    const totalQuantityElement = document.getElementById('total-quantity');
    const totalPriceElement = document.getElementById('total-price');
    const orderBtn = document.getElementById('order-btn');

    function displayCart() {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        cartItemsContainer.innerHTML = '';
        let totalQuantity = 0;
        let totalPrice = 0;

        if (cart.length === 0) {
            cartItemsContainer.innerHTML = '<p class="card">カートは空です。</p>';
            orderBtn.disabled = true;
        } else {
            cart.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'card cart-item-card';
                const imageHtml = item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image">` : '';
                
                let itemDetailsHtml = '';
                if (item.isSet && item.selectedItems) {
                    itemDetailsHtml = '<ul style="font-size: 0.9em; margin-left: 20px;">' + item.selectedItems.map(name => `<li>- ${name}</li>`).join('') + '</ul>';
                }

                let controlsHtml = '';
                if (item.isSet) {
                    controlsHtml = `<span class="quantity">数量: 1</span><button class="delete-btn" data-index="${index}">削除</button>`;
                } else {
                    controlsHtml = `<button class="quantity-minus" data-index="${index}">-</button><span class="quantity">${item.quantity}</span><button class="quantity-plus" data-index="${index}">+</button><button class="delete-btn" data-index="${index}">削除</button>`;
                }

                itemDiv.innerHTML = `
                    ${imageHtml}
                    <div class="cart-item-info">
                        <h3>${item.name}</h3>
                        ${itemDetailsHtml}
                        <p>単価: ${item.price}円</p>
                        <div class="cart-item-controls">${controlsHtml}</div>
                    </div>
                `;
                cartItemsContainer.appendChild(itemDiv);
                totalQuantity += item.quantity;
                totalPrice += item.price * item.quantity;
            });
            orderBtn.disabled = false;
        }
        totalQuantityElement.textContent = totalQuantity;
        totalPriceElement.textContent = totalPrice;
        addEventListenersToCartButtons();
    }

    function addEventListenersToCartButtons() {
        document.querySelectorAll('.quantity-minus').forEach(btn => btn.addEventListener('click', e => updateQuantity(e.target.dataset.index, -1)));
        document.querySelectorAll('.quantity-plus').forEach(btn => btn.addEventListener('click', e => updateQuantity(e.target.dataset.index, 1)));
        document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', e => {
            let cart = JSON.parse(localStorage.getItem('cart')) || [];
            cart.splice(e.target.dataset.index, 1);
            localStorage.setItem('cart', JSON.stringify(cart));
            displayCart();
        }));
    }

    function updateQuantity(index, change) {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart[index]) {
            cart[index].quantity += change;
            if (cart[index].quantity <= 0) {
                cart.splice(index, 1);
            }
            localStorage.setItem('cart', JSON.stringify(cart));
            displayCart();
        }
    }

    orderBtn.addEventListener('click', () => {
        let cart = JSON.parse(localStorage.getItem('cart')) || [];
        if (cart.length === 0) return alert('カートは空です。');

        fetch('/order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cart),
        }).then(res => res.json()).then(data => {
            if (data.success) {
                localStorage.removeItem('cart');
                window.location.href = `/order_complete?order_id=${data.orderId}`;
            } else {
                alert('注文処理中にエラーが発生しました。');
            }
        }).catch(error => {
            console.error('注文APIエラー:', error);
            alert('通信エラーが発生しました。');
        });
    });

    displayCart();
});