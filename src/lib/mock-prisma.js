const bcrypt = require('bcrypt');
const { env } = require('../config/env');

const demoPasswordHash = bcrypt.hashSync(process.env.ADMIN_BOOTSTRAP_PASSWORD || 'change-me-now', 10);

const state = {
  counters: {
    company: 2n,
    user: 2n,
    project: 2n,
    userProject: 2n,
    message: 1n,
    attachment: 1n,
    signature: 1n,
    dictionaryEntry: 1n,
    messageHistory: 1n,
    signatureHistory: 1n,
    dictionaryEntryHistory: 1n,
  },
  companies: [],
  users: [],
  projects: [],
  userProjects: [],
  messages: [],
  attachments: [],
  signatures: [],
  dictionaryEntries: [],
  messageHistories: [],
  signatureHistories: [],
  dictionaryEntryHistories: [],
};

function now() {
  return new Date();
}

function nextId(key) {
  const value = state.counters[key];
  state.counters[key] += 1n;
  return value;
}

function seed() {
  if (state.users.length > 0) return;

  const company = {
    id: 1n,
    name: process.env.ADMIN_BOOTSTRAP_COMPANY_NAME || 'MT管理会社',
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  const user = {
    id: 1n,
    companyId: company.id,
    email: process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@example.com',
    displayName: process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || '初期管理者',
    role: 'admin',
    passwordHash: demoPasswordHash,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  const project = {
    id: 1n,
    companyId: company.id,
    name: '初期案件',
    isUnclassified: false,
    createdByUserId: user.id,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  const assignment = {
    id: 1n,
    userId: user.id,
    projectId: project.id,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };
  const signature = {
    id: 1n,
    userId: user.id,
    name: '基本署名',
    japaneseText: '初期管理者\nMultiTranslate',
    partnerText: 'Admin\nMultiTranslate',
    isDefault: true,
    createdAt: now(),
    updatedAt: now(),
    deletedAt: null,
  };

  state.companies.push(company);
  state.users.push(user);
  state.projects.push(project);
  state.userProjects.push(assignment);
  state.signatures.push(signature);
}

seed();

function clone(record) {
  if (!record) return record;
  return JSON.parse(
    JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );
}

function normalizeComparable(value) {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

function equalsValue(actual, expected) {
  return normalizeComparable(actual) === normalizeComparable(expected);
}

function containsValue(actual, expected, mode) {
  const left = String(actual || '');
  const right = String(expected || '');
  if (mode === 'insensitive') {
    return left.toLowerCase().includes(right.toLowerCase());
  }
  return left.includes(right);
}

function resolveRelations(model, record) {
  switch (model) {
    case 'user':
      return {
        company: state.companies.find((item) => equalsValue(item.id, record.companyId)) || null,
      };
    case 'project':
      return {
        company: state.companies.find((item) => equalsValue(item.id, record.companyId)) || null,
        userProjects: state.userProjects.filter((item) => equalsValue(item.projectId, record.id)),
      };
    case 'userProject':
      return {
        user: state.users.find((item) => equalsValue(item.id, record.userId)) || null,
        project: state.projects.find((item) => equalsValue(item.id, record.projectId)) || null,
      };
    case 'message':
      return {
        project: state.projects.find((item) => equalsValue(item.id, record.projectId)) || null,
        attachments: state.attachments.filter((item) => equalsValue(item.messageId, record.id)),
      };
    case 'attachment':
      return {
        message: state.messages.find((item) => equalsValue(item.id, record.messageId)) || null,
      };
    case 'signatureHistory':
    case 'messageHistory':
    case 'dictionaryEntryHistory':
      return {
        changedByUser: state.users.find((item) => equalsValue(item.id, record.changedByUserId)) || null,
      };
    default:
      return {};
  }
}

function matchesWhere(model, record, where) {
  if (!where) return true;

  if (where.OR) {
    return where.OR.some((entry) => matchesWhere(model, record, entry));
  }

  if (where.AND) {
    return where.AND.every((entry) => matchesWhere(model, record, entry));
  }

  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR' || key === 'AND') return true;

    const relations = resolveRelations(model, record);
    if (relations[key] !== undefined) {
      const relationValue = relations[key];
      if (Array.isArray(relationValue)) {
        if (expected?.some) {
          return relationValue.some((entry) => matchesWhere(key === 'userProjects' ? 'userProject' : key, entry, expected.some));
        }
        return false;
      }
      return relationValue ? matchesWhere(key, relationValue, expected) : expected === null;
    }

    const actual = record[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date) && !Array.isArray(expected)) {
      if (Object.prototype.hasOwnProperty.call(expected, 'contains')) {
        return containsValue(actual, expected.contains, expected.mode);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'in')) {
        return expected.in.some((item) => equalsValue(actual, item));
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'not')) {
        return !equalsValue(actual, expected.not);
      }
      if (Object.prototype.hasOwnProperty.call(expected, 'gt')) {
        return actual > expected.gt;
      }
      return matchesWhere(model, actual || {}, expected);
    }

    return equalsValue(actual, expected);
  });
}

function applyOrderBy(items, orderBy) {
  const rules = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return [...items].sort((left, right) => {
    for (const rule of rules) {
      const [field, direction] = Object.entries(rule)[0];
      const l = normalizeComparable(left[field]);
      const r = normalizeComparable(right[field]);
      if (l === r) continue;
      const compare = l > r ? 1 : -1;
      return direction === 'desc' ? -compare : compare;
    }
    return 0;
  });
}

function applyInclude(model, record, include) {
  if (!record) return null;
  const next = { ...record };
  if (!include) return next;

  const relations = resolveRelations(model, record);
  for (const [key, config] of Object.entries(include)) {
    let value = relations[key];
    if (Array.isArray(value)) {
      let relationModel = key === 'userProjects' ? 'userProject' : key;
      if (config?.where) {
        value = value.filter((entry) => matchesWhere(relationModel, entry, config.where));
      }
      if (config?.include) {
        value = value.map((entry) => applyInclude(relationModel, entry, config.include));
      }
    } else if (value && config?.include) {
      value = applyInclude(key, value, config.include);
    }
    next[key] = value;
  }
  return next;
}

function applySelect(record, select) {
  if (!select) return record;
  const next = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) next[key] = record[key];
  }
  return next;
}

function listFor(model) {
  switch (model) {
    case 'company':
      return state.companies;
    case 'user':
      return state.users;
    case 'project':
      return state.projects;
    case 'userProject':
      return state.userProjects;
    case 'message':
      return state.messages;
    case 'attachment':
      return state.attachments;
    case 'signature':
      return state.signatures;
    case 'dictionaryEntry':
      return state.dictionaryEntries;
    case 'messageHistory':
      return state.messageHistories;
    case 'signatureHistory':
      return state.signatureHistories;
    case 'dictionaryEntryHistory':
      return state.dictionaryEntryHistories;
    default:
      throw new Error(`Unsupported mock model: ${model}`);
  }
}

function createBaseModel(model, keyName) {
  const list = listFor(model);
  return {
    async count({ where } = {}) {
      return list.filter((record) => matchesWhere(model, record, where)).length;
    },
    async findMany({ where, include, orderBy, skip = 0, take, select } = {}) {
      let items = list.filter((record) => matchesWhere(model, record, where));
      items = applyOrderBy(items, orderBy);
      if (typeof skip === 'number' && skip > 0) items = items.slice(skip);
      if (typeof take === 'number') items = items.slice(0, take);
      return items.map((record) => clone(applySelect(applyInclude(model, record, include), select)));
    },
    async findFirst({ where, include, select } = {}) {
      const record = list.find((item) => matchesWhere(model, item, where));
      return clone(applySelect(applyInclude(model, record, include), select));
    },
    async findUnique({ where, include, select } = {}) {
      if (!where) return null;
      const record = list.find((item) => Object.entries(where).every(([key, value]) => equalsValue(item[key], value)));
      return clone(applySelect(applyInclude(model, record, include), select));
    },
    async create({ data, include } = {}) {
      const timestamp = now();
      const record = {
        id: nextId(keyName),
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
        ...data,
      };
      list.push(record);
      return clone(applyInclude(model, record, include));
    },
    async update({ where, data, include } = {}) {
      const record = list.find((item) => Object.entries(where).every(([key, value]) => equalsValue(item[key], value)));
      if (!record) {
        throw new Error(`${model} not found`);
      }
      Object.assign(record, data, { updatedAt: now() });
      return clone(applyInclude(model, record, include));
    },
    async updateMany({ where, data } = {}) {
      const items = list.filter((record) => matchesWhere(model, record, where));
      items.forEach((record) => Object.assign(record, data, { updatedAt: now() }));
      return { count: items.length };
    },
  };
}

const mockPrisma = {
  __isMock: true,
  async $queryRaw() {
    return [{ ok: 1 }];
  },
  async $disconnect() {},
  async $transaction(arg) {
    if (typeof arg === 'function') {
      return arg(mockPrisma);
    }
    return Promise.all(arg);
  },
  company: createBaseModel('company', 'company'),
  user: {
    ...createBaseModel('user', 'user'),
    async findMany({ where, include } = {}) {
      return createBaseModel('user', 'user').findMany({ where, include });
    },
  },
  project: {
    ...createBaseModel('project', 'project'),
    async create({ data, include } = {}) {
      const timestamp = now();
      const record = {
        id: nextId('project'),
        companyId: data.companyId,
        name: data.name,
        isUnclassified: data.isUnclassified === true,
        createdByUserId: data.createdByUserId || null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      state.projects.push(record);
      if (data.userProjects?.create) {
        state.userProjects.push({
          id: nextId('userProject'),
          userId: data.userProjects.create.userId,
          projectId: record.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: null,
        });
      }
      return clone(applyInclude('project', record, include));
    },
  },
  userProject: createBaseModel('userProject', 'userProject'),
  message: createBaseModel('message', 'message'),
  attachment: createBaseModel('attachment', 'attachment'),
  signature: createBaseModel('signature', 'signature'),
  dictionaryEntry: createBaseModel('dictionaryEntry', 'dictionaryEntry'),
  messageHistory: createBaseModel('messageHistory', 'messageHistory'),
  signatureHistory: createBaseModel('signatureHistory', 'signatureHistory'),
  dictionaryEntryHistory: createBaseModel('dictionaryEntryHistory', 'dictionaryEntryHistory'),
};

module.exports = {
  mockPrisma,
  state,
};
