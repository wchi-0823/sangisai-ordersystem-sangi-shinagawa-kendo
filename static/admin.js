document.addEventListener('DOMContentLoaded', () => {
    // --- 店舗ステータストグルスイッチ ---
    const statusToggle = document.getElementById('store-status-toggle');
    const statusText = document.getElementById('store-status-text');

    if (statusToggle) {
        fetch('/api/get_store_status')
            .then(res => res.json())
            .then(data => {
                const isOpen = data.isStoreOpen;
                statusToggle.checked = isOpen;
                updateStatusText(isOpen);
            });

        statusToggle.addEventListener('change', () => {
            const newStatus = statusToggle.checked;
            fetch('/api/update_store_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isStoreOpen: newStatus })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    updateStatusText(newStatus);
                    alert(newStatus ? '注文の受付を開始しました。' : '注文の受付を停止しました。');
                } else {
                    alert('状態の変更に失敗しました: ' + data.error);
                    statusToggle.checked = !newStatus;
                }
            });
        });
    }

    function updateStatusText(isOpen) {
        if (isOpen) {
            statusText.textContent = '販売中';
            statusText.className = 'toggle-label open';
        } else {
            statusText.textContent = '販売停止中';
            statusText.className = 'toggle-label closed';
        }
    }

    // --- サイドバーの開閉処理 ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => { document.body.classList.toggle('sidebar-open'); });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => { document.body.classList.remove('sidebar-open'); });
    }

    // --- スクロール連動ハイライト ---
    const sections = document.querySelectorAll('.admin-container main section');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        sections.forEach(section => {
            if (window.pageYOffset >= section.offsetTop - 70) {
                currentSectionId = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    });

    // --- ダッシュボード関連 ---
    function renderDashboard() {
        const totalRevenueEl = document.getElementById('total-revenue');
        if (!totalRevenueEl) return;

        fetch('/api/get_sales_data').then(res => res.json()).then(data => {
            if (data.error) { return console.error("ダッシュボードデータ読み込み失敗:", data.error); }
            
            totalRevenueEl.textContent = `¥ ${data.total_revenue.toLocaleString()}`;
            document.getElementById('total-orders').textContent = data.total_orders;

            ['sales-by-item-chart', 'sales-by-category-chart'].forEach(chartId => {
                if(Chart.getChart(chartId)) { Chart.getChart(chartId).destroy(); }
            });

            new Chart(document.getElementById('sales-by-item-chart').getContext('2d'), {
                type: 'bar',
                data: { labels: Object.keys(data.sales_by_item), datasets: [{ label: '販売数', data: Object.values(data.sales_by_item), backgroundColor: 'rgba(54, 162, 235, 0.6)' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });

            new Chart(document.getElementById('sales-by-category-chart').getContext('2d'), {
                type: 'pie',
                data: { labels: Object.keys(data.sales_by_category), datasets: [{ data: Object.values(data.sales_by_category), backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        });
    }
    renderDashboard();

    // --- 店舗設定 ---
    const storeSettingsForm = document.getElementById('store-settings-form');
    if (storeSettingsForm) {
        const logoUrlInput = document.getElementById('store-logo-url');
        const logoPreview = document.getElementById('logo-preview');

        fetch('/api/get_store_settings').then(res => res.json()).then(data => {
            document.getElementById('store-name').value = data.storeName || '';
            logoUrlInput.value = data.storeLogoUrl || '';
            document.getElementById('store-description').value = data.storeDescription || '';
            if (data.storeLogoUrl) {
                logoPreview.src = data.storeLogoUrl;
                logoPreview.style.display = 'block';
            }
        });

        logoUrlInput.addEventListener('input', (e) => {
            const url = e.target.value;
            logoPreview.style.display = (url && (url.startsWith('http://') || url.startsWith('https://'))) ? 'block' : 'none';
            logoPreview.src = url;
        });

        storeSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(storeSettingsForm).entries());
            fetch('/api/update_store_settings', {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)
            }).then(res => res.json()).then(result => {
                if (result.success) { 
                    alert('店舗設定を保存しました。ページをリロードします。');
                    window.location.reload();
                } else { 
                    alert('保存に失敗しました: ' + result.error);
                }
            });
        });
    }

    // --- メニュー管理 ---
    const menuTableEl = document.getElementById('item-table');
    if (menuTableEl) {
        const menuTable = new Tabulator(menuTableEl, {
            layout: "fitData",
            placeholder: "データを読み込み中...",
            columns: [
                {title: "ID", field: "id", visible: false},
                {title: "商品名", field: "name", editor: "input", width: 150},
                {title: "価格(円)", field: "price", editor: "number", hozAlign: "right", width: 100},
                {title: "カテゴリ", field: "category", editor: "input", width: 120},
                {title: "商品説明", field: "description", editor: "input"},
                {
                    title: "アレルゲン(カンマ区切り)", field: "allergens", editor: "input",
                    formatter: (cell) => Array.isArray(cell.getValue()) ? cell.getValue().join(', ') : '',
                    mutator: (value, data, type) => (type === 'edit') ? value.split(',').map(s => s.trim()).filter(s => s) : value
                },
                {title: "画像URL", field: "imageUrl", editor: "input"},
                {title: "セット商品", field: "isSet", hozAlign: "center", width: 100, formatter: "tickCross", cellClick: (e, cell) => cell.setValue(!cell.getValue())},
                {title: "セット個数", field: "setCount", editor: "number", hozAlign: "right", width: 100},
                {
                    title: "セット対象商品(カンマ区切り)", field: "setItems", editor: "input",
                    formatter: (cell) => Array.isArray(cell.getValue()) ? cell.getValue().join(', ') : '',
                    mutator: (value, data, type) => (type === 'edit') ? value.split(',').map(s => s.trim()).filter(s => s) : value
                },
                {
                    title: "販売中", field: "isSoldOut", hozAlign: "center", width: 100,
                    formatter: "tickCross",
                    formatterParams:{ tickElement:"<span style='color:green; font-weight:bold;'>&#10004;</span>", crossElement:"<span style='color:red; font-weight:bold;'>&#10006;</span>" },
                    cellClick: (e, cell) => cell.setValue(!cell.getValue())
                },
            ],
        });
        
        menuTable.on("cellEdited", function(cell){
            const data = cell.getRow().getData();
            let { field, value } = { field: cell.getField(), value: cell.getValue() };
            if (field === 'isSoldOut') { value = !value; }

            fetch('/api/update_item', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ id: data.id, field, value })
            }).then(res => res.json()).then(data => { 
                if (!data.success) { 
                    alert("更新失敗: " + data.error); 
                    cell.restoreOldValue(); 
                } 
            });
        });

        fetch('/api/get_items').then(res => res.json()).then(data => {
            if (data.error) { alert("データ読み込み失敗: " + data.error); } 
            else { 
                menuTable.setData(data.map(item => ({ ...item, isSoldOut: !item.isSoldOut })));
            }
        });
    }
    
    // --- CSVアップロードフォームの共通処理 ---
    function setupCsvUploadForm(formId, apiEndpoint, statusId) {
        const form = document.getElementById(formId);
        if (!form) return;
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const fileInput = form.querySelector('input[type="file"]');
            const statusEl = document.getElementById(statusId);
            const file = fileInput.files[0];
            if (!file) return alert('ファイルを選択してください。');
            
            statusEl.textContent = 'アップロード中...';
            const formData = new FormData(); 
            formData.append('csv-file', file);
            
            fetch(apiEndpoint, { method: 'POST', body: formData })
                .then(res => res.json()).then(data => {
                    if (data.success) {
                        statusEl.textContent = '更新完了！2秒後にリロードします。';
                        setTimeout(() => window.location.reload(), 2000);
                    } else { statusEl.textContent = 'エラー: ' + data.error; }
                }).catch(err => {
                    statusEl.textContent = '通信エラーが発生しました。';
                });
        });
    }
    setupCsvUploadForm('csv-upload-form', '/api/upload_csv', 'upload-status');
    setupCsvUploadForm('signage-csv-upload-form', '/api/upload_signage_csv', 'signage-upload-status');

    // --- サイネージ管理 ---
    const signageTableEl = document.getElementById('signage-table');
    if(signageTableEl) {
        const signageTable = new Tabulator(signageTableEl, {
            layout: "fitColumns", 
            placeholder: "データを読み込み中...",
            columns: [
                {title: "ID", field: "id", visible: false},
                {title: "表示順", field: "order", editor: "number", width: 100, hozAlign: "center"},
                {title: "画像URL", field: "url", editor: "input"},
                {title: "表示秒数", field: "duration", editor: "number", width: 120, hozAlign: "center"},
            ],
        });
        signageTable.on("cellEdited", function(cell){
            const {id, field, value} = {id: cell.getRow().getData().id, field: cell.getField(), value: cell.getValue()};
            fetch('/api/update_signage_item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, field, value })
            }).then(res => res.json()).then(data => { if (!data.success) { alert("更新失敗: " + data.error); cell.restoreOldValue(); } });
        });
        fetch('/api/get_signage_list').then(res => res.json()).then(data => {
            if (data.error) { alert("サイネージデータ読み込み失敗: " + data.error); } else { signageTable.setData(data); }
        });
    }

    // --- ユーザー管理 (superadmin専用) ---
    const userTableEl = document.getElementById('user-table');
    if (userTableEl) {
        const userTable = new Tabulator(userTableEl, {
            layout: "fitColumns", 
            placeholder: "ユーザー情報を読み込み中...",
            columns: [
                {title: "ユーザー名", field: "username"},
                {title: "役割", field: "role"},
                {title: "削除", width: 100, hozAlign:"center",
                 formatter: () => "<button class='button-link danger-btn'>削除</button>",
                 cellClick: (e, cell) => {
                    const data = cell.getRow().getData();
                    if (confirm(`本当にユーザー「${data.username}」を削除しますか？`)) {
                        fetch('/api/delete_user', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: data.username})})
                            .then(res => res.json()).then(result => {
                                if(result.success) { alert('削除しました。'); window.location.reload(); }
                                else { alert('削除失敗: ' + result.error); }
                            });
                    }
                 }
                }
            ],
        });
        fetch('/api/get_users').then(res => res.json()).then(data => userTable.setData(data));
    }
    
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userStatusEl = document.getElementById('user-status');
            const username = document.getElementById('new-username').value;
            const password = document.getElementById('new-password').value;
            const role = document.getElementById('new-role').value;
            if (!username || !password) { return alert('ユーザー名とパスワードは必須です。'); }
            
            userStatusEl.textContent = '登録中...';
            fetch('/api/add_user', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username, password, role})})
                .then(res => res.json()).then(data => {
                    if(data.success) {
                        userStatusEl.textContent = 'ユーザーを追加しました！';
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        userStatusEl.textContent = '追加失敗: ' + data.error;
                    }
                });
        });
    }

    // --- ロール別アクセス権限 (superadmin専用) ---
    const permissionsTable = document.getElementById('role-access-table');
    if (permissionsTable) {
        const roles = ['admin', 'staff'];
        const pages = [
            { id: 'kitchen', name: '厨房モニター' }, { id: 'display', name: '総合モニター' },
            { id: 'cashier', name: '会計・受取' }, { id: 'admin', name: '管理者ページ' },
        ];
        const tbody = permissionsTable.querySelector('tbody');

        roles.forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${role}</td>` + 
                pages.map(page => `<td><input type="checkbox" data-role="${role}" data-page="${page.id}"></td>`).join('');
            tbody.appendChild(tr);
        });

        fetch('/api/get_permissions').then(res => res.json()).then(permissions => {
            if(permissions.error) throw new Error(permissions.error);
            document.querySelectorAll('#role-access-table input[type="checkbox"]').forEach(checkbox => {
                const { role, page } = checkbox.dataset;
                if (permissions[role] && permissions[role][page]) {
                    checkbox.checked = true;
                }
            });
        }).catch(err => console.error('権限データの読み込みに失敗:', err));

        tbody.addEventListener('change', (e) => {
            if (e.target.type !== 'checkbox') return;
            const currentPermissions = {};
            roles.forEach(role => {
                currentPermissions[role] = {};
                pages.forEach(page => {
                    const checkbox = document.querySelector(`input[data-role="${role}"][data-page="${page.id}"]`);
                    currentPermissions[role][page.id] = checkbox.checked;
                });
            });

            const statusEl = document.getElementById('permissions-status');
            statusEl.textContent = '保存中...';
            fetch('/api/update_permissions', {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(currentPermissions)
            }).then(res => res.json()).then(result => {
                statusEl.textContent = result.success ? '権限設定を保存しました。' : '保存に失敗しました: ' + result.error;
                setTimeout(() => statusEl.textContent = '', 2000);
            });
        });
    }

    // --- リセット機能 (superadmin専用) ---
    function setupResetButton(buttonId, apiEndpoint, confirmMessage) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.addEventListener('click', () => {
            const promptMessage = (buttonId === 'reset-super-btn') ? '【超危険】すべてのデータを完全に削除し、工場出荷状態に戻します。\n実行するには「SUPER RESET」と入力してください。' : confirmMessage;
            const confirmation = (buttonId === 'reset-super-btn') ? prompt(promptMessage) === 'SUPER RESET' : confirm(promptMessage);
            
            if (confirmation) {
                fetch(apiEndpoint, {method: 'POST'}).then(res => res.json()).then(data => {
                    if(data.success) {
                        alert('リセットが完了しました。');
                        if (buttonId === 'reset-super-btn') {
                            window.location.href = '/logout';
                        } else {
                            window.location.reload();
                        }
                    } else { alert('リセット失敗: ' + data.error); }
                });
            }
        });
    }
    setupResetButton('reset-data-btn', '/api/reset_data', '本当にすべての運営データ（注文、商品、サイネージ）を削除しますか？\nこの操作は取り消せません。');
    setupResetButton('reset-all-btn', '/api/reset_all', '【最終確認】本当に運営データと、あなた以外のアカウントをすべて削除しますか？');
    setupResetButton('reset-super-btn', '/api/reset_super', ''); // prompt message is handled inside
});