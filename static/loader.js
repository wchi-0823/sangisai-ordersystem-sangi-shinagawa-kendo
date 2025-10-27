/* ====================================================================
 *  汎用ローディングスクリーン マネージャー (loader.js)
 * ==================================================================== */

const LoadingScreenManager = {
    // プロパティ
    totalTasks: 0,
    completedTasks: 0,
    loaderWrapper: null,
    progressBar: null,
    progressPercent: null,

    /**
     * ローディング画面を初期化する
     * @param {number} taskCount - このページで完了すべきタスクの総数
     */
    init: function(taskCount) {
        this.totalTasks = taskCount;
        this.completedTasks = 0;
        
        // HTML要素を取得（初回のみ）
        if (!this.loaderWrapper) {
            this.loaderWrapper = document.getElementById('loader-wrapper');
            this.progressBar = document.getElementById('progress-bar');
            this.progressPercent = document.getElementById('progress-percent');
        }

        // 初期状態をリセット
        this.updateProgress();
    },

    /**
     * 1つのタスクが完了したときに呼び出す
     */
    taskComplete: function() {
        if (this.completedTasks < this.totalTasks) {
            this.completedTasks++;
            this.updateProgress();
        }

        // すべてのタスクが完了したら、ローダーを隠す
        if (this.completedTasks >= this.totalTasks) {
            // 念のため、少しだけ待ってから非表示にする（描画のカクつき防止）
            setTimeout(() => {
                this.hide();
            }, 100);
        }
    },

    /**
     * プログレスバーとパーセンテージ表示を更新する
     */
    updateProgress: function() {
        // totalTasksが0だと0除算になるのを防ぐ
        const percentage = this.totalTasks > 0 
            ? Math.round((this.completedTasks / this.totalTasks) * 100)
            : 100;

        if (this.progressBar) {
            this.progressBar.style.width = percentage + '%';
        }
        if (this.progressPercent) {
            this.progressPercent.textContent = percentage;
        }
    },

    /**
     * ローディング画面をフェードアウトして非表示にする
     */
    hide: function() {
        if (this.loaderWrapper) {
            this.loaderWrapper.classList.add('hidden');

            // アニメーション完了後（0.5秒後）に要素をDOMから削除して、完全に無効化する
            setTimeout(() => {
                if (this.loaderWrapper) { // まだ要素が存在すれば
                    this.loaderWrapper.style.display = 'none';
                }
            }, 500);
        }
    }
};