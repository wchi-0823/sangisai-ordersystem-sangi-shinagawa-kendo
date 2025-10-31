/**
 * ====================================================================
 * 管理者ページ (admin.js)
 * ====================================================================
 * 機能：
 * 1. サイドバーの開閉と、スクロールに連動したハイライト
 * 2. ダッシュボードの描画 (KPI, グラフ) と売上CSVダウンロード
 * 3. 店舗設定の読み込み、プレビュー、保存
 * 4. メニュー編集テーブル(Tabulator)の制御と、CSVによる一括更新
 * 5. サイネージ管理テーブル(Tabulator)の制御と、CSVによる一括更新
 * 6. 【superadmin専用】ユーザー管理テーブルと、新規ユーザー追加
 * 7. 【superadmin専用】ロール別アクセス権限の設定
 * 8. 【superadmin専用】各種データリセット機能
 */
document.addEventListener('DOMContentLoaded', () => {

    
    // --- 店舗ステータストグルスイッチ ---
    const statusToggle = document.getElementById('store-status-toggle');
    const statusText = document.getElementById('store-status-text');

    if (statusToggle) {
        // 1. 現在の状態をサーバーから取得して表示
        fetch('/api/get_store_status')
            .then(res => res.json())
            .then(data => {
                const isOpen = data.isStoreOpen;
                statusToggle.checked = isOpen;
                updateStatusText(isOpen);
            });

        // 2. スイッチが変更された時のイベント
        statusToggle.addEventListener('change', () => {
            const newStatus = statusToggle.checked;
            
            // サーバーに新しい状態を送信
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
                    // 失敗したらスイッチを元の状態に戻す
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


    // --- 1. サイドバーの開閉処理 ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('sidebar-open');
        });
    }
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            document.body.classList.remove('sidebar-open');
        });
    }

    // スクロールに連動したサイドバーのハイライト処理
    const sections = document.querySelectorAll('main section');
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    window.addEventListener('scroll', () => {
        let currentSectionId = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (window.pageYOffset >= sectionTop - 70) {
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


    // --- 2. ダッシュボード関連 ---
    function renderDashboard() {
        const totalRevenueEl = document.getElementById('total-revenue');
        if (!totalRevenueEl) return;

        fetch('/api/get_sales_data').then(res => res.json()).then(data => {
            if (data.error) { return console.error("ダッシュボードデータ読み込み失敗:", data.error); }
            
            totalRevenueEl.textContent = `¥ ${data.total_revenue.toLocaleString()}`;
            document.getElementById('total-orders').textContent = data.total_orders;

            if(Chart.getChart("sales-by-item-chart")){ Chart.getChart("sales-by-item-chart").destroy(); }
            new Chart(document.getElementById('sales-by-item-chart').getContext('2d'), {
                type: 'bar',
                data: { labels: Object.keys(data.sales_by_item), datasets: [{ label: '販売数', data: Object.values(data.sales_by_item), backgroundColor: 'rgba(54, 162, 235, 0.6)' }] },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });

            if(Chart.getChart("sales-by-category-chart")){ Chart.getChart("sales-by-category-chart").destroy(); }
            new Chart(document.getElementById('sales-by-category-chart').getContext('2d'), {
                type: 'pie',
                data: { labels: Object.keys(data.sales_by_category), datasets: [{ data: Object.values(data.sales_by_category), backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
        });
    }
    renderDashboard();

    // 売上CSVダウンロードボタン
    const downloadSalesBtn = document.getElementById('download-sales-csv-btn');
    if(downloadSalesBtn) {
        downloadSalesBtn.addEventListener('click', () => {
            window.location.href = '/api/download_sales_csv';
        });
    }


    // --- 3. 店舗設定 ---
    const storeSettingsForm = document.getElementById('store-settings-form');
    if (storeSettingsForm) {
        const logoUrlInput = document.getElementById('store-logo-url');
        const logoPreview = document.getElementById('logo-preview');

        // 設定の読み込みと表示
        fetch('/api/get_store_settings').then(res => res.json()).then(data => {
            document.getElementById('store-name').value = data.storeName || '';
            logoUrlInput.value = data.storeLogoUrl || '';
            document.getElementById('store-description').value = data.storeDescription || '';
            if (data.storeLogoUrl) {
                logoPreview.src = data.storeLogoUrl;
                logoPreview.style.display = 'block';
            }
        });

        // ロゴURL入力時のプレビュー
        logoUrlInput.addEventListener('input', (e) => {
            const url = e.target.value;
            if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
                logoPreview.src = url;
                logoPreview.style.display = 'block';
            } else {
                logoPreview.style.display = 'none';
            }
        });

        // 設定の保存
        storeSettingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(storeSettingsForm);
            const data = Object.fromEntries(formData.entries());
            fetch('/api/update_store_settings', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
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


    // --- 4. メニュー管理 ---
    const menuTableEl = document.getElementById('item-table');
    if (menuTableEl) {
        const menuTable = new Tabulator(menuTableEl, {
            // 【変更】heightを削除し、データ量に応じた自動調整に変更
            layout: "fitColumns", 
            placeholder: "データを読み込み中...",
            columns: [
                {title: "ID", field: "id", visible: false}, 
                {title: "商品名", field: "name", editor: "input", width: 200},
                {title: "価格(円)", field: "price", editor: "number", hozAlign: "right", width: 100},
                {title: "カテゴリ", field: "category", editor: "input"}, 
                {title: "商品説明", field: "description", editor: "input", width: 300},
                {title: "画像URL", field: "imageUrl", editor: "input", width: 300},

                {
                    title: "アレルゲン (カンマ区切り)", 
                    field: "allergens", 
                    editor: "input",
                    width: 250,
                    formatter: function(cell, formatterParams, onRendered){
                        const data = cell.getValue();
                        return Array.isArray(data) ? data.join(', ') : '';
                    },
                    mutator: function(value, data, type, params, component){
                        if (type === 'edit') {
                            return value.split(',').map(s => s.trim()).filter(s => s);
                        }
                        return value;
                    }
                },
                
                // 【変更】「販売中」列を1クリックで編集できるように設定を変更
                {
                    title: "販売中", 
                    field: "isSoldOut", 
                    hozAlign: "center", 
                    width: 100,
                    formatter: "tickCross", // 見た目はチェックマーク
                    formatterParams:{
                        tickElement:"<span style='color:green; font-weight:bold;'>&#10004;</span>",
                        crossElement:"<span style='color:red; font-weight:bold;'>&#10006;</span>",
                    },
                    cellClick: function(e, cell){
                        // クリック一回で値をトグルさせる
                        cell.setValue(!cell.getValue());
                    }
                },
            ],
        });
        
        // セルの値が「プログラムによって」変更された後に発火するイベント
        menuTable.on("cellEdited", function(cell){
            const data = cell.getRow().getData();
            const field = cell.getField();
            let value = cell.getValue();

            // 「販売中」のチェックボックスの場合、表示用の真偽値とDBに保存する真偽値が逆なので、反転させてからAPIに送る
            // UI: true(チェック有) = 販売中  -> isSoldOut: false
            // UI: false(チェック無) = 売り切れ -> isSoldOut: true
            if (field === 'isSoldOut') {
                value = !value;
            }

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

        // データの読み込み
        fetch('/api/get_items').then(res => res.json()).then(data => {
            if (data.error) { 
                alert("データ読み込み失敗: " + data.error); 
            } else { 
                // DBのisSoldOut(true=売り切れ)を、UI表示用の真偽値(true=販売中)に変換する
                const formattedData = data.map(item => ({ ...item, isSoldOut: !item.isSoldOut }));
                menuTable.setData(formattedData);
            }
        });
    }
    
    const menuCsvForm = document.getElementById('csv-upload-form');
    if (menuCsvForm) {
        const fileInput = document.getElementById('csv-file-input');
        const statusEl = document.getElementById('upload-status');
        menuCsvForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const file = fileInput.files[0]; if (!file) return alert('ファイルを選択してください。');
            statusEl.textContent = 'アップロード中...';
            const formData = new FormData(); formData.append('csv-file', file);
            fetch('/api/upload_csv', { method: 'POST', body: formData })
                .then(res => res.json()).then(data => {
                    if (data.success) {
                        statusEl.textContent = '更新完了！2秒後にリロードします。';
                        setTimeout(() => window.location.reload(), 2000);
                    } else { statusEl.textContent = 'エラー: ' + data.error; }
                });
        });
    }

    // --- 5. サイネージ管理 ---
    const signageTableEl = document.getElementById('signage-table');
    if(signageTableEl) {
        const signageTable = new Tabulator(signageTableEl, {
            // 【変更】heightを削除し、データ量に応じた自動調整に変更
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
    const signageCsvForm = document.getElementById('signage-csv-upload-form');
    if (signageCsvForm) {
        const fileInput = document.getElementById('signage-csv-file-input');
        const statusEl = document.getElementById('signage-upload-status');
        signageCsvForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const file = fileInput.files[0]; if (!file) return alert('ファイルを選択してください。');
            statusEl.textContent = 'アップロード中...';
            const formData = new FormData(); formData.append('csv-file', file);
            fetch('/api/upload_signage_csv', { method: 'POST', body: formData })
                .then(res => res.json()).then(data => {
                    if (data.success) {
                        statusEl.textContent = '更新完了！2秒後にリロードします。';
                        setTimeout(() => window.location.reload(), 2000);
                    } else { statusEl.textContent = 'エラー: ' + data.error; }
                });
        });
    }

    // --- 6. ユーザー管理 (superadmin専用) ---
    const userTableEl = document.getElementById('user-table');
    if (userTableEl) {
        const userTable = new Tabulator(userTableEl, {
            // 【変更】heightを削除し、データ量に応じた自動調整に変更
            layout: "fitColumns", 
            placeholder: "ユーザー情報を読み込み中...",
            columns: [
                {title: "ユーザー名", field: "username"},
                {title: "役割", field: "role"},
                {title: "削除", width: 100, hozAlign:"center",
                 formatter: (cell) => "<button class='button-link danger-btn'>削除</button>",
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
        const userStatusEl = document.getElementById('user-status');
        addUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = document.getElementById('new-username').value;
            const password = document.getElementById('new-password').value;
            const role = document.getElementById('new-role').value;
            if (!username || !password) { alert('ユーザー名とパスワードは必須です。'); return; }
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

    // --- 7. ロール別アクセス権限 (superadmin専用) ---
    const permissionsTable = document.getElementById('role-access-table');
    if (permissionsTable) {
        const roles = ['admin', 'staff'];
        const pages = [
            { id: 'kitchen', name: '厨房モニター' },
            { id: 'display', name: '総合モニター' },
            { id: 'cashier', name: '会計・受取' },
            { id: 'admin', name: '管理者ページ' },
        ];
        const tbody = permissionsTable.querySelector('tbody');

        roles.forEach(role => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${role}</td>` + 
                pages.map(page => `<td><input type="checkbox" data-role="${role}" data-page="${page.id}"></td>`).join('');
            tbody.appendChild(tr);
        });

        fetch('/api/get_permissions')
            .then(res => res.json())
            .then(permissions => {
                if(permissions.error) throw new Error(permissions.error);
                document.querySelectorAll('#role-access-table input[type="checkbox"]').forEach(checkbox => {
                    const role = checkbox.dataset.role;
                    const page = checkbox.dataset.page;
                    if (permissions[role] && permissions[role][page]) {
                        checkbox.checked = true;
                    }
                });
            })
            .catch(err => console.error('権限データの読み込みに失敗:', err));

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
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(currentPermissions)
            }).then(res => res.json()).then(result => {
                if (result.success) {
                    statusEl.textContent = '権限設定を保存しました。';
                    setTimeout(() => statusEl.textContent = '', 2000);
                } else {
                    statusEl.textContent = '保存に失敗しました: ' + result.error;
                }
            });
        });
    }


    // --- 8. リセット機能 (superadmin専用) ---
    const resetDataBtn = document.getElementById('reset-data-btn');
    if(resetDataBtn){
        resetDataBtn.addEventListener('click', () => {
            if (confirm('本当にすべての運営データ（注文、商品、サイネージ）を削除しますか？\nこの操作は取り消せません。')) {
                fetch('/api/reset_data', {method: 'POST'}).then(res => res.json()).then(data => {
                    if(data.success) { alert('運営データをリセットしました。'); window.location.reload(); }
                    else { alert('リセット失敗: ' + data.error); }
                });
            }
        });
    }
    const resetAllBtn = document.getElementById('reset-all-btn');
    if(resetAllBtn){
        resetAllBtn.addEventListener('click', () => {
            if (confirm('【最終確認】本当に運営データと、あなた以外のアカウントをすべて削除しますか？')) {
                fetch('/api/reset_all', {method: 'POST'}).then(res => res.json()).then(data => {
                    if(data.success) { alert('ALLリセットが完了しました。'); window.location.reload(); }
                    else { alert('リセット失敗: ' + data.error); }
                });
            }
        });
    }
    const resetSuperBtn = document.getElementById('reset-super-btn');
    if(resetSuperBtn){
        resetSuperBtn.addEventListener('click', () => {
            if (prompt('【超危険】すべてのデータを完全に削除し、工場出荷状態に戻します。\n実行するには「SUPER RESET」と入力してください。') === 'SUPER RESET') {
                fetch('/api/reset_super', {method: 'POST'}).then(res => res.json()).then(data => {
                    if(data.success) {
                        alert('SUPERリセットが完了しました。再度アクセスするには、create_superadmin.pyを実行する必要があります。');
                        window.location.href = '/logout';
                    } else { alert('リセット失敗: ' + data.error); }
                });
            }
        });
    }
});