/**
 * modals.js - モーダル・サイドパネル管理
 * MultiTranslate
 */

const Modals = {
    init() {
        this._bindCloseButtons();
        this._bindOverlayClicks();
        this._bindSettingsTabs();
        this._bindDictTabs();
        this._bindReceiveChannelChange();
    },

    // ===== 新規会社モーダル =====

    openNewCompany() {
        document.getElementById('new-company-name').value = '';
        document.getElementById('new-company-thread').value = '';
        document.getElementById('new-company-lang').value = 'auto';
        this._show('new-company-modal');
    },

    async handleCreateCompany() {
        const name = document.getElementById('new-company-name')?.value?.trim();
        if (!name) {
            Toast.show('会社名を入力してください', 'error');
            return;
        }

        const threadName = document.getElementById('new-company-thread')?.value?.trim() || '案件1';
        try {
            const { company, warnings } = await Sidebar.addCompany({ name });
            const { thread, warnings: projectWarnings } = await Sidebar.addThread({
                companyId: company.id,
                name: threadName,
            });

            this._hide('new-company-modal');
            await Sidebar.selectThread(thread.id, company.id);
            this._showWarnings([...(warnings || []), ...(projectWarnings || [])]);
            Toast.show(`「${name}」を追加しました`, 'success');
        } catch (error) {
            Toast.show(`会社作成エラー: ${error.message}`, 'error');
        }
    },

    // ===== 新規案件モーダル =====

    _newThreadCompanyId: null,

    openNewThread(companyId) {
        this._newThreadCompanyId = companyId;
        document.getElementById('new-thread-name').value = '';
        this._show('new-thread-modal');
    },

    async handleCreateThread() {
        const name = document.getElementById('new-thread-name')?.value?.trim();
        if (!name) {
            Toast.show('案件名を入力してください', 'error');
            return;
        }

        const companyId = this._newThreadCompanyId;
        if (!companyId) return;

        try {
            const { warnings } = await Sidebar.addThread({
                companyId,
                name,
            });
            this._hide('new-thread-modal');
            this._showWarnings(warnings || []);
            Toast.show(`「${name}」を追加しました`, 'success');
        } catch (error) {
            Toast.show(`案件作成エラー: ${error.message}`, 'error');
        }
    },

    // ===== AI支援パネル =====

    openAiPanel() {
        document.getElementById('ai-panel')?.classList.remove('hidden');
        document.getElementById('ai-draft-output')?.classList.add('hidden');
        document.getElementById('ai-instruction').value = '';
    },

    closeAiPanel() {
        document.getElementById('ai-panel')?.classList.add('hidden');
    },

    async handleGenerateDraft() {
        if (!Chat.currentThreadId) {
            Toast.show('スレッドを選択してください', 'error');
            return;
        }

        const instruction = document.getElementById('ai-instruction')?.value?.trim();
        const btn = document.getElementById('btn-generate-draft');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '生成中...';
        }

        const messageHistory = Storage.getMessages(Chat.currentThreadId);
        const thread = Storage.getThreadById(Chat.currentThreadId);

        try {
            const result = await AIGateway.generateDraft({
                instruction,
                messageHistory,
                targetLang: thread?.lang || 'en',
                tone: thread?.tone || 'auto',
            });

            document.getElementById('ai-draft-text').textContent = result.draftJa;
            document.getElementById('ai-draft-output')?.classList.remove('hidden');
            Toast.show('下書きを生成しました', 'success');
        } catch (err) {
            Toast.show(`生成エラー: ${err.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                Dom.setMarkup(btn, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> 下書きを生成`);
            }
        }
    },

    handleUseDraft() {
        const draft = document.getElementById('ai-draft-text')?.textContent;
        if (!draft) return;
        const input = document.getElementById('send-input');
        if (input) {
            input.value = draft;
            input.focus();
        }
        this.closeAiPanel();
        Toast.show('入力欄に挿入しました', 'success');
    },

    // ===== 設定モーダル =====

    openSettings() {
        const settings = Storage.getSettings();
        document.getElementById('ai-provider').value = settings.aiProvider || 'mock';
        document.getElementById('openai-api-key').value = ''; // セキュリティのためクリア
        document.getElementById('gemini-api-key').value = '';
        document.getElementById('claude-api-key').value = '';
        document.getElementById('user-name').value = settings.userName || '';
        document.getElementById('default-tone').value = settings.defaultTone || 'auto';
        document.getElementById('theme-mode').value = settings.themeMode || 'dark';
        this._renderSignatureList();
        this._show('settings-modal');
        this._updateApiKeyVisibility(settings.aiProvider || 'mock');
    },

    handleSaveSettings() {
        const provider = document.getElementById('ai-provider')?.value;
        const openaiKey = document.getElementById('openai-api-key')?.value?.trim();
        const geminiKey = document.getElementById('gemini-api-key')?.value?.trim();
        const claudeKey = document.getElementById('claude-api-key')?.value?.trim();
        const userName = document.getElementById('user-name')?.value?.trim();
        const defaultTone = document.getElementById('default-tone')?.value;
        const themeMode = document.getElementById('theme-mode')?.value;

        const updated = {
            aiProvider: provider,
            userName: userName || '',
            defaultTone: defaultTone || 'auto',
            themeMode: themeMode || 'dark',
        };
        if (openaiKey) updated.openaiKey = openaiKey;
        if (geminiKey) updated.geminiKey = geminiKey;
        if (claudeKey) updated.claudeKey = claudeKey;

        Storage.saveSettings(updated)
            .then(() => {
                Settings.applyTheme(Storage.getSettings().themeMode || 'dark');
                this._hide('settings-modal');
                Toast.show('設定を保存しました', 'success');
            })
            .catch((error) => {
                Toast.show(`設定保存エラー: ${error.message}`, 'error');
            });
    },

    async _renderSignatureList() {
        const sigs = await Storage.reloadSignatures();
        const container = document.getElementById('signature-list');
        if (!container) return;
        Dom.setMarkup(container, sigs.map(sig => `
      <div class="sig-item">
        <div class="sig-item-header">
          <span class="sig-item-name">${this._esc(sig.name)}</span>
          <button class="btn-icon-sm" data-delete-sig="${sig.id}" title="削除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
        <div class="sig-item-body">${this._esc(sig.body)}</div>
      </div>
    `).join(''));

        container.querySelectorAll('[data-delete-sig]').forEach(btn => {
            btn.addEventListener('click', () => {
                Storage.deleteSignature(btn.dataset.deleteSig)
                    .then(() => {
                        this._renderSignatureList();
                        Toast.show('署名を削除しました', 'info');
                    })
                    .catch((error) => Toast.show(`署名削除エラー: ${error.message}`, 'error'));
            });
        });
    },

    async handleAddSignature() {
        const name = prompt('署名のテンプレート名を入力してください:');
        if (!name) return;
        const japaneseText = prompt('日本語署名本文を入力してください:');
        if (!japaneseText) return;
        const partnerText = prompt('相手言語署名があれば入力してください（任意）:') || null;
        try {
            await Storage.saveSignature({ name, japaneseText, partnerText });
            await this._renderSignatureList();
            Toast.show('署名を追加しました', 'success');
        } catch (error) {
            Toast.show(`署名追加エラー: ${error.message}`, 'error');
        }
    },

    // ===== 翻訳辞書モーダル =====

    async openDictionary() {
        await this._renderCompanyDict();
        await this._renderThreadDict();
        this._show('dictionary-modal');
    },

    async _renderCompanyDict() {
        if (!Chat.currentCompanyId) {
            return;
        }
        const entries = await Storage.loadCompanyDictionary(Chat.currentCompanyId);
        const container = document.getElementById('company-dict-list');
        if (!container) return;
        Dom.setMarkup(container, entries.length === 0
            ? '<p style="font-size:12px;color:var(--text-muted);">エントリがありません</p>'
            : entries.map(e => `
          <div class="dict-entry">
            <span class="dict-entry-ja">${this._esc(e.ja)}</span>
            <span class="dict-arrow">→</span>
            <span class="dict-entry-trans">${this._esc(e.translated)}</span>
            <button class="btn-icon-sm" data-delete-dict="${e.id}" title="削除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join(''));

        container.querySelectorAll('[data-delete-dict]').forEach(btn => {
            btn.addEventListener('click', () => {
                Storage.removeCompanyDictionaryEntry(Chat.currentCompanyId, btn.dataset.deleteDict)
                    .then(() => this._renderCompanyDict())
                    .catch((error) => Toast.show(`辞書削除エラー: ${error.message}`, 'error'));
            });
        });
    },

    async _renderThreadDict() {
        const container = document.getElementById('thread-dict-list');
        if (!container) return;
        if (!Chat.currentCompanyId) {
            Dom.setMarkup(container, '<p style="font-size:12px;color:var(--text-muted);">会社を選択してください</p>');
            return;
        }
        const entries = await Storage.loadSystemDictionary();
        Dom.setMarkup(container, entries.length === 0
            ? '<p style="font-size:12px;color:var(--text-muted);">エントリがありません</p>'
            : entries.map(e => `
          <div class="dict-entry">
            <span class="dict-entry-ja">${this._esc(e.ja)}</span>
            <span class="dict-arrow">→</span>
            <span class="dict-entry-trans">${this._esc(e.translated)}</span>
            <button class="btn-icon-sm" data-delete-thread-dict="${e.id}" title="削除">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `).join(''));

        container.querySelectorAll('[data-delete-thread-dict]').forEach(btn => {
            btn.addEventListener('click', () => {
                Storage.removeSystemDictionaryEntry(btn.dataset.deleteThreadDict)
                    .then(() => this._renderThreadDict())
                    .catch((error) => Toast.show(`辞書削除エラー: ${error.message}`, 'error'));
            });
        });
    },

    async handleAddDictEntry() {
        if (!Chat.currentCompanyId) {
            Toast.show('会社を選択してください', 'error');
            return;
        }
        const ja = document.getElementById('dict-ja-word')?.value?.trim();
        const translated = document.getElementById('dict-trans-word')?.value?.trim();
        if (!ja || !translated) {
            Toast.show('両方の欄を入力してください', 'error');
            return;
        }
        try {
            await Storage.addCompanyDictionaryEntry(Chat.currentCompanyId, { ja, translated });
            document.getElementById('dict-ja-word').value = '';
            document.getElementById('dict-trans-word').value = '';
            await this._renderCompanyDict();
            Toast.show('辞書エントリを追加しました', 'success');
        } catch (error) {
            Toast.show(`辞書追加エラー: ${error.message}`, 'error');
        }
    },

    async handleAddThreadDictEntry() {
        if (!Chat.currentCompanyId) {
            Toast.show('会社を選択してください', 'error');
            return;
        }
        const ja = document.getElementById('dict-thread-ja')?.value?.trim();
        const translated = document.getElementById('dict-thread-trans')?.value?.trim();
        if (!ja || !translated) {
            Toast.show('両方の欄を入力してください', 'error');
            return;
        }
        try {
            await Storage.addSystemDictionaryEntry({ ja, translated });
            document.getElementById('dict-thread-ja').value = '';
            document.getElementById('dict-thread-trans').value = '';
            await this._renderThreadDict();
            Toast.show('システム辞書エントリを追加しました', 'success');
        } catch (error) {
            Toast.show(`辞書追加エラー: ${error.message}`, 'error');
        }
    },

    // ===== 署名選択モーダル =====

    openSignatureSelect() {
        const sigs = Storage.getSignatures();
        const container = document.getElementById('sig-select-list');
        if (!container) return;

        Dom.setMarkup(container, sigs.map(sig => `
      <div class="sig-select-item" data-sig-id="${sig.id}">
        <div class="sig-select-name">${this._esc(sig.name)}</div>
        <div class="sig-select-preview">${this._esc(sig.body)}</div>
      </div>
    `).join(''));

        container.querySelectorAll('.sig-select-item').forEach(item => {
            item.addEventListener('click', () => {
                const sig = sigs.find(s => s.id === item.dataset.sigId);
                if (sig) {
                    const input = document.getElementById('send-input');
                    if (input) {
                        input.value = (input.value ? input.value + '\n\n' : '') + (sig.japaneseText || sig.body);
                    }
                    Storage.saveProjectPreference(Chat.currentThreadId, { signatureId: sig.id });
                    this._hide('signature-select-modal');
                    Toast.show(`署名「${sig.name}」を挿入しました`, 'success');
                }
            });
        });

        this._show('signature-select-modal');
    },

    // ===== 共通ユーティリティ =====

    _show(id) {
        document.getElementById(id)?.classList.remove('hidden');
    },

    _hide(id) {
        document.getElementById(id)?.classList.add('hidden');
    },

    _bindCloseButtons() {
        const closePairs = [
            ['btn-close-settings', 'settings-modal'],
            ['btn-cancel-settings', 'settings-modal'],
            ['btn-close-new-company', 'new-company-modal'],
            ['btn-cancel-company', 'new-company-modal'],
            ['btn-close-new-thread', 'new-thread-modal'],
            ['btn-cancel-thread', 'new-thread-modal'],
            ['btn-close-dictionary', 'dictionary-modal'],
            ['btn-close-ai', null], // AI panel
            ['btn-close-sig-select', 'signature-select-modal'],
        ];

        closePairs.forEach(([btnId, modalId]) => {
            const btn = document.getElementById(btnId);
            if (!btn) return;
            btn.addEventListener('click', () => {
                if (modalId) this._hide(modalId);
                else this.closeAiPanel();
            });
        });

        // 各確定ボタン
        document.getElementById('btn-save-settings')?.addEventListener('click', () => this.handleSaveSettings());
        document.getElementById('btn-create-company')?.addEventListener('click', () => this.handleCreateCompany());
        document.getElementById('btn-create-thread')?.addEventListener('click', () => this.handleCreateThread());
        document.getElementById('btn-add-signature')?.addEventListener('click', () => this.handleAddSignature());
        document.getElementById('btn-add-dict-entry')?.addEventListener('click', () => this.handleAddDictEntry());
        document.getElementById('btn-add-thread-dict')?.addEventListener('click', () => this.handleAddThreadDictEntry());
        document.getElementById('btn-generate-draft')?.addEventListener('click', () => this.handleGenerateDraft());
        document.getElementById('btn-use-draft')?.addEventListener('click', () => this.handleUseDraft());
        document.getElementById('btn-regen-draft')?.addEventListener('click', () => this.handleGenerateDraft());
    },

    _bindOverlayClicks() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });
    },

    _bindSettingsTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('#settings-modal .tab-content').forEach(c => {
                    c.classList.toggle('active', c.id === `tab-${tabId}`);
                    c.classList.toggle('hidden', c.id !== `tab-${tabId}`);
                });
            });
        });

        // APIプロバイダ変更時にキー欄を切替
        document.getElementById('ai-provider')?.addEventListener('change', (e) => {
            this._updateApiKeyVisibility(e.target.value);
        });
    },

    _updateApiKeyVisibility(provider) {
        const groups = { openai: 'openai-key-group', gemini: 'gemini-key-group', claude: 'claude-key-group' };
        Object.entries(groups).forEach(([p, id]) => {
            const el = document.getElementById(id);
            if (el) el.style.display = provider === p ? '' : 'none';
        });
    },

    _bindDictTabs() {
        document.querySelectorAll('.dict-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.dataset.dictTab;
                document.querySelectorAll('.dict-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('#dictionary-modal .tab-content').forEach(c => {
                    const isActive = c.id === `dict-tab-${tabId}`;
                    c.classList.toggle('active', isActive);
                    c.classList.toggle('hidden', !isActive);
                });
            });
        });
    },

    _bindReceiveChannelChange() {
        document.getElementById('receive-channel')?.addEventListener('change', (e) => {
            const subjectRow = document.getElementById('mail-subject-row');
            if (subjectRow) {
                subjectRow.classList.toggle('hidden', e.target.value !== 'mail');
            }
        });
    },

    _esc(str) {
        return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _showWarnings(warnings) {
        warnings.forEach((warning) => {
            Toast.show(warning.message, 'info', 5000);
        });
    },
};
