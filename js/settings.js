/**
 * settings.js - 設定・署名管理ユーティリティ
 * MultiTranslate
 */

const Settings = {
    init() {
        const settings = Storage.getSettings();
        this.applyTheme(settings.themeMode || 'light');
        document.title = 'MultiTranslate - 多言語翻訳チャット';
    },

    applyTheme(themeMode = 'light') {
        const nextTheme = themeMode === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = nextTheme;
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

    getThemeMode() {
        return Storage.getSettings().themeMode || 'light';
    },
};
