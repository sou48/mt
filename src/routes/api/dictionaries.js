const express = require('express');
const {
  buildCompanyDictionaryAccessWhere,
} = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { createDictionaryEntryHistory } = require('../../lib/history');
const { toPublicDictionaryEntry, toPublicHistory } = require('../../utils/serialize');

const router = express.Router();

function normalizeEntryPayload(body) {
  return {
    sourceTerm: typeof body?.sourceTerm === 'string' ? body.sourceTerm.trim() : '',
    targetTerm: typeof body?.targetTerm === 'string' ? body.targetTerm.trim() : '',
    note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null,
    languagePair: typeof body?.languagePair === 'string' ? body.languagePair.trim() : '',
  };
}

async function listEntries(res, prisma, where, query) {
  const pagination = getPaginationParams(query);
  const [total, entries] = await Promise.all([
    prisma.dictionaryEntry.count({ where }),
    prisma.dictionaryEntry.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    entries: entries.map(toPublicDictionaryEntry),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
}

async function listEntryHistories(res, prisma, where, query) {
  const pagination = getPaginationParams(query);
  const [total, histories] = await Promise.all([
    prisma.dictionaryEntryHistory.count({ where }),
    prisma.dictionaryEntryHistory.findMany({
      where,
      include: {
        changedByUser: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    histories: histories.map(toPublicHistory),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
}

router.get('/dictionaries/system', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  return listEntries(
    res,
    prisma,
    {
      scopeType: 'system',
      companyId: null,
      deletedAt: null,
    },
    req.query
  );
});

router.get('/dictionaries/system/:entryId/histories', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const entryId = parseBigIntValue(req.params.entryId);
  if (!entryId) {
    return res.status(400).json({ message: '辞書 ID が不正です。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'system', companyId: null, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  return listEntryHistories(res, prisma, { dictionaryEntryId: entryId }, req.query);
});

router.post('/dictionaries/system', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const payload = normalizeEntryPayload(req.body);
  if (!payload.sourceTerm || !payload.targetTerm || !payload.languagePair) {
    return res.status(400).json({ message: '原文、訳語、言語ペアは必須です。' });
  }

  const entry = await prisma.dictionaryEntry.create({
    data: {
      scopeType: 'system',
      companyId: null,
      sourceTerm: payload.sourceTerm,
      targetTerm: payload.targetTerm,
      note: payload.note,
      languagePair: payload.languagePair,
      createdByUserId: currentUser.id,
      updatedByUserId: currentUser.id,
    },
  });

  return res.status(201).json({
    entry: toPublicDictionaryEntry(entry),
  });
});

router.patch('/dictionaries/system/:entryId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const entryId = parseBigIntValue(req.params.entryId);
  if (!entryId) {
    return res.status(400).json({ message: '辞書 ID が不正です。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'system', companyId: null, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  const payload = normalizeEntryPayload({ ...entry, ...req.body });
  if (!payload.sourceTerm || !payload.targetTerm || !payload.languagePair) {
    return res.status(400).json({ message: '原文、訳語、言語ペアは必須です。' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await createDictionaryEntryHistory(tx, entry, currentUser.id);
    return tx.dictionaryEntry.update({
      where: { id: entryId },
      data: {
        sourceTerm: payload.sourceTerm,
        targetTerm: payload.targetTerm,
        note: payload.note,
        languagePair: payload.languagePair,
        updatedByUserId: currentUser.id,
      },
    });
  });

  return res.json({
    entry: toPublicDictionaryEntry(updated),
  });
});

router.delete('/dictionaries/system/:entryId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const entryId = parseBigIntValue(req.params.entryId);
  if (!entryId) {
    return res.status(400).json({ message: '辞書 ID が不正です。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'system', companyId: null, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  await prisma.$transaction(async (tx) => {
    await createDictionaryEntryHistory(tx, entry, currentUser.id);
    await tx.dictionaryEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date(), updatedByUserId: currentUser.id },
    });
  });

  return res.json({ ok: true });
});

router.get('/companies/:companyId/dictionaries', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.params.companyId);
  if (!companyId) {
    return res.status(400).json({ message: '会社 ID が不正です。' });
  }

  const where = buildCompanyDictionaryAccessWhere(currentUser, companyId);
  if (!where) {
    return res.status(403).json({ message: '他社の会社共通辞書にはアクセスできません。' });
  }

  return listEntries(res, prisma, where, req.query);
});

router.get('/companies/:companyId/dictionaries/:entryId/histories', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.params.companyId);
  const entryId = parseBigIntValue(req.params.entryId);
  if (!companyId || !entryId) {
    return res.status(400).json({ message: '会社 ID または辞書 ID が不正です。' });
  }

  if (!buildCompanyDictionaryAccessWhere(currentUser, companyId)) {
    return res.status(403).json({ message: '他社の会社共通辞書にはアクセスできません。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'company', companyId, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  return listEntryHistories(res, prisma, { dictionaryEntryId: entryId }, req.query);
});

router.post('/companies/:companyId/dictionaries', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.params.companyId);
  if (!companyId) {
    return res.status(400).json({ message: '会社 ID が不正です。' });
  }

  if (!buildCompanyDictionaryAccessWhere(currentUser, companyId)) {
    return res.status(403).json({ message: '他社の会社共通辞書は編集できません。' });
  }

  const payload = normalizeEntryPayload(req.body);
  if (!payload.sourceTerm || !payload.targetTerm || !payload.languagePair) {
    return res.status(400).json({ message: '原文、訳語、言語ペアは必須です。' });
  }

  const entry = await prisma.dictionaryEntry.create({
    data: {
      scopeType: 'company',
      companyId,
      sourceTerm: payload.sourceTerm,
      targetTerm: payload.targetTerm,
      note: payload.note,
      languagePair: payload.languagePair,
      createdByUserId: currentUser.id,
      updatedByUserId: currentUser.id,
    },
  });

  return res.status(201).json({
    entry: toPublicDictionaryEntry(entry),
  });
});

router.patch('/companies/:companyId/dictionaries/:entryId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.params.companyId);
  const entryId = parseBigIntValue(req.params.entryId);
  if (!companyId || !entryId) {
    return res.status(400).json({ message: '会社 ID または辞書 ID が不正です。' });
  }

  if (!buildCompanyDictionaryAccessWhere(currentUser, companyId)) {
    return res.status(403).json({ message: '他社の会社共通辞書は編集できません。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'company', companyId, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  const payload = normalizeEntryPayload({ ...entry, ...req.body });
  if (!payload.sourceTerm || !payload.targetTerm || !payload.languagePair) {
    return res.status(400).json({ message: '原文、訳語、言語ペアは必須です。' });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await createDictionaryEntryHistory(tx, entry, currentUser.id);
    return tx.dictionaryEntry.update({
      where: { id: entryId },
      data: {
        sourceTerm: payload.sourceTerm,
        targetTerm: payload.targetTerm,
        note: payload.note,
        languagePair: payload.languagePair,
        updatedByUserId: currentUser.id,
      },
    });
  });

  return res.json({
    entry: toPublicDictionaryEntry(updated),
  });
});

router.delete('/companies/:companyId/dictionaries/:entryId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.params.companyId);
  const entryId = parseBigIntValue(req.params.entryId);
  if (!companyId || !entryId) {
    return res.status(400).json({ message: '会社 ID または辞書 ID が不正です。' });
  }

  if (!buildCompanyDictionaryAccessWhere(currentUser, companyId)) {
    return res.status(403).json({ message: '他社の会社共通辞書は編集できません。' });
  }

  const entry = await prisma.dictionaryEntry.findFirst({
    where: { id: entryId, scopeType: 'company', companyId, deletedAt: null },
  });
  if (!entry) {
    return res.status(404).json({ message: '辞書エントリが見つかりません。' });
  }

  await prisma.$transaction(async (tx) => {
    await createDictionaryEntryHistory(tx, entry, currentUser.id);
    await tx.dictionaryEntry.update({
      where: { id: entryId },
      data: { deletedAt: new Date(), updatedByUserId: currentUser.id },
    });
  });

  return res.json({ ok: true });
});

module.exports = router;
