/**
 * settings.js - 設定・署名管理ユーティリティ
 * MultiTranslate
 */

const Settings = {
    init() {
        // 設定を読み込んでUIに適用する（必要に応じて）
        const settings = Storage.getSettings();
        document.title = 'MultiTranslate - 多言語翻訳チャット';
    },

    getAiProvider() {
        return Storage.getSettings().aiProvider || 'mock';
    },

    getDefaultTone() {
        return Storage.getSettings().defaultTone || 'auto';
    },

    getUserName() {
        return Storage.getSettings().userName || 'ユーザー';
    },
};
