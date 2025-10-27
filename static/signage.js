/**
 * ====================================================================
 * デジタルサイネージページ (signage.js) - 画像専用
 * ====================================================================
 * 機能：
 * 1. APIから画像リストと設定を取得
 * 2. 設定された秒数ごとに、画像をフェードイン/アウトで切り替える
 * 3. 全画面表示の切り替え機能
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. HTML要素の取得と変数の初期化 ---
    const container = document.getElementById('signage-container');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    
    let currentIndex = 0;
    let signageData = null; // APIから取得した全データ (items と settings)
    let slideInterval;      // スライド切り替えのためのタイマーID

    
    // --- 2. メイン実行フロー ---

    // APIからサイネージデータを取得
    fetch('/api/get_signage_items')
        .then(res => res.json())
        .then(data => {
            if (data.error || !data.items || data.items.length === 0) {
                throw new Error(data.error || "表示するコンテンツがありません");
            }
            signageData = data;

            // 取得したデータを元に、スライドのDOM要素を作成
            createSlideElements();
            
            // スライドショーを開始
            startSlideShow();
        })
        .catch(err => {
            console.error("初期化処理中にエラーが発生しました:", err);
            container.innerHTML = `<p style="color:white; text-align:center;">コンテンツの読み込みに失敗しました。</p>`;
        });


    // --- 3. 関数定義 ---

    /**
     * APIデータを元に、スライドのDOM要素を作成する
     */
    function createSlideElements() {
        signageData.items.forEach((item, index) => {
            const slideDiv = document.createElement('div');
            slideDiv.id = `slide-${index}`;
            slideDiv.className = 'slide';
            // 画像のURLを背景として設定
            slideDiv.style.backgroundImage = `url(${item.url})`;
            container.appendChild(slideDiv);
        });
    }

    /**
     * スライドショーを開始/進行する
     */
    function startSlideShow() {
        // 既存のタイマーがあればクリア
        clearTimeout(slideInterval);
        
        showSlide(currentIndex);
        
        const currentItem = signageData.items[currentIndex];
        if (currentItem) {
            // 表示秒数後に nextSlide を呼び出すタイマーを設定
            slideInterval = setTimeout(nextSlide, currentItem.duration * 1000);
        }
    }

    /**
     * 特定のスライドを表示する
     */
    function showSlide(index) {
        document.querySelectorAll('.slide').forEach((slide, i) => {
            // フェードアニメーションの時間をDBの設定から取得（なければデフォルト1.5s）
            const fadeDuration = (signageData.settings && signageData.settings.fadeDuration) 
                ? signageData.settings.fadeDuration 
                : 1.5;
            slide.style.transition = `opacity ${fadeDuration}s ease-in-out`;

            if (i === index) {
                slide.classList.add('active'); // 表示するスライド
            } else {
                slide.classList.remove('active'); // それ以外は非表示
            }
        });
    }

    /**
     * 次のスライドへ進む
     */
    function nextSlide() {
        // インデックスを次に進める（最後まで行ったら0に戻る）
        currentIndex = (currentIndex + 1) % signageData.items.length;
        startSlideShow();
    }


    // --- 4. イベントリスナー ---

    // 全画面表示ボタンのクリックイベント
    fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    });

    // フルスクリーン状態の変化を監視
    document.addEventListener('fullscreenchange', () => {
        // fullscreenElementが存在するかどうかで、bodyにクラスを付け外しする
        document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
    });
});