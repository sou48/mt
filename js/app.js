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
        Dom.setMarkup(toast, `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span>${message}</span>`);
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
    sidebarWidthKey: 'mt.sidebarWidth',
    defaultSidebarWidth: 300,
    minSidebarWidth: 240,
    maxSidebarWidth: 520,

    async init() {
        this._applyTestLoginVisibility();
        this._bindLoginEvents();
        this._appendMobileOverlay();
        this._initSidebarResizer();

        try {
            await Storage.init();
            await this._startAuthenticatedApp();
        } catch (_error) {
            this._showLogin();
        }
    },

    async _startAuthenticatedApp() {
        this._hideLogin();

        Settings.init();
        Sidebar.init();
        Modals.init();

        this._bindHeaderEvents();
        this._bindFooterEvents();
        this._bindReceiveEvents();
        this._bindSidebarButtons();
        this._bindBackButton();
        this._bindKeyboardShortcuts();

        await Storage.loadSystemDictionary();

        const threads = Storage.getThreads();
        if (threads.length > 0) {
            const firstThread = threads[0];
            await Sidebar.selectThread(firstThread.id, firstThread.companyId);
        }
    },

    _bindLoginEvents() {
        document.getElementById('btn-login')?.addEventListener('click', () => this.handleLogin());
        document.getElementById('btn-test-login')?.addEventListener('click', () => this.handleTestLogin());
        document.getElementById('login-password')?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleLogin();
            }
        });
    },

    _applyTestLoginVisibility() {
        if (window.location.hostname === 'mt.trialworks.jp') {
            document.getElementById('btn-test-login')?.classList.add('hidden');
        }
    },

    async handleLogin() {
        const email = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value || '';
        if (!email || !password) {
            Toast.show('メールアドレスとパスワードを入力してください', 'error');
            return;
        }

        try {
            await ApiClient.login(email, password);
            await Storage.reset();
            await this._startAuthenticatedApp();
            Toast.show('ログインしました', 'success');
        } catch (error) {
            Toast.show(`ログインエラー: ${error.message}`, 'error');
        }
    },

    async handleTestLogin() {
        try {
            await ApiClient.testLogin();
            await Storage.reset();
            await this._startAuthenticatedApp();
            Toast.show('テストユーザーでログインしました', 'success');
        } catch (error) {
            Toast.show(`テストログインエラー: ${error.message}`, 'error');
        }
    },

    _showLogin() {
        document.getElementById('login-overlay')?.classList.remove('hidden');
    },

    _hideLogin() {
        document.getElementById('login-overlay')?.classList.add('hidden');
    },

    _initSidebarResizer() {
        const handle = document.getElementById('sidebar-resizer');
        const sidebar = document.getElementById('sidebar');
        if (!handle || !sidebar) return;

        const applyWidth = (value, persist = false) => {
            const width = Math.max(this.minSidebarWidth, Math.min(this.maxSidebarWidth, Math.round(value)));
            document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
            if (persist) {
                window.localStorage.setItem(this.sidebarWidthKey, String(width));
            }
        };

        const savedWidth = Number(window.localStorage.getItem(this.sidebarWidthKey) || this.defaultSidebarWidth);
        applyWidth(Number.isFinite(savedWidth) ? savedWidth : this.defaultSidebarWidth);

        let isResizing = false;
        let startX = 0;
        let startWidth = this.defaultSidebarWidth;

        const stopResize = () => {
            if (!isResizing) return;
            isResizing = false;
            document.body.classList.remove('sidebar-resizing');
            const currentWidth = sidebar.getBoundingClientRect().width;
            applyWidth(currentWidth, true);
        };

        handle.addEventListener('pointerdown', (event) => {
            if (window.innerWidth <= 900) return;
            isResizing = true;
            startX = event.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            document.body.classList.add('sidebar-resizing');
            handle.setPointerCapture?.(event.pointerId);
        });

        window.addEventListener('pointermove', (event) => {
            if (!isResizing) return;
            const nextWidth = startWidth + (event.clientX - startX);
            applyWidth(nextWidth);
        });

        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 900) {
                document.documentElement.style.removeProperty('--sidebar-width');
                return;
            }
            const width = Number(window.localStorage.getItem(this.sidebarWidthKey) || this.defaultSidebarWidth);
            applyWidth(width);
        });

        handle.addEventListener('dblclick', () => {
            applyWidth(this.defaultSidebarWidth, true);
        });

        handle.addEventListener('keydown', (event) => {
            if (window.innerWidth <= 900) return;
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                applyWidth(sidebar.getBoundingClientRect().width - 16, true);
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                applyWidth(sidebar.getBoundingClientRect().width + 16, true);
            }
            if (event.key === 'Home') {
                event.preventDefault();
                applyWidth(this.minSidebarWidth, true);
            }
            if (event.key === 'End') {
                event.preventDefault();
                applyWidth(this.maxSidebarWidth, true);
            }
        });
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
            document.getElementById('attach-input')?.click();
        });
        document.getElementById('attach-input')?.addEventListener('change', (event) => {
            Chat.handleAttachFiles(event.target.files).finally(() => {
                event.target.value = '';
            });
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
                const toneRetranslateVisible = !document.getElementById('tone-retranslate-modal')?.classList.contains('hidden');
                document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => {
                    m.classList.add('hidden');
                });
                if (toneRetranslateVisible) {
                    Chat.closeToneRetranslateModal();
                }
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
    App.init().catch((error) => {
        console.error(error);
        Toast.show(`初期化エラー: ${error.message}`, 'error');
    });
});
