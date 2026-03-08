/**
 * app.js - アプリコア・初期化・イベント連携
 * MultiTranslate
 */

const Toast = {
    show(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = { success: '✓', error: '✕', info: 'ℹ' };
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'none';
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            toast.style.transition = 'all 0.25s ease';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    },
};

const App = {
    init() {
        // ストレージ初期化
        Storage.init();

        // 各モジュール初期化
        Settings.init();
        Sidebar.init();
        Modals.init();

        // モバイルオーバーレイ追加
        this._appendMobileOverlay();

        // イベント登録
        this._bindHeaderEvents();
        this._bindFooterEvents();
        this._bindReceiveEvents();
        this._bindSidebarButtons();
        this._bindBackButton();
        this._bindKeyboardShortcuts();

        // デモ：最初のスレッドを自動選択
        const threads = Storage.getThreads();
        if (threads.length > 0) {
            const firstThread = threads[0];
            Sidebar.selectThread(firstThread.id, firstThread.companyId);
        }
    },

    // ===== ヘッダーイベント =====

    _bindHeaderEvents() {
        // 言語セレクタ変更
        document.getElementById('lang-selector')?.addEventListener('change', (e) => {
            Chat.handleLangChange(e.target.value);
        });

        // トーンセレクタ変更
        document.getElementById('tone-selector')?.addEventListener('change', (e) => {
            Chat.handleToneChange(e.target.value);
        });

        // 新規案件ボタン
        document.getElementById('btn-new-thread')?.addEventListener('click', () => {
            if (Chat.currentCompanyId) {
                this.showNewThreadModal(Chat.currentCompanyId);
            } else {
                Toast.show('会社を選択してください', 'error');
            }
        });

        // AI支援ボタン
        document.getElementById('btn-ai-assist')?.addEventListener('click', () => {
            Modals.openAiPanel();
        });
    },

    // ===== フッター（送信エリア）イベント =====

    _bindFooterEvents() {
        // 受信取り込みボタン
        document.getElementById('btn-receive-msg')?.addEventListener('click', () => {
            Chat.openReceiveInput();
        });

        // 署名ボタン
        document.getElementById('btn-signature')?.addEventListener('click', () => {
            Modals.openSignatureSelect();
        });

        // 翻訳ボタン
        document.getElementById('btn-translate-send')?.addEventListener('click', () => {
            Chat.handleTranslateSend();
        });

        // 送信ボタン
        document.getElementById('btn-send')?.addEventListener('click', () => {
            Chat.handleSend();
        });

        // AI下書きボタン（インライン）
        document.getElementById('btn-ai-draft')?.addEventListener('click', () => {
            Modals.openAiPanel();
        });

        // 添付ボタン（将来拡張用・現時点はトースト）
        document.getElementById('btn-attach')?.addEventListener('click', () => {
            Toast.show('添付ファイル機能は将来実装予定です', 'info');
        });

        // Enterキーで送信（Shift+Enterで改行）
        document.getElementById('send-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                Chat.handleTranslateSend();
            }
        });

        // テキストエリア自動リサイズ
        document.getElementById('send-input')?.addEventListener('input', (e) => {
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 150) + 'px';
        });
    },

    // ===== 受信エリアイベント =====

    _bindReceiveEvents() {
        // 閉じるボタン
        document.getElementById('btn-close-receive')?.addEventListener('click', () => {
            Chat.closeReceiveInput();
        });

        // 翻訳して取り込むボタン
        document.getElementById('btn-translate-receive')?.addEventListener('click', () => {
            Chat.handleTranslateReceive();
        });

        // テキストエリアEnterは改行（受信欄は複数行対応）
        document.getElementById('receive-text')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                Chat.handleTranslateReceive();
            }
        });
    },

    // ===== サイドバーボタン =====

    _bindSidebarButtons() {
        // 新規会社ボタン（ヘッダー）
        document.getElementById('btn-new-company')?.addEventListener('click', () => {
            Modals.openNewCompany();
        });

        // 新規会社ボタン（空状態）
        document.getElementById('btn-start-new')?.addEventListener('click', () => {
            Modals.openNewCompany();
        });

        // 設定ボタン
        document.getElementById('btn-settings')?.addEventListener('click', () => {
            Modals.openSettings();
        });

        // 辞書ボタン
        document.getElementById('btn-dictionary')?.addEventListener('click', () => {
            Modals.openDictionary();
        });
    },

    // ===== モバイル：戻るボタン =====

    _bindBackButton() {
        document.getElementById('btn-back')?.addEventListener('click', () => {
            Sidebar.openMobileSidebar();
        });
    },

    // ===== キーボードショートカット =====

    _bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape でモーダルを閉じる
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
                    m.classList.add('hidden');
                });
                if (!document.getElementById('ai-panel')?.classList.contains('hidden')) {
                    Modals.closeAiPanel();
                }
                if (!document.getElementById('receive-input-area')?.classList.contains('hidden')) {
                    Chat.closeReceiveInput();
                }
            }
        });
    },

    // ===== モバイルオーバーレイ =====

    _appendMobileOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.remove('open');
            overlay.classList.remove('active');
        });
        document.getElementById('app')?.appendChild(overlay);
    },

    // ===== 外部から呼び出されるAPI =====

    showNewThreadModal(companyId) {
        Modals.openNewThread(companyId);
    },
};

// ===== DOMContentLoaded で起動 =====
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
