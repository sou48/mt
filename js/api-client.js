const ApiClient = {
  async request(path, options = {}) {
    const response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      ...options,
    });

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const body = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(body?.message || `API error: ${response.status}`);
    }

    return body;
  },

  async fetchAll(path, itemKey) {
    let page = 1;
    const pageSize = 100;
    let results = [];
    while (true) {
      const body = await this.request(`${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=${pageSize}`);
      results = results.concat(body[itemKey] || []);
      if (!body.pagination || page >= body.pagination.totalPages || body.pagination.totalPages === 0) {
        return results;
      }
      page += 1;
    }
  },

  login(email, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  testLogin() {
    return this.request('/auth/test-login', {
      method: 'POST',
    });
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  me() {
    return this.request('/auth/me');
  },

  getSettings() {
    return this.request('/settings');
  },

  updateSettings(payload) {
    return this.request('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listCompanies() {
    return this.fetchAll('/companies', 'companies');
  },

  createCompany(payload) {
    return this.request('/companies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCompany(companyId, payload) {
    return this.request(`/companies/${companyId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  listProjects(companyId = null) {
    return this.fetchAll(companyId ? `/projects?companyId=${companyId}` : '/projects', 'projects');
  },

  createProject(payload) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProject(projectId, payload) {
    return this.request(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  reclassifyMessages(projectId, messageIds) {
    return this.request(`/projects/${projectId}/reclassify-messages`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  },

  listMessages(projectId) {
    return this.fetchAll(`/messages?projectId=${projectId}`, 'messages');
  },

  createReceivedMessage(payload) {
    return this.request('/messages/received', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createReplyMessage(payload) {
    return this.request('/messages/replies', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateMessage(messageId, payload) {
    return this.request(`/messages/${messageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteMessage(messageId) {
    return this.request(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  },

  moveMessage(messageId, projectId) {
    return this.request(`/messages/${messageId}/move-project`, {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  },

  listAttachments(messageId) {
    return this.fetchAll(`/messages/${messageId}/attachments`, 'attachments');
  },

  uploadAttachment(messageId, payload) {
    return this.request(`/messages/${messageId}/attachments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteAttachment(attachmentId) {
    return this.request(`/attachments/${attachmentId}`, { method: 'DELETE' });
  },

  listSignatures() {
    return this.fetchAll('/signatures', 'signatures');
  },

  createSignature(payload) {
    return this.request('/signatures', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSignature(signatureId, payload) {
    return this.request(`/signatures/${signatureId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteSignature(signatureId) {
    return this.request(`/signatures/${signatureId}`, { method: 'DELETE' });
  },

  listSystemDictionary() {
    return this.fetchAll('/dictionaries/system', 'entries');
  },

  createSystemDictionaryEntry(payload) {
    return this.request('/dictionaries/system', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteSystemDictionaryEntry(entryId) {
    return this.request(`/dictionaries/system/${entryId}`, { method: 'DELETE' });
  },

  listCompanyDictionary(companyId) {
    return this.fetchAll(`/companies/${companyId}/dictionaries`, 'entries');
  },

  createCompanyDictionaryEntry(companyId, payload) {
    return this.request(`/companies/${companyId}/dictionaries`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteCompanyDictionaryEntry(companyId, entryId) {
    return this.request(`/companies/${companyId}/dictionaries/${entryId}`, { method: 'DELETE' });
  },

  searchCompanies(q) {
    return this.fetchAll(`/search/companies?q=${encodeURIComponent(q)}`, 'companies');
  },

  searchProjects(q) {
    return this.fetchAll(`/search/projects?q=${encodeURIComponent(q)}`, 'projects');
  },

  searchMessages(q) {
    return this.fetchAll(`/search/messages?q=${encodeURIComponent(q)}`, 'messages');
  },

  detectLanguage(text) {
    return this.request('/ai/detect-language', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  translate(payload) {
    return this.request('/ai/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  generateDraft(payload) {
    return this.request('/ai/draft', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};
