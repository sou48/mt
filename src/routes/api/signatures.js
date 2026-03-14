const express = require('express');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { createSignatureHistory } = require('../../lib/history');
const { toPublicHistory, toPublicSignature } = require('../../utils/serialize');

const router = express.Router();

router.get('/', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const pagination = getPaginationParams(req.query);
  const where = {
    userId: currentUser.id,
    deletedAt: null,
  };

  const [total, signatures] = await Promise.all([
    prisma.signature.count({ where }),
    prisma.signature.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    signatures: signatures.map(toPublicSignature),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.get('/:signatureId/histories', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const signatureId = parseBigIntValue(req.params.signatureId);
  if (!signatureId) {
    return res.status(400).json({ message: '署名 ID が不正です。' });
  }

  const signature = await prisma.signature.findFirst({
    where: {
      id: signatureId,
      userId: currentUser.id,
      deletedAt: null,
    },
  });

  if (!signature) {
    return res.status(404).json({ message: '署名が見つかりません。' });
  }

  const pagination = getPaginationParams(req.query);
  const where = { signatureId };
  const [total, histories] = await Promise.all([
    prisma.signatureHistory.count({ where }),
    prisma.signatureHistory.findMany({
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
});

router.post('/', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const japaneseText = typeof req.body?.japaneseText === 'string' ? req.body.japaneseText.trim() : '';
  const partnerText =
    typeof req.body?.partnerText === 'string' && req.body.partnerText.trim()
      ? req.body.partnerText.trim()
      : null;
  const isDefault = req.body?.isDefault === true;

  if (!name || !japaneseText) {
    return res.status(400).json({
      message: '署名名と日本語本文は必須です。',
    });
  }

  const signature = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.signature.updateMany({
        where: {
          userId: currentUser.id,
          deletedAt: null,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.signature.create({
      data: {
        userId: currentUser.id,
        name,
        japaneseText,
        partnerText,
        isDefault,
      },
    });
  });

  return res.status(201).json({
    signature: toPublicSignature(signature),
  });
});

router.patch('/:signatureId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const signatureId = parseBigIntValue(req.params.signatureId);
  if (!signatureId) {
    return res.status(400).json({ message: '署名 ID が不正です。' });
  }

  const signature = await prisma.signature.findFirst({
    where: {
      id: signatureId,
      userId: currentUser.id,
      deletedAt: null,
    },
  });

  if (!signature) {
    return res.status(404).json({ message: '署名が見つかりません。' });
  }

  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : signature.name;
  const japaneseText =
    typeof req.body?.japaneseText === 'string' ? req.body.japaneseText.trim() : signature.japaneseText;
  const partnerText =
    typeof req.body?.partnerText === 'string' ? req.body.partnerText.trim() || null : signature.partnerText;
  const isDefault = req.body?.isDefault === true;

  if (!name || !japaneseText) {
    return res.status(400).json({
      message: '署名名と日本語本文は必須です。',
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await createSignatureHistory(tx, signature, currentUser.id);

    if (isDefault) {
      await tx.signature.updateMany({
        where: {
          userId: currentUser.id,
          deletedAt: null,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return tx.signature.update({
      where: { id: signatureId },
      data: {
        name,
        japaneseText,
        partnerText,
        isDefault,
      },
    });
  });

  return res.json({
    signature: toPublicSignature(updated),
  });
});

router.delete('/:signatureId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const signatureId = parseBigIntValue(req.params.signatureId);
  if (!signatureId) {
    return res.status(400).json({ message: '署名 ID が不正です。' });
  }

  const signature = await prisma.signature.findFirst({
    where: {
      id: signatureId,
      userId: currentUser.id,
      deletedAt: null,
    },
  });

  if (!signature) {
    return res.status(404).json({ message: '署名が見つかりません。' });
  }

  await prisma.$transaction(async (tx) => {
    await createSignatureHistory(tx, signature, currentUser.id);
    await tx.signature.update({
      where: { id: signatureId },
      data: { deletedAt: new Date(), isDefault: false },
    });
  });

  return res.json({ ok: true });
});

module.exports = router;
