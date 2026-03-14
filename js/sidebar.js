/**
 * sidebar.js - 会社・案件一覧サイドバー
 * MultiTranslate
 */

const Sidebar = {
    currentCompanyId: null,
    currentThreadId: null,

    init() {
        this.render();
        this._bindSearch();
    },

    async render(filterText = '') {
        const container = document.getElementById('company-list');
        if (!container) return;

        let companies = Storage.getCompanies();
        let threads = Storage.getThreads();

        if (filterText) {
            const searchResult = await Storage.searchSidebar(filterText);
            companies = searchResult.companies;
            threads = searchResult.threads;
        }
        const filtered = companies;

        if (filtered.length === 0) {
            Dom.setMarkup(container, `<div style="padding:24px 16px; text-align:center; color:var(--text-muted); font-size:12px;">
        ${filterText ? '検索結果がありません' : '会社を追加してください'}
      </div>`);
            return;
        }

        Dom.setMarkup(container, filtered.map(company => {
            const companyThreads = threads.filter(t => t.companyId === company.id);
            const isOpen = this.currentCompanyId === company.id;
            return this._renderCompanyGroup(company, companyThreads, isOpen, filterText);
        }).join(''));

        this._bindGroupEvents();
        this._highlightActive();
    },

    _renderCompanyGroup(company, threads, isOpen, filterText = '') {
        const initial = getCompanyInitial(company.name);
        const langLabel = getLangLabel(company.lang);
        const normalizedFilter = String(filterText || '').toLowerCase();
        const companyMatchesFilter = normalizedFilter
            ? company.name.toLowerCase().includes(normalizedFilter)
            : false;

        const filteredThreads = filterText
            ? companyMatchesFilter
                ? threads
                : threads.filter(t => t.name.toLowerCase().includes(normalizedFilter))
            : threads;

        return `
    <div class="company-group ${isOpen ? 'open' : ''}" data-company-id="${company.id}">
      <div class="company-group-header" data-company-toggle="${company.id}">
        <div class="company-name-wrap">
          <div class="company-avatar" style="background:${company.color || '#6C63FF'}">
            ${initial}
          </div>
          <div class="company-info">
            <div class="company-display-name" title="${this._escHtml(company.name)}">${this._escHtml(company.name)}</div>
            <span class="company-lang-badge">${langLabel}</span>
          </div>
        </div>
        <svg class="company-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>
      ${isOpen ? `
        <div class="thread-list">
          ${filteredThreads.map(t => this._renderThreadItem(t)).join('')}
          <div class="thread-item" data-new-thread="${company.id}" style="opacity:0.6;">
            <div class="thread-icon" style="background:var(--text-muted)"></div>
            <span class="thread-name" style="color:var(--text-muted);font-style:italic;">＋ 案件を追加</span>
          </div>
        </div>
      ` : ''}
    </div>`;
    },

    _renderThreadItem(thread) {
        const isActive = this.currentThreadId === thread.id;
        return `
    <div class="thread-item ${isActive ? 'active' : ''}" data-thread-id="${thread.id}" data-company-id="${thread.companyId}">
      <div class="thread-icon"></div>
      <span class="thread-name" title="${this._escHtml(thread.name)}">${this._escHtml(thread.name)}</span>
    </div>`;
    },

    _bindGroupEvents() {
        // 会社グループの開閉
        document.querySelectorAll('[data-company-toggle]').forEach(el => {
            el.addEventListener('click', (e) => {
                const companyId = el.dataset.companyToggle;
                this.currentCompanyId = this.currentCompanyId === companyId ? null : companyId;
                this.render(document.getElementById('sidebar-search')?.value || '');
            });
        });

        // スレッド選択
        document.querySelectorAll('[data-thread-id]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const threadId = el.dataset.threadId;
                const companyId = el.dataset.companyId;
                this.selectThread(threadId, companyId);
            });
        });

        // 新規案件追加
        document.querySelectorAll('[data-new-thread]').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const companyId = el.dataset.newThread;
                App.showNewThreadModal(companyId);
            });
        });
    },

    _bindSearch() {
        const searchInput = document.getElementById('sidebar-search');
        if (!searchInput) return;
        searchInput.addEventListener('input', async (e) => {
            await this.render(e.target.value);
        });
    },

    _highlightActive() {
        document.querySelectorAll('[data-thread-id]').forEach(el => {
            const isActive = el.dataset.threadId === this.currentThreadId;
            el.classList.toggle('active', isActive);
        });
    },

    async selectThread(threadId, companyId) {
        this.currentThreadId = threadId;
        this.currentCompanyId = companyId;
        await this.render(document.getElementById('sidebar-search')?.value || '');
        await Chat.loadThread(threadId);

        // モバイル：サイドバーを閉じる
        this._closeMobileSidebar();
    },

    async addCompany(company) {
        const result = await Storage.saveCompany(company);
        this.currentCompanyId = result.company.id;
        await this.render();
        return result;
    },

    async addThread(thread) {
        const result = await Storage.saveThread(thread);
        await this.render();
        await this.selectThread(result.thread.id, result.thread.companyId);
        return result;
    },

    openMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar?.classList.add('open');
        overlay?.classList.add('active');
    },

    _closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
    },

    _escHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    },
};
