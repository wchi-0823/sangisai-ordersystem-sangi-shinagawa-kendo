document.addEventListener('DOMContentLoaded', () => {
    const notificationSound = new Audio('/static/ping.mp3');
    const unmuteButton = document.getElementById('unmute-button');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const cookingTicketsList = document.getElementById('cooking-tickets-list');
    const readyTicketsList = document.getElementById('ready-tickets-list');
    const inputPreview = document.getElementById('input-preview');

    let isSoundEnabled = false;
    let previousReadyCount = 0;
    let inputBuffer = '';

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

    function updatePreview() {
        if (inputBuffer.length > 0) {
            inputPreview.textContent = inputBuffer;
            inputPreview.classList.add('visible');
        } else {
            inputPreview.classList.remove('visible');
        }
    }

    function processOrder(ticketNumber) {
        let found = false;
        const targetTickets = readyTicketsList.querySelectorAll('.ticket-number');
        targetTickets.forEach(ticket => {
            if (ticket.textContent === ticketNumber) {
                ticket.click();
                found = true;
            }
        });
        if (!found) {
            alert(`呼び出し中の番号 ${ticketNumber} は見つかりません。`);
        }
    }

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

    db.collection('orders').where('status', '==', '提供可能').orderBy('createdAt', 'asc')
        .onSnapshot(querySnapshot => {
            const currentReadyCount = querySnapshot.size;
            if (isSoundEnabled && currentReadyCount > previousReadyCount) {
                notificationSound.play().catch(error => console.warn("音声再生失敗:", error));
            }
            previousReadyCount = currentReadyCount;

            readyTicketsList.innerHTML = '';
            querySnapshot.forEach(doc => {
                const order = doc.data();
                const orderId = doc.id;
                const ticketDiv = document.createElement('div');
                ticketDiv.className = 'ticket-number';
                ticketDiv.textContent = order.ticketNumber;
                ticketDiv.dataset.id = orderId;

                ticketDiv.addEventListener('click', () => {
                    if (confirm(`注文番号 ${ticketDiv.textContent} を完了にしてよろしいですか？`)) {
                        fetch('/api/update_order_status', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ docId: orderId, status: '完了' })
                        }).then(res => res.json()).then(data => {
                            if (!data.success) { alert('ステータスの更新に失敗しました: ' + data.error); }
                        });
                    }
                });
                readyTicketsList.appendChild(ticketDiv);
            });
        });
});