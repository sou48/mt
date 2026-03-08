/**
 * ai-gateway.js - AI抽象化レイヤー（AI Gateway）
 * MultiTranslate
 * OpenAI / Gemini / Claude に対応。未設定時はモック動作。
 */

const AIGateway = {
    // ===== メインエントリポイント =====

    /**
     * テキストを翻訳する
     * @param {object} params
     * @param {string} params.text - 翻訳するテキスト
     * @param {string} params.targetLang - 翻訳先言語コード
     * @param {string} params.sourceLang - 原文言語（'auto'の場合は自動判定）
     * @param {string} params.tone - トーン（'auto'|'formal'|'standard'|'friendly'）
     * @param {string[]} params.context - 直近の会話コンテキスト（最大10件）
     * @param {object[]} params.dictionary - 翻訳辞書エントリ
     * @param {string} params.direction - 'receive'（受信翻訳）| 'send'（送信翻訳）
     * @returns {Promise<{translatedText: string, detectedLang: string}>}
     */
    async translate(params) {
        const settings = Storage.getSettings();
        const provider = settings.aiProvider || 'mock';

        if (provider === 'openai' && settings.openaiKey) {
            return this._openaiTranslate(params, settings.openaiKey);
        } else if (provider === 'gemini' && settings.geminiKey) {
            return this._geminiTranslate(params, settings.geminiKey);
        } else if (provider === 'claude' && settings.claudeKey) {
            return this._claudeTranslate(params, settings.claudeKey);
        } else {
            return this._mockTranslate(params);
        }
    },

    /**
     * 言語を自動判定する
     * @param {string} text
     * @returns {Promise<string>} 言語コード
     */
    async detectLanguage(text) {
        const settings = Storage.getSettings();
        const provider = settings.aiProvider || 'mock';

        if (provider !== 'mock' && (settings.openaiKey || settings.geminiKey || settings.claudeKey)) {
            // 実際のAPIで判定（翻訳と同じプロバイダを使用）
            return this._detectWithAI(text, settings);
        }
        return this._mockDetectLanguage(text);
    },

    /**
     * AI返信下書きを生成する
     * @param {object} params
     * @param {string} params.instruction - ユーザー指示
     * @param {object[]} params.messageHistory - 直近メッセージ履歴
     * @param {string} params.targetLang - 相手言語
     * @param {string} params.tone - トーン
     * @returns {Promise<{draftJa: string}>}
     */
    async generateDraft(params) {
        const settings = Storage.getSettings();
        const provider = settings.aiProvider || 'mock';

        if (provider === 'openai' && settings.openaiKey) {
            return this._openaiDraft(params, settings.openaiKey);
        } else if (provider === 'gemini' && settings.geminiKey) {
            return this._geminiDraft(params, settings.geminiKey);
        } else {
            return this._mockGenerateDraft(params);
        }
    },

    // ===== OpenAI実装 =====

    async _openaiTranslate(params, apiKey) {
        const { text, targetLang, sourceLang, tone, context, dictionary, direction } = params;
        const dictStr = dictionary && dictionary.length > 0
            ? `\n\n以下の翻訳辞書を優先適用してください（日本語→翻訳後）:\n${dictionary.map(d => `- ${d.ja} → ${d.translated}`).join('\n')}`
            : '';
        const toneStr = this._tonePrompt(tone);
        const contextStr = context && context.length > 0
            ? `\n\n直近の会話文脈:\n${context.slice(-10).map((m, i) => `[${i + 1}] ${m}`).join('\n')}`
            : '';

        const targetLangName = getLangLabel(targetLang);
        let systemPrompt, userPrompt;

        if (direction === 'receive') {
            systemPrompt = `あなたはプロのビジネス翻訳者です。${targetLangName}のメッセージを日本語に翻訳してください。${toneStr}${dictStr}`;
            userPrompt = `以下のメッセージを日本語に翻訳してください。翻訳文のみを返してください。${contextStr}\n\n原文:\n${text}`;
        } else {
            systemPrompt = `あなたはプロのビジネス翻訳者です。日本語のメッセージを${targetLangName}に翻訳してください。${toneStr}${dictStr}`;
            userPrompt = `以下のメッセージを${targetLangName}に翻訳してください。翻訳文のみを返してください。${contextStr}\n\n原文:\n${text}`;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.3,
            }),
        });

        if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
        const data = await response.json();
        const translatedText = data.choices[0].message.content.trim();
        const detectedLang = sourceLang === 'auto' ? await this._detectWithAI(text, Storage.getSettings()) : sourceLang;

        return { translatedText, detectedLang };
    },

    async _openaiDraft(params, apiKey) {
        const { instruction, messageHistory, targetLang, tone } = params;
        const targetLangName = getLangLabel(targetLang);
        const histStr = (messageHistory || []).slice(-10).map(m =>
            `[${m.direction === 'received' ? '受信' : '送信'}] ${m.originalText}`
        ).join('\n---\n');
        const toneStr = this._tonePrompt(tone);

        const systemPrompt = `あなたは多言語ビジネスコミュニケーション支援AIです。会話履歴を参照して、適切な日本語の返信下書きを作成してください。${toneStr}`;
        const userPrompt = `直近の会話履歴:\n${histStr}\n\n${instruction ? `追加指示: ${instruction}\n\n` : ''}上記を踏まえて、日本語で返信下書きを作成してください。送信後に${targetLangName}に翻訳されます。日本語の下書き文のみを返してください。`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                temperature: 0.7,
            }),
        });

        if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
        const data = await response.json();
        return { draftJa: data.choices[0].message.content.trim() };
    },

    // ===== Gemini実装 =====

    async _geminiTranslate(params, apiKey) {
        const { text, targetLang, tone, dictionary, direction } = params;
        const targetLangName = getLangLabel(targetLang);
        const dictStr = dictionary && dictionary.length > 0
            ? `\n翻訳辞書（優先適用）:\n${dictionary.map(d => `${d.ja} → ${d.translated}`).join(', ')}`
            : '';
        const toneStr = this._tonePrompt(tone);

        let prompt;
        if (direction === 'receive') {
            prompt = `${targetLangName}のメッセージを日本語に翻訳してください。${toneStr}${dictStr}\n翻訳文のみ返してください。\n\n原文:\n${text}`;
        } else {
            prompt = `日本語のメッセージを${targetLangName}に翻訳してください。${toneStr}${dictStr}\n翻訳文のみ返してください。\n\n原文:\n${text}`;
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.3 },
                }),
            }
        );

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        const translatedText = data.candidates[0].content.parts[0].text.trim();
        const detectedLang = await this._mockDetectLanguage(text);

        return { translatedText, detectedLang };
    },

    async _geminiDraft(params, apiKey) {
        const { instruction, messageHistory, tone } = params;
        const toneStr = this._tonePrompt(tone);
        const histStr = (messageHistory || []).slice(-10).map(m =>
            `[${m.direction === 'received' ? '受信' : '送信'}] ${m.originalText}`
        ).join('\n---\n');

        const prompt = `会話履歴を参照して日本語の返信下書きを作成してください。${toneStr}\n\n会話履歴:\n${histStr}\n${instruction ? `\n追加指示: ${instruction}\n` : ''}\n日本語の下書きのみ返してください。`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 },
                }),
            }
        );

        if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
        const data = await response.json();
        return { draftJa: data.candidates[0].content.parts[0].text.trim() };
    },

    // ===== Claude実装 =====

    async _claudeTranslate(params, apiKey) {
        const { text, targetLang, tone, dictionary, direction } = params;
        const targetLangName = getLangLabel(targetLang);
        const dictStr = dictionary && dictionary.length > 0
            ? `\n翻訳辞書（優先適用）:\n${dictionary.map(d => `${d.ja} → ${d.translated}`).join(', ')}`
            : '';
        const toneStr = this._tonePrompt(tone);

        let userMsg;
        if (direction === 'receive') {
            userMsg = `${targetLangName}のメッセージを日本語に翻訳してください。${toneStr}${dictStr}\n翻訳文のみ返してください。\n\n原文:\n${text}`;
        } else {
            userMsg = `日本語のメッセージを${targetLangName}に翻訳してください。${toneStr}${dictStr}\n翻訳文のみ返してください。\n\n原文:\n${text}`;
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 2048,
                messages: [{ role: 'user', content: userMsg }],
            }),
        });

        if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
        const data = await response.json();
        const translatedText = data.content[0].text.trim();
        return { translatedText, detectedLang: await this._mockDetectLanguage(text) };
    },

    // ===== 言語検出 =====

    async _detectWithAI(text, settings) {
        // openaiで判定
        if (settings.openaiKey) {
            try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.openaiKey}` },
                    body: JSON.stringify({
                        model: 'gpt-4o-mini',
                        messages: [
                            { role: 'system', content: 'テキストの言語を検出し、BCP-47言語コードのみを返してください（例: en, ja, ko, zh, fr）。' },
                            { role: 'user', content: text.slice(0, 200) },
                        ],
                        temperature: 0,
                    }),
                });
                const data = await response.json();
                return data.choices[0].message.content.trim().toLowerCase();
            } catch {
                return this._mockDetectLanguage(text);
            }
        }
        return this._mockDetectLanguage(text);
    },

    // ===== モック実装 =====

    async _mockTranslate(params) {
        // 翻訳中を演出するため少し待機
        await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

        const { text, targetLang, direction } = params;
        const detectedLang = await this._mockDetectLanguage(text);

        let translatedText;
        if (direction === 'receive') {
            translatedText = this._mockReceiveTranslation(text, detectedLang);
        } else {
            translatedText = this._mockSendTranslation(text, targetLang);
        }

        return { translatedText, detectedLang };
    },

    _mockReceiveTranslation(text, detectedLang) {
        // 簡易モック翻訳（英語 → 日本語パターン）
        const patterns = {
            en: [
                ['Dear', '様'],
                ['Thank you', 'ありがとうございます'],
                ['Please find', 'ご確認ください'],
                ['Best regards', 'よろしくお願いいたします'],
                ['I hope this', 'お世話になっております'],
                ['Sincerely', '敬具'],
                ['Could you please', 'ご確認いただけますでしょうか'],
                ['We are interested', '関心があります'],
                ['delivery date', '納期'],
                ['minimum order', '最低発注数量'],
            ],
            ko: [
                ['안녕하세요', 'こんにちは'],
                ['감사합니다', 'ありがとうございます'],
                ['주문', '注文'],
                ['확인', '確認'],
                ['부탁드립니다', 'よろしくお願いします'],
            ],
            zh: [
                ['您好', 'こんにちは'],
                ['谢谢', 'ありがとうございます'],
                ['请', 'してください'],
                ['确认', '確認'],
                ['订单', '注文'],
            ],
        };

        const langPatterns = patterns[detectedLang] || [];
        let result = text;
        langPatterns.forEach(([from, to]) => {
            result = result.replace(new RegExp(from, 'gi'), to);
        });

        if (result === text) {
            result = `【AI翻訳モック - ${getLangLabel(detectedLang)}→日本語】\n\n${text}\n\n※ 実際のAI翻訳を有効にするには設定からAPIキーを入力してください。`;
        }
        return result;
    },

    _mockSendTranslation(text, targetLang) {
        // ★ モック翻訳：APIキー未設定のため実際の翻訳は行われていません。
        // 設定画面からOpenAI / Gemini / Claude のAPIキーを入力すると実際の翻訳が有効になります。
        const note = `\n\n---\n※ これはモック翻訳です（APIキー未設定）。実際の翻訳を行うには設定からAPIキーを入力してください。`;

        const templates = {
            en: `Dear recipient,\n\nThank you for your message.\n\n${text}\n\nBest regards${note}`,
            ko: `안녕하세요,\n\n${text}\n\n감사합니다${note}`,
            zh: `您好，\n\n${text}\n\n谢谢${note}`,
            es: `Estimado/a,\n\n${text}\n\nSaludos cordiales${note}`,
            fr: `Cher/Chère,\n\n${text}\n\nCordialement${note}`,
            de: `Sehr geehrte/r,\n\n${text}\n\nMit freundlichen Grüßen${note}`,
            th: `เรียน,\n\n${text}\n\nด้วยความนับถือ${note}`,
            vi: `Kính gửi,\n\n${text}\n\nTrân trọng${note}`,
        };

        return templates[targetLang] || `【${getLangLabel(targetLang)} モック翻訳】\n\n${text}${note}`;
    },

    async _mockDetectLanguage(text) {
        // 簡易文字種判定
        const firstChars = text.slice(0, 100);
        if (/[\uAC00-\uD7AF]/.test(firstChars)) return 'ko';
        if (/[\u4E00-\u9FFF]/.test(firstChars)) return 'zh';
        if (/[\u3040-\u309F\u30A0-\u30FF]/.test(firstChars)) return 'ja';
        if (/[\u0600-\u06FF]/.test(firstChars)) return 'ar';
        if (/[\u0E00-\u0E7F]/.test(firstChars)) return 'th';
        if (/[ñáéíóúü]/i.test(firstChars)) return 'es';
        if (/[àâçèêëîïôùûü]/i.test(firstChars)) return 'fr';
        if (/[äöüß]/i.test(firstChars)) return 'de';
        return 'en'; // デフォルト英語
    },

    async _mockGenerateDraft(params) {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));

        const { instruction, messageHistory } = params;
        const lastReceived = (messageHistory || []).filter(m => m.direction === 'received').slice(-1)[0];

        let draft = '';
        if (lastReceived) {
            draft = `お世話になっております。\n\nご連絡いただきありがとうございます。\n\n`;
            if (instruction && instruction.includes('丁寧')) {
                draft += `ご依頼の件につきまして、慎重に検討いたしました結果、対応可能でございます。詳細につきましては改めてご連絡申し上げます。\n\n何かご不明な点がございましたら、お気軽にお申し付けください。\n\nどうぞよろしくお願い申し上げます。`;
            } else if (instruction && instruction.includes('簡潔')) {
                draft += `ご依頼の件、承りました。追ってご連絡します。`;
            } else {
                draft += `ご依頼の件につきまして、確認の上、ご回答申し上げます。少々お時間をいただけますよう、よろしくお願いいたします。`;
            }
        } else {
            draft = `お世話になっております。\n\nご連絡ありがとうございます。\n\n※ 実際のAI下書き生成を有効にするには設定からAPIキーを入力してください。`;
        }

        return { draftJa: draft };
    },

    // ===== ヘルパー =====
    _tonePrompt(tone) {
        const map = {
            formal: 'ビジネス正式なトーンで、丁寧かつ格式高い表現を使用してください。',
            standard: 'ビジネス標準のトーンで、丁寧で自然なビジネス表現を使用してください。',
            friendly: 'やや親しみやすいトーンで、丁寧ながら柔らかい表現を使用してください。',
            auto: '会話の文脈に応じて適切なビジネストーンを判断してください。',
        };
        return map[tone] || map.auto;
    },
};
