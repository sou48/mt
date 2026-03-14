/**
 * ai-gateway.js - サーバー中継 AI クライアント
 */

const AIGateway = {
    async translate(params) {
        return ApiClient.translate(params);
    },

    async detectLanguage(text) {
        const result = await ApiClient.detectLanguage(text);
        return result.detectedLang;
    },

    async generateDraft(params) {
        return ApiClient.generateDraft(params);
    },
};
