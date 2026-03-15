/**
 * translator.js - 翻訳ロジック
 */

const Translator = {
    async translateReceived({ text, threadId, channel, subject, detectedLang }) {
        const thread = Storage.getThreadById(threadId);
        if (!thread) throw new Error('案件が見つかりません');

        const dictionary = this._getRelevantDictionary(text, thread.companyId);
        const sourceLang = thread.lang !== 'auto' ? thread.lang : (detectedLang || 'auto');

        const result = await AIGateway.translate({
            text,
            targetLang: 'ja',
            sourceLang,
            tone: thread.tone || 'auto',
            context: this._getContextMessages(threadId, text),
            dictionary,
            direction: 'receive',
        });

        const message = await Storage.saveReceivedMessage({
            projectId: threadId,
            channelType: channel === 'mail' ? 'email' : 'chat',
            subject: subject || null,
            sourceText: text,
            sourceLanguage: result.detectedLang || sourceLang,
            translatedText: result.translatedText,
            translatedLanguage: 'ja',
            japaneseText: result.translatedText,
        });

        if (thread.lang === 'auto' && result.detectedLang) {
            await Storage.saveProjectPreference(threadId, { lang: result.detectedLang });
        }

        return message;
    },

    async translateSend({ text, threadId, tone }) {
        const thread = Storage.getThreadById(threadId);
        if (!thread) throw new Error('案件が見つかりません');

        const targetLang = thread.lang === 'auto' ? 'en' : thread.lang;
        const useTone = tone || thread.tone || 'auto';
        const dictionary = this._getRelevantDictionary(text, thread.companyId);

        const result = await AIGateway.translate({
            text,
            targetLang,
            sourceLang: 'ja',
            tone: useTone,
            context: this._getContextMessages(threadId, text),
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

    async sendMessage({ text, translatedText, threadId, tone, channel, subject, signatureBody }) {
        const thread = Storage.getThreadById(threadId);
        if (!thread) throw new Error('案件が見つかりません');

        let partnerText = translatedText;
        if (signatureBody) {
            partnerText = `${translatedText}\n\n${signatureBody}`;
        }

        return Storage.saveReplyMessage({
            projectId: threadId,
            messageType: 'reply',
            channelType: channel === 'mail' ? 'email' : 'chat',
            subject: subject || null,
            japaneseText: text,
            partnerText,
            translatedText: partnerText,
            translatedLanguage: thread.lang === 'auto' ? 'en' : thread.lang,
            languagePair: `ja<>${thread.lang === 'auto' ? 'en' : thread.lang}`,
        });
    },

    async retranslate({ messageId, newJaText, tone, instruction }) {
        const allMessages = Object.values(Storage._cache.messagesByThread).flat();
        const message = allMessages.find((item) => item.id === messageId);
        if (!message) throw new Error('メッセージが見つかりません');

        const thread = Storage.getThreadById(message.threadId);
        if (!thread) throw new Error('案件が見つかりません');

        const textToTranslate = newJaText || message.originalText;
        const dictionary = this._getRelevantDictionary(textToTranslate, thread.companyId);

        const result = await AIGateway.translate({
            text: instruction ? `${textToTranslate}\n\n改善指示: ${instruction}` : textToTranslate,
            targetLang: thread.lang === 'auto' ? 'en' : thread.lang,
            sourceLang: 'ja',
            tone: tone || message.tone || thread.tone || 'auto',
            context: this._getContextMessages(message.threadId, textToTranslate),
            dictionary,
            direction: 'send',
        });

        return Storage.updateMessage(messageId, {
            japaneseText: textToTranslate,
            partnerText: result.translatedText,
            translatedText: result.translatedText,
            messageType: message.status === 'draft' ? 'draft' : 'reply',
        });
    },

    _getContextMessages(threadId, text = '') {
        const trimmedText = String(text || '').trim();
        const maxItems = this._getContextLimit(trimmedText);
        if (maxItems <= 0) {
            return [];
        }

        return Storage.getMessages(threadId)
            .slice(-maxItems)
            .map((message) => `[${message.direction === 'received' ? '受信' : '送信'}] ${message.originalText.slice(0, 120)}`);
    },

    _getContextLimit(text) {
        const length = String(text || '').length;
        if (length <= 40) return 0;
        if (length <= 160) return 1;
        if (length <= 500) return 2;
        return 3;
    },

    _getRelevantDictionary(text, companyId) {
        const normalizedText = String(text || '').trim();
        if (!normalizedText) {
            return [];
        }

        const normalizedTextLower = normalizedText.toLowerCase();
        const entries = [
            ...Storage.getSystemDictionary(),
            ...Storage.getCompanyDictionary(companyId),
        ];

        const relevantEntries = entries
            .filter((entry) => {
                const sourceTerm = String(entry?.ja || entry?.sourceTerm || '').trim();
                if (!sourceTerm) return false;
                return normalizedText.includes(sourceTerm) || normalizedTextLower.includes(sourceTerm.toLowerCase());
            })
            .sort((a, b) => String(b?.ja || b?.sourceTerm || '').length - String(a?.ja || a?.sourceTerm || '').length)
            .slice(0, 8);

        return relevantEntries;
    },

    async updateThreadLang(threadId, lang) {
        await Storage.saveProjectPreference(threadId, { lang });
    },

    async updateThreadTone(threadId, tone) {
        await Storage.saveProjectPreference(threadId, { tone });
    },
};
