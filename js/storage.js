/**
 * storage.js - ローカルストレージ管理とデモデータ
 * MultiTranslate
 */

const STORAGE_KEYS = {
  COMPANIES: 'mt_companies',
  THREADS: 'mt_threads',
  MESSAGES: 'mt_messages',
  SETTINGS: 'mt_settings',
  DICT_COMPANY: 'mt_dict_company',
  DICT_THREADS: 'mt_dict_threads',
  SIGNATURES: 'mt_signatures',
};

// ===== デモデータ =====
const DEMO_DATA = {
  companies: [
    {
      id: 'c1',
      name: 'ABC Corporation',
      lang: 'en',
      createdAt: '2024-01-10T09:00:00Z',
      color: '#6C63FF',
    },
    {
      id: 'c2',
      name: '韓国貿易商事（Seoul Trading）',
      lang: 'ko',
      createdAt: '2024-01-15T09:00:00Z',
      color: '#00B894',
    },
    {
      id: 'c3',
      name: 'ShanghaiTech Co., Ltd.',
      lang: 'zh',
      createdAt: '2024-02-01T09:00:00Z',
      color: '#E17055',
    },
  ],
  threads: [
    { id: 't1', companyId: 'c1', name: '資材調達2024', lang: 'en', tone: 'standard', signatureId: 'sig1', createdAt: '2024-01-10T09:00:00Z' },
    { id: 't2', companyId: 'c1', name: '品質クレーム対応', lang: 'en', tone: 'formal', signatureId: 'sig1', createdAt: '2024-02-10T09:00:00Z' },
    { id: 't3', companyId: 'c2', name: '価格交渉_春季', lang: 'ko', tone: 'standard', signatureId: 'sig1', createdAt: '2024-01-15T09:00:00Z' },
    { id: 't4', companyId: 'c3', name: '部品サンプル依頼', lang: 'zh', tone: 'standard', signatureId: 'sig1', createdAt: '2024-02-01T09:00:00Z' },
  ],
  messages: [
    {
      id: 'm1', threadId: 't1', direction: 'received',
      channel: 'mail', subject: 'Inquiry about shelf rack',
      originalText: 'Dear Takeshi,\n\nI hope this email finds you well. We are interested in your medium-duty shelf racks. Could you please provide us with your latest price list and minimum order quantity?\n\nBest regards,\nJohn Smith\nABC Corporation',
      translatedText: '田中様\n\nお世話になっております。御社の中量棚に関心があります。最新の価格リストと最低発注数量をお知らせいただけますでしょうか。\n\nよろしくお願い申し上げます。\nジョン・スミス\nABC Corporation',
      detectedLang: 'en',
      status: 'received',
      createdAt: '2024-01-10T10:00:00Z',
    },
    {
      id: 'm2', threadId: 't1', direction: 'sent',
      channel: 'mail', subject: null,
      originalText: 'ジョン様\n\nお問い合わせいただきありがとうございます。中量棚の価格リストを添付にてお送りします。最低発注数量は10本単位となっております。何かご不明な点がございましたらお知らせください。',
      translatedText: 'Dear John,\n\nThank you for your inquiry. Please find our price list for medium-duty shelf racks attached. The minimum order quantity is 10 pieces per unit. Please do not hesitate to contact us if you have any questions.\n\nBest regards,\nTakeshi Tanaka',
      detectedLang: 'en',
      status: 'sent',
      createdAt: '2024-01-10T14:30:00Z',
    },
    {
      id: 'm3', threadId: 't1', direction: 'received',
      channel: 'mail', subject: null,
      originalText: 'Dear Takeshi,\n\nThank you for the price list. We would like to order 50 pieces of the medium-duty rack (Model M-300). Could you confirm the delivery date to our warehouse in Los Angeles?\n\nBest regards,\nJohn',
      translatedText: '田中様\n\n価格リストをありがとうございます。中量棚（型番M-300）を50本注文したいと考えています。ロサンゼルスの倉庫への納期を確認していただけますでしょうか。\n\nよろしくお願いします。\nジョン',
      detectedLang: 'en',
      status: 'received',
      createdAt: '2024-01-11T08:00:00Z',
    },
    {
      id: 'm4', threadId: 't3', direction: 'received',
      channel: 'chat',
      originalText: '안녕하세요. 이번 봄 시즌 가격에 대해 논의하고 싶습니다. 작년보다 10% 정도 할인이 가능한지 확인 부탁드립니다.',
      translatedText: 'こんにちは。今春シーズンの価格について議論したいと思います。昨年より約10%の値引きが可能かどうか確認をお願いします。',
      detectedLang: 'ko',
      status: 'received',
      createdAt: '2024-01-15T10:30:00Z',
    },
  ],
  signatures: [
    {
      id: 'sig1',
      name: '標準（日本語）',
      body: '田中 武\n株式会社サンプル\n営業部\nTEL: 03-XXXX-XXXX\nEmail: tanaka@example.co.jp',
    },
    {
      id: 'sig2',
      name: 'English',
      body: 'Takeshi Tanaka\nSales Department\nSample Co., Ltd.\nTEL: +81-3-XXXX-XXXX\nEmail: tanaka@example.co.jp',
    },
  ],
  dictCompany: [
    { id: 'd1', ja: '中量棚', translated: 'medium duty rack' },
    { id: 'd2', ja: '軽量棚', translated: 'light duty rack' },
    { id: 'd3', ja: 'タイガーラック', translated: 'TIGER RACK' },
    { id: 'd4', ja: '納期', translated: 'delivery date' },
  ],
  settings: {
    aiProvider: 'mock',
    openaiKey: '',
    geminiKey: '',
    claudeKey: '',
    userName: '田中 武',
    defaultTone: 'auto',
  },
};

// ===== ストレージAPI =====
const Storage = {
  // 初期化（デモデータ投入）
  init() {
    if (!localStorage.getItem(STORAGE_KEYS.COMPANIES)) {
      localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(DEMO_DATA.companies));
    }
    if (!localStorage.getItem(STORAGE_KEYS.THREADS)) {
      localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(DEMO_DATA.threads));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MESSAGES)) {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(DEMO_DATA.messages));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SIGNATURES)) {
      localStorage.setItem(STORAGE_KEYS.SIGNATURES, JSON.stringify(DEMO_DATA.signatures));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DICT_COMPANY)) {
      localStorage.setItem(STORAGE_KEYS.DICT_COMPANY, JSON.stringify(DEMO_DATA.dictCompany));
    }
    if (!localStorage.getItem(STORAGE_KEYS.DICT_THREADS)) {
      localStorage.setItem(STORAGE_KEYS.DICT_THREADS, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEMO_DATA.settings));
    }
  },

  // リセット（デモデータに戻す）
  reset() {
    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
    this.init();
  },

  // --- 会社 ---
  getCompanies() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPANIES) || '[]');
  },
  saveCompany(company) {
    const list = this.getCompanies();
    const idx = list.findIndex(c => c.id === company.id);
    if (idx >= 0) list[idx] = company;
    else list.push(company);
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(list));
  },
  deleteCompany(id) {
    const list = this.getCompanies().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(list));
  },

  // --- スレッド ---
  getThreads(companyId = null) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.THREADS) || '[]');
    return companyId ? all.filter(t => t.companyId === companyId) : all;
  },
  saveThread(thread) {
    const list = this.getThreads();
    const idx = list.findIndex(t => t.id === thread.id);
    if (idx >= 0) list[idx] = thread;
    else list.push(thread);
    localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(list));
  },
  deleteThread(id) {
    const list = this.getThreads().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.THREADS, JSON.stringify(list));
  },

  // --- メッセージ ---
  getMessages(threadId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    return all.filter(m => m.threadId === threadId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },
  saveMessage(message) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const idx = all.findIndex(m => m.id === message.id);
    if (idx >= 0) all[idx] = message;
    else all.push(message);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(all));
  },
  deleteMessage(id) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]').filter(m => m.id !== id);
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(all));
  },
  updateMessage(id, patch) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '[]');
    const idx = all.findIndex(m => m.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(all));
      return all[idx];
    }
    return null;
  },

  // --- 署名 ---
  getSignatures() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SIGNATURES) || '[]');
  },
  saveSignature(sig) {
    const list = this.getSignatures();
    const idx = list.findIndex(s => s.id === sig.id);
    if (idx >= 0) list[idx] = sig;
    else list.push(sig);
    localStorage.setItem(STORAGE_KEYS.SIGNATURES, JSON.stringify(list));
  },
  deleteSignature(id) {
    const list = this.getSignatures().filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SIGNATURES, JSON.stringify(list));
  },

  // --- 翻訳辞書（会社共通） ---
  getDictCompany() {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.DICT_COMPANY) || '[]');
  },
  saveDictCompany(list) {
    localStorage.setItem(STORAGE_KEYS.DICT_COMPANY, JSON.stringify(list));
  },
  addDictCompanyEntry(entry) {
    const list = this.getDictCompany();
    list.push(entry);
    this.saveDictCompany(list);
  },
  removeDictCompanyEntry(id) {
    const list = this.getDictCompany().filter(e => e.id !== id);
    this.saveDictCompany(list);
  },

  // --- 翻訳辞書（スレッド別） ---
  getDictThread(threadId) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DICT_THREADS) || '{}');
    return all[threadId] || [];
  },
  saveDictThread(threadId, list) {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEYS.DICT_THREADS) || '{}');
    all[threadId] = list;
    localStorage.setItem(STORAGE_KEYS.DICT_THREADS, JSON.stringify(all));
  },
  addDictThreadEntry(threadId, entry) {
    const list = this.getDictThread(threadId);
    list.push(entry);
    this.saveDictThread(threadId, list);
  },
  removeDictThreadEntry(threadId, id) {
    const list = this.getDictThread(threadId).filter(e => e.id !== id);
    this.saveDictThread(threadId, list);
  },

  // --- 設定 ---
  getSettings() {
    return { ...DEMO_DATA.settings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}') };
  },
  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },
};

// ===== ユーティリティ =====
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getCompanyInitial(name) {
  // アルファベットなら先頭2文字、日本語なら先頭1文字
  const match = name.match(/[A-Za-z]{2}/);
  if (match) return match[0].toUpperCase();
  return name[0] || '?';
}

function getLangLabel(code) {
  const map = {
    auto: '自動', en: '英語', zh: '中国語(簡)', 'zh-TW': '中国語(繁)',
    ko: '韓国語', es: 'スペイン語', fr: 'フランス語', de: 'ドイツ語',
    it: 'イタリア語', pt: 'ポルトガル語', ar: 'アラビア語', th: 'タイ語', vi: 'ベトナム語',
  };
  return map[code] || code;
}
