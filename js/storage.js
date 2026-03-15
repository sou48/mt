/**
 * storage.js - API キャッシュ層
 * MultiTranslate
 */

const Storage = {
  _cache: {
    companies: [],
    threads: [],
    messagesByThread: {},
    attachmentsByMessage: {},
    signatures: [],
    settings: {
      aiProvider: 'mock',
      openaiKey: '',
      geminiKey: '',
      claudeKey: '',
      userName: '',
      defaultTone: 'auto',
      themeMode: 'dark',
      projectPreferences: {},
    },
    systemDictionary: [],
    companyDictionaryByCompany: {},
    currentUser: null,
  },

  async init() {
    await this.refreshBootstrapData();
  },

  async refreshBootstrapData() {
    const { user } = await ApiClient.me();
    const [{ settings }, companies, threads, signatures] = await Promise.all([
      ApiClient.getSettings(),
      ApiClient.listCompanies(),
      ApiClient.listProjects(),
      ApiClient.listSignatures(),
    ]);

    this._cache.currentUser = user;
    this._cache.settings = {
      ...this._cache.settings,
      ...settings,
      projectPreferences: settings.projectPreferences || {},
    };
    this._cache.companies = companies.map((company) => this._mapCompany(company));
    this._cache.threads = threads.map((thread) => this._mapThread(thread));
    this._cache.signatures = signatures.map((signature) => this._mapSignature(signature));
  },

  async reset() {
    this._cache.messagesByThread = {};
    this._cache.attachmentsByMessage = {};
    this._cache.companyDictionaryByCompany = {};
    await this.refreshBootstrapData();
  },

  getCurrentUser() {
    return this._cache.currentUser;
  },

  getCompanies() {
    return [...this._cache.companies];
  },

  async saveCompany(company) {
    const response = company.id
      ? await ApiClient.updateCompany(company.id, { name: company.name })
      : await ApiClient.createCompany({ name: company.name });

    const mapped = this._mapCompany(response.company);
    const index = this._cache.companies.findIndex((item) => item.id === mapped.id);
    if (index >= 0) this._cache.companies[index] = mapped;
    else this._cache.companies.push(mapped);

    this._cache.companies.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    return { company: mapped, warnings: response.warnings || [] };
  },

  getThreads(companyId = null) {
    const threads = [...this._cache.threads];
    return companyId ? threads.filter((thread) => thread.companyId === companyId) : threads;
  },

  getThreadById(threadId) {
    return this._cache.threads.find((thread) => thread.id === threadId) || null;
  },

  async saveThread(thread) {
    const payload = {
      companyId: thread.companyId,
      name: thread.name,
    };

    const response = thread.id
      ? await ApiClient.updateProject(thread.id, payload)
      : await ApiClient.createProject(payload);

    const mapped = this._mapThread(response.project);
    const index = this._cache.threads.findIndex((item) => item.id === mapped.id);
    if (index >= 0) {
      this._cache.threads[index] = { ...this._cache.threads[index], ...mapped };
    } else {
      this._cache.threads.push(mapped);
    }

    return { thread: this.getThreadById(mapped.id), warnings: response.warnings || [] };
  },

  async loadMessages(threadId) {
    const messages = await ApiClient.listMessages(threadId);
    await Promise.all(
      messages.map(async (message) => {
        this._cache.attachmentsByMessage[message.id] = await ApiClient.listAttachments(message.id);
      })
    );
    this._cache.messagesByThread[threadId] = messages.map((message) => this._mapMessage(message));
    return this.getMessages(threadId);
  },

  getMessages(threadId) {
    return [...(this._cache.messagesByThread[threadId] || [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  },

  async saveReceivedMessage(payload) {
    const response = await ApiClient.createReceivedMessage(payload);
    const message = this._mapMessage(response.message);
    this._upsertMessage(message.threadId, message);
    return message;
  },

  async saveReplyMessage(payload) {
    const response = await ApiClient.createReplyMessage(payload);
    const message = this._mapMessage(response.message);
    this._upsertMessage(message.threadId, message);
    return message;
  },

  async updateMessage(id, patch) {
    const response = await ApiClient.updateMessage(id, patch);
    const message = this._mapMessage(response.message);
    this._upsertMessage(message.threadId, message);
    return message;
  },

  async deleteMessage(id) {
    await ApiClient.deleteMessage(id);
    Object.keys(this._cache.messagesByThread).forEach((threadId) => {
      this._cache.messagesByThread[threadId] = (this._cache.messagesByThread[threadId] || []).filter(
        (message) => message.id !== id
      );
    });
  },

  async moveMessage(id, projectId) {
    const response = await ApiClient.moveMessage(id, projectId);
    const movedMessage = this._mapMessage(response.message);
    Object.keys(this._cache.messagesByThread).forEach((threadId) => {
      this._cache.messagesByThread[threadId] = (this._cache.messagesByThread[threadId] || []).filter(
        (message) => message.id !== id
      );
    });
    this._upsertMessage(movedMessage.threadId, movedMessage);
    return movedMessage;
  },

  async loadAttachments(messageId) {
    const attachments = await ApiClient.listAttachments(messageId);
    this._cache.attachmentsByMessage[messageId] = attachments;
    return this.getAttachments(messageId);
  },

  getAttachments(messageId) {
    return [...(this._cache.attachmentsByMessage[messageId] || [])];
  },

  async uploadAttachment(messageId, payload) {
    const response = await ApiClient.uploadAttachment(messageId, payload);
    const attachments = this._cache.attachmentsByMessage[messageId] || [];
    attachments.push(response.attachment);
    this._cache.attachmentsByMessage[messageId] = attachments;
    return response.attachment;
  },

  async deleteAttachment(attachmentId, messageId) {
    await ApiClient.deleteAttachment(attachmentId);
    this._cache.attachmentsByMessage[messageId] = (this._cache.attachmentsByMessage[messageId] || []).filter(
      (attachment) => attachment.id !== attachmentId
    );
  },

  getSignatures() {
    return [...this._cache.signatures];
  },

  async reloadSignatures() {
    const signatures = await ApiClient.listSignatures();
    this._cache.signatures = signatures.map((signature) => this._mapSignature(signature));
    return this.getSignatures();
  },

  async saveSignature(signature) {
    const payload = {
      name: signature.name,
      japaneseText: signature.japaneseText || signature.body || '',
      partnerText: signature.partnerText || null,
      isDefault: signature.isDefault === true,
    };

    const response = signature.id
      ? await ApiClient.updateSignature(signature.id, payload)
      : await ApiClient.createSignature(payload);

    const mapped = this._mapSignature(response.signature);
    const index = this._cache.signatures.findIndex((item) => item.id === mapped.id);
    if (index >= 0) this._cache.signatures[index] = mapped;
    else this._cache.signatures.push(mapped);
    return mapped;
  },

  async deleteSignature(id) {
    await ApiClient.deleteSignature(id);
    this._cache.signatures = this._cache.signatures.filter((signature) => signature.id !== id);
  },

  async loadSystemDictionary() {
    const entries = await ApiClient.listSystemDictionary();
    this._cache.systemDictionary = entries.map((entry) => this._mapDictionaryEntry(entry));
    return this.getSystemDictionary();
  },

  getSystemDictionary() {
    return [...this._cache.systemDictionary];
  },

  async addSystemDictionaryEntry(entry) {
    const response = await ApiClient.createSystemDictionaryEntry({
      sourceTerm: entry.ja,
      targetTerm: entry.translated,
      languagePair: entry.languagePair || 'ja<>en',
    });
    const mapped = this._mapDictionaryEntry(response.entry);
    this._cache.systemDictionary.unshift(mapped);
    return mapped;
  },

  async removeSystemDictionaryEntry(id) {
    await ApiClient.deleteSystemDictionaryEntry(id);
    this._cache.systemDictionary = this._cache.systemDictionary.filter((entry) => entry.id !== id);
  },

  async loadCompanyDictionary(companyId) {
    if (!companyId) return [];
    const entries = await ApiClient.listCompanyDictionary(companyId);
    this._cache.companyDictionaryByCompany[companyId] = entries.map((entry) => this._mapDictionaryEntry(entry));
    return this.getCompanyDictionary(companyId);
  },

  getCompanyDictionary(companyId) {
    return [...(this._cache.companyDictionaryByCompany[companyId] || [])];
  },

  async addCompanyDictionaryEntry(companyId, entry) {
    const response = await ApiClient.createCompanyDictionaryEntry(companyId, {
      sourceTerm: entry.ja,
      targetTerm: entry.translated,
      languagePair: entry.languagePair || 'ja<>en',
    });
    const mapped = this._mapDictionaryEntry(response.entry);
    const entries = this._cache.companyDictionaryByCompany[companyId] || [];
    entries.unshift(mapped);
    this._cache.companyDictionaryByCompany[companyId] = entries;
    return mapped;
  },

  async removeCompanyDictionaryEntry(companyId, id) {
    await ApiClient.deleteCompanyDictionaryEntry(companyId, id);
    this._cache.companyDictionaryByCompany[companyId] = (
      this._cache.companyDictionaryByCompany[companyId] || []
    ).filter((entry) => entry.id !== id);
  },

  getSettings() {
    return { ...this._cache.settings };
  },

  async saveSettings(settings) {
    const response = await ApiClient.updateSettings(settings);
    this._cache.settings = {
      ...this._cache.settings,
      ...response.settings,
      projectPreferences: response.settings.projectPreferences || {},
    };
    return this.getSettings();
  },

  getProjectPreference(threadId) {
    const preferences = this._cache.settings.projectPreferences || {};
    return preferences[threadId] || {};
  },

  async saveProjectPreference(threadId, patch) {
    const projectPreferences = {
      ...(this._cache.settings.projectPreferences || {}),
      [threadId]: {
        ...this.getProjectPreference(threadId),
        ...patch,
      },
    };
    await this.saveSettings({ projectPreferences });
    const index = this._cache.threads.findIndex((thread) => thread.id === threadId);
    if (index >= 0) {
      this._cache.threads[index] = this._applyProjectPreference(this._cache.threads[index]);
    }
    return this.getProjectPreference(threadId);
  },

  async searchSidebar(keyword) {
    if (!keyword) {
      return {
        companies: this.getCompanies(),
        threads: this.getThreads(),
      };
    }

    const [companies, projects] = await Promise.all([
      ApiClient.searchCompanies(keyword),
      ApiClient.searchProjects(keyword),
    ]);

    const mappedCompanies = companies.map((company) => this._mapCompany(company));
    const mappedProjects = projects.map((project) => this._mapThread(project));
    const companyIdsWithDirectMatch = new Set(mappedCompanies.map((company) => company.id));
    const supplementedThreads = this.getThreads().filter((thread) => companyIdsWithDirectMatch.has(thread.companyId));
    const uniqueThreads = new Map();

    [...mappedProjects, ...supplementedThreads].forEach((thread) => {
      uniqueThreads.set(thread.id, thread);
    });

    return {
      companies: mappedCompanies,
      threads: [...uniqueThreads.values()],
    };
  },

  _mapCompany(company) {
    return {
      id: company.id,
      name: company.name,
      lang: 'auto',
      color: this._colorFromId(company.id),
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
    };
  },

  _mapThread(project) {
    return this._applyProjectPreference({
      id: project.id,
      companyId: project.companyId,
      name: project.name,
      lang: 'auto',
      tone: 'auto',
      signatureId: null,
      createdAt: project.createdAt,
      isUnclassified: project.isUnclassified,
    });
  },

  _applyProjectPreference(thread) {
    const preference = this.getProjectPreference(thread.id);
    return {
      ...thread,
      lang: preference.lang || thread.lang || 'auto',
      tone: preference.tone || thread.tone || 'auto',
      signatureId: preference.signatureId || thread.signatureId || null,
    };
  },

  _mapMessage(message) {
    return {
      id: message.id,
      threadId: message.projectId,
      direction: message.messageType === 'received' ? 'received' : 'sent',
      channel: message.channelType === 'email' ? 'mail' : 'chat',
      subject: message.subject,
      originalText:
        message.messageType === 'received'
          ? message.sourceText || ''
          : message.japaneseText || message.sourceText || '',
      translatedText:
        message.messageType === 'received'
          ? message.translatedText || message.japaneseText || ''
          : message.partnerText || message.translatedText || '',
      detectedLang: message.sourceLanguage || 'auto',
      tone: this.getProjectPreference(message.projectId).tone || 'auto',
      status: message.messageType === 'draft' ? 'draft' : message.messageType === 'reply' ? 'sent' : 'received',
      createdAt: message.sourceSentAt || message.createdAt,
      attachments: this.getAttachments(message.id),
      raw: message,
    };
  },

  _mapSignature(signature) {
    return {
      id: signature.id,
      name: signature.name,
      body: [signature.japaneseText, signature.partnerText].filter(Boolean).join('\n\n'),
      japaneseText: signature.japaneseText,
      partnerText: signature.partnerText,
      isDefault: signature.isDefault,
    };
  },

  _mapDictionaryEntry(entry) {
    return {
      id: entry.id,
      ja: entry.sourceTerm,
      translated: entry.targetTerm,
      languagePair: entry.languagePair,
      raw: entry,
    };
  },

  _upsertMessage(threadId, message) {
    const messages = this._cache.messagesByThread[threadId] || [];
    const index = messages.findIndex((item) => item.id === message.id);
    if (index >= 0) messages[index] = message;
    else messages.push(message);
    this._cache.messagesByThread[threadId] = messages;
  },

  _colorFromId(id) {
    const palette = ['#6C63FF', '#00B894', '#E17055', '#0984E3', '#A29BFE', '#FD79A8', '#FDCB6E', '#55EFC4'];
    const seed = String(id)
      .split('')
      .reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return palette[seed % palette.length];
  },
};

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getCompanyInitial(name) {
  const match = String(name || '').match(/[A-Za-z]{2}/);
  if (match) return match[0].toUpperCase();
  return String(name || '?')[0] || '?';
}

function getLangLabel(code) {
  const map = {
    auto: '自動',
    en: '英語',
    zh: '中国語(簡)',
    'zh-TW': '中国語(繁)',
    ko: '韓国語',
    es: 'スペイン語',
    fr: 'フランス語',
    de: 'ドイツ語',
    it: 'イタリア語',
    pt: 'ポルトガル語',
    ar: 'アラビア語',
    th: 'タイ語',
    vi: 'ベトナム語',
    ja: '日本語',
  };
  return map[code] || code;
}
