/**
 * translator.js - 翻訳ロジック（辞書適用・言語判定・トーン管理）
 * MultiTranslate
 */

const Translator = {
    /**
     * 受信メッセージを翻訳してストレージに保存する
     */
    async translateReceived({ text, threadId, channel, subject, detectedLang }) {
        const thread = Storage.getThreads().find(t => t.id === threadId);
        if (!thread) throw new Error('スレッドが見つかりません');

        // 辞書の結合（スレッド辞書 → 会社共通辞書）
        const dictionary = [
            ...Storage.getDictThread(threadId),
            ...Storage.getDictCompany(),
        ];

        // 言語が未指定なら自動判定
        let sourceLang = thread.lang !== 'auto' ? thread.lang : (detectedLang || 'auto');
        let actualDetectedLang = sourceLang;
        if (sourceLang === 'auto') {
            actualDetectedLang = await AIGateway.detectLanguage(text);
        }

        // 翻訳実行
        const result = await AIGateway.translate({
            text,
            targetLang: 'ja',
            sourceLang: actualDetectedLang,
            tone: thread.tone || 'auto',
            context: this._getContextMessages(threadId),
            dictionary,
            direction: 'receive',
        });

        // メッセージを保存
        const message = {
            id: generateId('m'),
            threadId,
            direction: 'received',
            channel: channel || 'chat',
            subject: subject || null,
            originalText: text,
            translatedText: result.translatedText,
            detectedLang: result.detectedLang || actualDetectedLang,
            status: 'received',
            createdAt: new Date().toISOString(),
        };
        Storage.saveMessage(message);

        // スレッドの言語を更新（自動判定の場合）
        if (thread.lang === 'auto' && result.detectedLang) {
            Storage.saveThread({ ...thread, lang: result.detectedLang });
        }

        return message;
    },

    /**
     * 送信メッセージを翻訳する（プレビュー・保存）
     */
    async translateSend({ text, threadId, tone }) {
        const thread = Storage.getThreads().find(t => t.id === threadId);
        if (!thread) throw new Error('スレッドが見つかりません');

        const targetLang = thread.lang === 'auto' ? 'en' : thread.lang;
        const useTone = tone || thread.tone || 'auto';

        // 辞書の結合
        const dictionary = [
            ...Storage.getDictThread(threadId),
            ...Storage.getDictCompany(),
        ];

        // 翻訳実行
        const result = await AIGateway.translate({
            text,
            targetLang,
            sourceLang: 'ja',
            tone: useTone,
            context: this._getContextMessages(threadId),
            dictionary,
            direction: 'send',
        });

        return {
            originalText: text,
            translatedText: result.translatedText,
            targetLang,
            tone: useTone,
        };
    },

    /**
     * 送信メッセージを確定してストレージに保存する
     */
    async sendMessage({ text, translatedText, threadId, tone, channel, subject, signatureBody }) {
        const thread = Storage.getThreads().find(t => t.id === threadId);
        if (!thread) throw new Error('スレッドが見つかりません');

        // 署名がある場合は末尾に追加
        let finalTranslated = translatedText;
        if (signatureBody) {
            finalTranslated = `${translatedText}\n\n${signatureBody}`;
        }

        const message = {
            id: generateId('m'),
            threadId,
            direction: 'sent',
            channel: channel || 'chat',
            subject: subject || null,
            originalText: text,
            translatedText: finalTranslated,
            detectedLang: thread.lang || 'en',
            tone: tone || thread.tone || 'auto',
            status: 'sent',
            createdAt: new Date().toISOString(),
        };
        Storage.saveMessage(message);
        return message;
    },

    /**
     * 既存メッセージを再翻訳する
     */
    async retranslate({ messageId, newJaText, tone, instruction }) {
        const allMessages = JSON.parse(localStorage.getItem('mt_messages') || '[]');
        const msg = allMessages.find(m => m.id === messageId);
        if (!msg) throw new Error('メッセージが見つかりません');

        const thread = Storage.getThreads().find(t => t.id === msg.threadId);
        if (!thread) throw new Error('スレッドが見つかりません');

        const targetLang = thread.lang === 'auto' ? 'en' : thread.lang;

        const dictionary = [
            ...Storage.getDictThread(msg.threadId),
            ...Storage.getDictCompany(),
        ];

        // 改善指示がある場合は指示として含める
        let textToTranslate = newJaText || msg.originalText;
        let extraInstruction = instruction ? `\n\n改善指示: ${instruction}` : '';

        const result = await AIGateway.translate({
            text: textToTranslate + extraInstruction,
            targetLang,
            sourceLang: 'ja',
            tone: tone || msg.tone || thread.tone || 'auto',
            context: this._getContextMessages(msg.threadId),
            dictionary,
            direction: 'send',
        });

        // 既存メッセージを上書き更新
        const updated = Storage.updateMessage(messageId, {
            originalText: textToTranslate,
            translatedText: result.translatedText,
            tone: tone || msg.tone || thread.tone || 'auto',
        });

        return updated;
    },

    /**
     * コンテキスト用メッセージ（直近10件）を取得
     */
    _getContextMessages(threadId) {
        const messages = Storage.getMessages(threadId).slice(-10);
        return messages.map(m =>
            `[${m.direction === 'received' ? '受信' : '送信'}] ${m.originalText.slice(0, 200)}`
        );
    },

    /**
     * スレッドの言語を変更する
     */
    updateThreadLang(threadId, lang) {
        const thread = Storage.getThreads().find(t => t.id === threadId);
        if (thread) {
            Storage.saveThread({ ...thread, lang });
        }
    },

    /**
     * スレッドのトーンを変更する
     */
    updateThreadTone(threadId, tone) {
        const thread = Storage.getThreads().find(t => t.id === threadId);
        if (thread) {
            Storage.saveThread({ ...thread, tone });
        }
    },
};
