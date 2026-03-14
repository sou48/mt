/**
 * chat.js - チャットUIレンダリングとメッセージ管理
 * MultiTranslate
 */

const Chat = {
    currentThreadId: null,
    currentCompanyId: null,
    pendingTranslation: null, // 翻訳プレビュー中データ
    pendingAttachments: [],

    // スレッドを読み込んで表示
    async loadThread(threadId) {
        const thread = Storage.getThreadById(threadId);
        if (!thread) return;

        const companies = Storage.getCompanies();
        const company = companies.find(c => c.id === thread.companyId);

        this.currentThreadId = threadId;
        this.currentCompanyId = thread.companyId;
        this.pendingTranslation = null;
        this.pendingAttachments = [];

        // UIの表示切替
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('chat-panel').classList.remove('hidden');

        // ヘッダー更新
        document.getElementById('header-company-name').textContent = company?.name || '';
        document.getElementById('header-thread-name').textContent = thread.name;

        // 言語・トーンセレクタ更新
        const langSel = document.getElementById('lang-selector');
        const toneSel = document.getElementById('tone-selector');
        if (langSel) langSel.value = thread.lang || 'auto';
        if (toneSel) toneSel.value = thread.tone || 'auto';

        await Storage.loadCompanyDictionary(thread.companyId);
        await Storage.loadMessages(threadId);
        this.renderMessages(threadId);

        // 送信欄クリア
        document.getElementById('send-input').value = '';
        this._renderPendingAttachments();
        this._hideSendPreview();

        // 受信入力を閉じる
        this.closeReceiveInput();
    },

    renderMessages(threadId) {
        const messages = Storage.getMessages(threadId);
        const container = document.getElementById('message-area');
        if (!container) return;

        if (messages.length === 0) {
            Dom.setMarkup(container, `
        <div class="empty-state" style="padding:40px 0; background:none;">
          <div class="empty-icon" style="font-size:40px;">💬</div>
          <p style="color:var(--text-muted); font-size:13px;">まだメッセージがありません。<br/>受信メッセージを取り込むか、メッセージを送信してください。</p>
        </div>
      `);
            return;
        }

        // 日付でグループ化
        let lastDate = '';
        Dom.setMarkup(container, messages.map(msg => {
            const msgDate = new Date(msg.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
            let dateSep = '';
            if (msgDate !== lastDate) {
                dateSep = `<div class="date-separator">${msgDate}</div>`;
                lastDate = msgDate;
            }
            return dateSep + this._renderMessage(msg);
        }).join(''));

        // 最下部にスクロール
        container.scrollTop = container.scrollHeight;

        // メッセージのイベント設定
        this._bindMessageEvents();
    },

    _renderMessage(msg) {
        const isReceived = msg.direction === 'received';
        const timeStr = formatTime(msg.createdAt);
        const channelLabel = msg.channel === 'mail' ? '📧 メール' : '💬 チャット';

        const subjectHtml = (msg.channel === 'mail' && msg.subject)
            ? `<div class="msg-mail-subject">件名：${this._esc(msg.subject)}</div>`
            : '';

        const statusHtml = msg.status === 'sent'
            ? `<span class="msg-status-badge">✓ 送信済</span>`
            : msg.status === 'draft'
                ? `<span class="msg-status-badge draft">下書き</span>`
                : '';

        const attachmentsHtml = Array.isArray(msg.attachments) && msg.attachments.length > 0
            ? `<div class="msg-attachments">${msg.attachments.map((attachment) => `
                <a class="msg-attachment-link" href="/api/attachments/${attachment.id}/download" target="_blank" rel="noreferrer">${this._esc(attachment.originalName)}</a>
              `).join('')}</div>`
            : '';

        const thread = Storage.getThreadById(msg.threadId);
        const actionsHtml = isReceived
            ? `<div class="msg-actions">
           <button class="msg-action-btn" data-action="copy-translation" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
             翻訳をコピー
           </button>
           <button class="msg-action-btn" data-action="copy-original" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
             原文をコピー
           </button>
           ${thread?.isUnclassified ? `<button class="msg-action-btn" data-action="reclassify-message" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h7"/><path d="M14 7h7"/><path d="M10 7l4 4-4 4"/></svg>
             正式案件へ振り替え
           </button>` : ''}
         </div>`
            : `<div class="msg-actions">
           <button class="msg-action-btn primary" data-action="edit-retranslate" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
             日本語を編集・再翻訳
           </button>
           <button class="msg-action-btn" data-action="retranslate-tone" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>
             トーン変更・再翻訳
           </button>
           <button class="msg-action-btn" data-action="copy-translation" data-msg-id="${msg.id}">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
             翻訳をコピー
           </button>
         </div>`;

        return `
    <div class="message-group ${isReceived ? 'received' : 'sent'}" data-msg-id="${msg.id}">
      <div class="bubble-wrap">
        <span class="msg-channel-badge">${channelLabel}</span>
        ${subjectHtml}
        <div class="msg-original" id="original-${msg.id}">${this._esc(msg.originalText)}</div>
        <hr class="msg-divider" />
        <div class="msg-translation" id="translation-${msg.id}">${this._esc(msg.translatedText)}</div>
        ${attachmentsHtml}
        <div class="msg-meta">
          <span>${timeStr}</span>
          ${statusHtml}
        </div>
      </div>
      ${actionsHtml}
    </div>`;
    },

    // ===== 受信メッセージ入力 =====

    openReceiveInput() {
        document.getElementById('receive-input-area').classList.remove('hidden');
        document.getElementById('receive-text').focus();
    },

    closeReceiveInput() {
        const area = document.getElementById('receive-input-area');
        if (area) area.classList.add('hidden');
        const txt = document.getElementById('receive-text');
        if (txt) txt.value = '';
        const subjectRow = document.getElementById('mail-subject-row');
        if (subjectRow) subjectRow.classList.add('hidden');
    },

    async handleTranslateReceive() {
        const text = document.getElementById('receive-text')?.value?.trim();
        if (!text) {
            Toast.show('メッセージを入力してください', 'error');
            return;
        }
        if (!this.currentThreadId) {
            Toast.show('スレッドを選択してください', 'error');
            return;
        }

        const channel = document.getElementById('receive-channel')?.value || 'chat';
        const subject = document.getElementById('mail-subject')?.value?.trim() || null;

        // ローディングメッセージ仮表示
        this._appendLoadingBubble('received');

        try {
            const msg = await Translator.translateReceived({
                text,
                threadId: this.currentThreadId,
                channel,
                subject,
            });

            this.closeReceiveInput();
            this.renderMessages(this.currentThreadId);
            Toast.show('メッセージを翻訳しました', 'success');
        } catch (err) {
            console.error(err);
            this._removeLoadingBubble();
            Toast.show(`翻訳エラー: ${err.message}`, 'error');
        }
    },

    // ===== 送信メッセージ =====

    async handleTranslateSend() {
        const text = document.getElementById('send-input')?.value?.trim();
        if (!text) {
            Toast.show('メッセージを入力してください', 'error');
            return;
        }
        if (!this.currentThreadId) {
            Toast.show('スレッドを選択してください', 'error');
            return;
        }

        const tone = document.getElementById('tone-selector')?.value || 'auto';
        const btn = document.getElementById('btn-translate-send');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '翻訳中...';
        }

        try {
            const result = await Translator.translateSend({
                text,
                threadId: this.currentThreadId,
                tone,
            });

            this.pendingTranslation = result;
            this._showSendPreview(result);
            Toast.show('翻訳完了。内容を確認して送信してください', 'info');
        } catch (err) {
            console.error(err);
            Toast.show(`翻訳エラー: ${err.message}`, 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                Dom.setMarkup(btn, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg> 翻訳`);
            }
        }
    },

    async handleSend() {
        if (!this.pendingTranslation) {
            // まず翻訳してから送信
            await this.handleTranslateSend();
            if (!this.pendingTranslation) return;
        }

        if (!this.currentThreadId) return;

        try {
            const msg = await Translator.sendMessage({
                text: this.pendingTranslation.originalText,
                translatedText: this.pendingTranslation.translatedText,
                threadId: this.currentThreadId,
                tone: this.pendingTranslation.tone,
                signatureBody: null,
            });

            if (this.pendingAttachments.length > 0) {
                for (const attachment of this.pendingAttachments) {
                    await Storage.uploadAttachment(msg.id, attachment);
                }
                await Storage.loadMessages(this.currentThreadId);
            }

            document.getElementById('send-input').value = '';
            this.pendingTranslation = null;
            this.pendingAttachments = [];
            this._renderPendingAttachments();
            this._hideSendPreview();
            this.renderMessages(this.currentThreadId);
            Toast.show('送信しました', 'success');
        } catch (err) {
            console.error(err);
            Toast.show(`送信エラー: ${err.message}`, 'error');
        }
    },

    _showSendPreview(result) {
        // 既存のプレビューを削除
        this._hideSendPreview();

        // モック翻訳かどうか確認
        const settings = Storage.getSettings();
        const isMock = settings.aiProvider === 'mock' || !settings[`${settings.aiProvider}Key`];

        const mockBadge = isMock
            ? `<div style="margin-bottom:8px; display:inline-flex; align-items:center; gap:6px; background:rgba(255,179,0,0.15); border:1px solid rgba(255,179,0,0.4); border-radius:999px; padding:3px 10px; font-size:11px; color:#FFB300; font-weight:600;">
                ⚠ モック翻訳（APIキー未設定）
                <span style="font-weight:400; color:rgba(255,179,0,0.75);">設定からAPIキーを入力すると実際の翻訳が有効になります</span>
               </div>`
            : '';

        const preview = document.createElement('div');
        preview.id = 'send-preview';
        preview.style.cssText = `
      background: rgba(108,99,255,0.1);
      border: 1px solid rgba(108,99,255,0.3);
      border-radius: 12px;
      padding: 12px 16px;
      margin: 0 20px 8px;
      animation: slideUp 0.2s ease;
      max-height: 220px;
      overflow-y: auto;
    `;
        Dom.setMarkup(preview, `
      <div style="font-size:11px; color:var(--primary-400); margin-bottom:6px; font-weight:600;">🌐 翻訳プレビュー（${getLangLabel(result.targetLang)}）</div>
      ${mockBadge}
      <div style="font-size:13.5px; color:var(--text-primary); white-space:pre-wrap; line-height:1.6;">${this._esc(result.translatedText)}</div>
      <div style="margin-top:10px; display:flex; gap:6px; position:sticky; bottom:0; background:rgba(13,17,23,0.8); padding:4px 0;">
        <button id="btn-confirm-send" style="background:linear-gradient(135deg,#5B52F0,#6C63FF); color:#fff; border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer;">✓ この内容で送信</button>
        <button id="btn-cancel-preview" style="background:var(--bg-glass); border:1px solid var(--border-default); border-radius:8px; padding:6px 12px; font-size:12px; color:var(--text-secondary); cursor:pointer;">キャンセル</button>
      </div>
    `);

        const footer = document.querySelector('.chat-footer');
        footer?.parentNode?.insertBefore(preview, footer);

        document.getElementById('btn-confirm-send')?.addEventListener('click', () => this.handleSend());
        document.getElementById('btn-cancel-preview')?.addEventListener('click', () => {
            this.pendingTranslation = null;
            this._hideSendPreview();
        });
    },

    _hideSendPreview() {
        document.getElementById('send-preview')?.remove();
    },

    // ===== メッセージ操作（編集・再翻訳） =====

    async handleEditRetranslate(msgId) {
        const allMessages = Object.values(Storage._cache.messagesByThread).flat();
        const msg = allMessages.find(m => m.id === msgId);
        if (!msg) return;

        // インライン編集UIを表示
        const originalEl = document.getElementById(`original-${msgId}`);
        const translationEl = document.getElementById(`translation-${msgId}`);
        if (!originalEl || !translationEl) return;

        // 編集可能にする
        originalEl.contentEditable = 'true';
        originalEl.classList.add('editable-active');
        originalEl.focus();

        // 既存の編集ボタンを変更
        const group = document.querySelector(`[data-msg-id="${msgId}"]`);
        const editBtn = group?.querySelector('[data-action="edit-retranslate"]');
        if (editBtn) {
            Dom.setMarkup(editBtn, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 8l6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg> 再翻訳して確定`);
            editBtn.classList.add('primary');
            editBtn.dataset.action = 'confirm-retranslate';
        }
    },

    async handleConfirmRetranslate(msgId) {
        const originalEl = document.getElementById(`original-${msgId}`);
        const translationEl = document.getElementById(`translation-${msgId}`);
        if (!originalEl || !translationEl) return;

        const newText = originalEl.textContent.trim();
        if (!newText) return;

        // 編集モード解除
        originalEl.contentEditable = 'false';
        originalEl.classList.remove('editable-active');

        // 翻訳中表示
        Dom.setMarkup(translationEl, `翻訳中 <span class="translating-dots"><span></span><span></span><span></span></span>`);
        translationEl.classList.add('translating');

        const tone = document.getElementById('tone-selector')?.value || 'auto';

        try {
            const updated = await Translator.retranslate({ messageId: msgId, newJaText: newText, tone });
            if (updated) {
                translationEl.textContent = updated.translatedText;
                originalEl.textContent = updated.originalText;
            }
            translationEl.classList.remove('translating');
            Toast.show('再翻訳しました', 'success');
        } catch (err) {
            translationEl.classList.remove('translating');
            translationEl.textContent = '再翻訳に失敗しました';
            Toast.show(`再翻訳エラー: ${err.message}`, 'error');
        }

        // ボタンを元に戻す
        const group = document.querySelector(`[data-msg-id="${msgId}"]`);
        const editBtn = group?.querySelector('[data-action="confirm-retranslate"]');
        if (editBtn) {
            Dom.setMarkup(editBtn, `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 日本語を編集・再翻訳`);
            editBtn.dataset.action = 'edit-retranslate';
        }
    },

    async handleRetranslateTone(msgId) {
        const tone = prompt('翻訳トーンを選択してください:\n1: ビジネス正式 (formal)\n2: ビジネス標準 (standard)\n3: ややフレンドリー (friendly)\n番号を入力:');
        const toneMap = { '1': 'formal', '2': 'standard', '3': 'friendly' };
        const selectedTone = toneMap[tone?.trim()];
        if (!selectedTone) return;

        const translationEl = document.getElementById(`translation-${msgId}`);
        if (translationEl) {
            Dom.setMarkup(translationEl, `翻訳中 <span class="translating-dots"><span></span><span></span><span></span></span>`);
            translationEl.classList.add('translating');
        }

        try {
            const updated = await Translator.retranslate({ messageId: msgId, tone: selectedTone });
            if (updated && translationEl) {
                translationEl.textContent = updated.translatedText;
                translationEl.classList.remove('translating');
            }
            Toast.show('再翻訳しました', 'success');
        } catch (err) {
            if (translationEl) {
                translationEl.classList.remove('translating');
                translationEl.textContent = '再翻訳に失敗しました';
            }
            Toast.show(`再翻訳エラー: ${err.message}`, 'error');
        }
    },

    // ===== メッセージイベント =====

    _bindMessageEvents() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.dataset.action;
                const msgId = btn.dataset.msgId;

                switch (action) {
                    case 'copy-translation': {
                        const el = document.getElementById(`translation-${msgId}`);
                        if (el) {
                            navigator.clipboard.writeText(el.textContent).then(() => Toast.show('翻訳をコピーしました', 'success'));
                        }
                        break;
                    }
                    case 'copy-original': {
                        const el = document.getElementById(`original-${msgId}`);
                        if (el) {
                            navigator.clipboard.writeText(el.textContent).then(() => Toast.show('原文をコピーしました', 'success'));
                        }
                        break;
                    }
                    case 'edit-retranslate':
                        await this.handleEditRetranslate(msgId);
                        break;
                    case 'confirm-retranslate':
                        await this.handleConfirmRetranslate(msgId);
                        break;
                    case 'retranslate-tone':
                        await this.handleRetranslateTone(msgId);
                        break;
                    case 'reclassify-message':
                        await this.handleReclassifyMessage(msgId);
                        break;
                }
            });
        });
    },

    async handleReclassifyMessage(msgId) {
        const candidateThreads = Storage.getThreads(this.currentCompanyId).filter(
            (thread) => thread.id !== this.currentThreadId && !thread.isUnclassified
        );
        if (candidateThreads.length === 0) {
            Toast.show('振り替え先の正式案件がありません', 'error');
            return;
        }

        const label = candidateThreads.map((thread, index) => `${index + 1}: ${thread.name}`).join('\n');
        const answer = prompt(`振り替え先の案件番号を入力してください:\n${label}`);
        const selected = candidateThreads[Number(answer) - 1];
        if (!selected) {
            return;
        }

        try {
            await Storage.moveMessage(msgId, selected.id);
            await Storage.loadMessages(this.currentThreadId);
            Toast.show(`「${selected.name}」へ振り替えました`, 'success');
            this.renderMessages(this.currentThreadId);
        } catch (error) {
            Toast.show(`振り替えエラー: ${error.message}`, 'error');
        }
    },

    // ===== 言語・トーン変更 =====

    async handleLangChange(lang) {
        if (!this.currentThreadId) return;
        await Translator.updateThreadLang(this.currentThreadId, lang);
        Toast.show(`相手言語を「${getLangLabel(lang)}」に変更しました`, 'info');
    },

    async handleToneChange(tone) {
        if (!this.currentThreadId) return;
        await Translator.updateThreadTone(this.currentThreadId, tone);
        const labels = { auto: 'AI自動', formal: 'ビジネス正式', standard: 'ビジネス標準', friendly: 'ややフレンドリー' };
        Toast.show(`翻訳トーンを「${labels[tone] || tone}」に変更しました`, 'info');
    },

    // ===== ヘルパー =====

    _appendLoadingBubble(direction) {
        const container = document.getElementById('message-area');
        if (!container) return;
        const div = document.createElement('div');
        div.id = 'loading-bubble';
        div.className = `message-group ${direction}`;
        Dom.setMarkup(div, `
      <div class="bubble-wrap">
        <div class="msg-translation translating">
          翻訳中 <span class="translating-dots"><span></span><span></span><span></span></span>
        </div>
      </div>
    `);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    },

    _removeLoadingBubble() {
        document.getElementById('loading-bubble')?.remove();
    },

    async handleAttachFiles(files) {
        const list = Array.from(files || []);
        this.pendingAttachments = await Promise.all(
            list.map(async (file) => ({
                originalName: file.name,
                mimeType: file.type || 'application/octet-stream',
                contentBase64: await this._fileToBase64(file),
            }))
        );
        this._renderPendingAttachments();
        Toast.show(`${this.pendingAttachments.length} 件の添付を準備しました`, 'info');
    },

    _renderPendingAttachments() {
        const container = document.getElementById('pending-attachments');
        if (!container) return;
        if (this.pendingAttachments.length === 0) {
            Dom.clear(container);
            return;
        }

        Dom.setMarkup(container, this.pendingAttachments
            .map(
                (attachment, index) => `<div class="sig-item" style="margin:4px 0;">
                <div class="sig-item-header">
                  <span class="sig-item-name">${this._esc(attachment.originalName)}</span>
                  <button class="btn-icon-sm" data-remove-pending-attachment="${index}" title="削除">×</button>
                </div>
              </div>`
            )
            .join(''));

        container.querySelectorAll('[data-remove-pending-attachment]').forEach((button) => {
            button.addEventListener('click', () => {
                this.pendingAttachments.splice(Number(button.dataset.removePendingAttachment), 1);
                this._renderPendingAttachments();
            });
        });
    },

    _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    _esc(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br/>');
    },
};
