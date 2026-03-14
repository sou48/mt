/**
 * translator.js - 翻訳ロジック
 */

const Translator = {
    async translateReceived({ text, threadId, channel, subject, detectedLang }) {
        const thread = Storage.getThreadById(threadId);
        if (!thread) throw new Error('案件が見つかりません');

        const dictionary = [
            ...Storage.getSystemDictionary(),
            ...Storage.getCompanyDictionary(thread.companyId),
        ];

        let sourceLang = thread.lang !== 'auto' ? thread.lang : (detectedLang || 'auto');
        let actualDetectedLang = sourceLang;
        if (sourceLang === 'auto') {
            actualDetectedLang = await AIGateway.detectLanguage(text);
        }

        const result = await AIGateway.translate({
            text,
            targetLang: 'ja',
            sourceLang: actualDetectedLang,
            tone: thread.tone || 'auto',
            context: this._getContextMessages(threadId),
            dictionary,
            direction: 'receive',
        });

        const message = await Storage.saveReceivedMessage({
            projectId: threadId,
            channelType: channel === 'mail' ? 'email' : 'chat',
            subject: subject || null,
            sourceText: text,
            sourceLanguage: result.detectedLang || actualDetectedLang,
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
        const dictionary = [
            ...Storage.getSystemDictionary(),
            ...Storage.getCompanyDictionary(thread.companyId),
        ];

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
        const dictionary = [
            ...Storage.getSystemDictionary(),
            ...Storage.getCompanyDictionary(thread.companyId),
        ];

        const result = await AIGateway.translate({
            text: instruction ? `${textToTranslate}\n\n改善指示: ${instruction}` : textToTranslate,
            targetLang: thread.lang === 'auto' ? 'en' : thread.lang,
            sourceLang: 'ja',
            tone: tone || message.tone || thread.tone || 'auto',
            context: this._getContextMessages(message.threadId),
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

    _getContextMessages(threadId) {
        return Storage.getMessages(threadId)
            .slice(-10)
            .map((message) => `[${message.direction === 'received' ? '受信' : '送信'}] ${message.originalText.slice(0, 200)}`);
    },

    async updateThreadLang(threadId, lang) {
        await Storage.saveProjectPreference(threadId, { lang });
    },

    async updateThreadTone(threadId, tone) {
        await Storage.saveProjectPreference(threadId, { tone });
    },
};
