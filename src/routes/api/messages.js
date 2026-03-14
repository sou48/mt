const express = require('express');
const { buildMessageAccessWhere, buildProjectAccessWhere, getCurrentUser } = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { createMessageHistory } = require('../../lib/history');
const { toPublicHistory, toPublicMessage } = require('../../utils/serialize');

const router = express.Router();
const REPLY_TYPES = new Set(['reply', 'draft']);

async function findAccessibleProject(prisma, currentUser, rawProjectId) {
  const projectId = parseBigIntValue(rawProjectId);
  if (!projectId) {
    return { error: '案件 ID が不正です。' };
  }

  const project = await prisma.project.findFirst({
    where: {
      ...buildProjectAccessWhere(currentUser),
      id: projectId,
    },
  });

  if (!project) {
    return { error: '案件が見つかりません。' };
  }

  return { project };
}

async function findAccessibleMessage(prisma, currentUser, rawMessageId) {
  const messageId = parseBigIntValue(rawMessageId);
  if (!messageId) {
    return { error: 'メッセージ ID が不正です。' };
  }

  const message = await prisma.message.findFirst({
    where: {
      ...buildMessageAccessWhere(currentUser),
      id: messageId,
    },
  });

  if (!message) {
    return { error: 'メッセージが見つかりません。' };
  }

  return { message, messageId };
}

async function resolveSignature(prisma, currentUser, rawSignatureId) {
  if (rawSignatureId === undefined || rawSignatureId === null || rawSignatureId === '') {
    return { signature: null };
  }

  const signatureId = parseBigIntValue(rawSignatureId);
  if (!signatureId) {
    return { error: '署名 ID が不正です。' };
  }

  const signature = await prisma.signature.findFirst({
    where: {
      id: signatureId,
      userId: currentUser.id,
      deletedAt: null,
    },
  });

  if (!signature) {
    return { error: '署名が見つかりません。' };
  }

  return { signature };
}

router.get('/', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const projectId = parseBigIntValue(req.query.projectId);
  if (!projectId) {
    return res.status(400).json({
      message: '案件 ID は必須です。',
    });
  }

  const projectResult = await findAccessibleProject(prisma, currentUser, projectId);
  if (projectResult.error) {
    return res.status(projectResult.error.includes('不正') ? 400 : 404).json({
      message: projectResult.error,
    });
  }

  const pagination = getPaginationParams(req.query);
  const where = {
    ...buildMessageAccessWhere(currentUser),
    projectId,
  };
  const [total, messages] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      orderBy: [{ sourceSentAt: 'asc' }, { createdAt: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    messages: messages.map(toPublicMessage),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.get('/:messageId/histories', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const messageResult = await findAccessibleMessage(prisma, currentUser, req.params.messageId);
  if (messageResult.error) {
    return res.status(messageResult.error.includes('不正') ? 400 : 404).json({
      message: messageResult.error,
    });
  }

  const pagination = getPaginationParams(req.query);
  const where = { messageId: messageResult.messageId };
  const [total, histories] = await Promise.all([
    prisma.messageHistory.count({ where }),
    prisma.messageHistory.findMany({
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

router.post('/received', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const {
    projectId,
    channelType,
    subject = null,
    sourceSenderName = null,
    sourceSenderAddressOrAccount = null,
    sourceSentAt = null,
    sourceText,
    sourceLanguage = null,
    translatedText = null,
    translatedLanguage = null,
    japaneseText = null,
    partnerText = null,
    languagePair = null,
  } = req.body || {};

  const projectResult = await findAccessibleProject(prisma, currentUser, projectId);
  if (projectResult.error) {
    return res.status(projectResult.error.includes('不正') ? 400 : 404).json({
      message: projectResult.error,
    });
  }

  if (!channelType || !sourceText) {
    return res.status(400).json({
      message: 'チャネル種別と原文は必須です。',
    });
  }

  const message = await prisma.message.create({
    data: {
      projectId: projectResult.project.id,
      messageType: 'received',
      channelType,
      subject,
      sourceSenderName,
      sourceSenderAddressOrAccount,
      sourceSentAt: sourceSentAt ? new Date(sourceSentAt) : null,
      registeredByUserId: currentUser.id,
      sourceText,
      sourceLanguage,
      translatedText,
      translatedLanguage,
      japaneseText,
      partnerText,
      languagePair,
    },
  });

  return res.status(201).json({
    message: toPublicMessage(message),
  });
});

router.post('/replies', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const {
    projectId,
    messageType,
    channelType,
    subject = null,
    japaneseText = null,
    partnerText = null,
    translatedText = null,
    translatedLanguage = null,
    sourceText = null,
    sourceLanguage = null,
    languagePair = null,
    signatureId = null,
  } = req.body || {};

  const projectResult = await findAccessibleProject(prisma, currentUser, projectId);
  if (projectResult.error) {
    return res.status(projectResult.error.includes('不正') ? 400 : 404).json({
      message: projectResult.error,
    });
  }

  if (!REPLY_TYPES.has(messageType) || !channelType) {
    return res.status(400).json({
      message: 'メッセージ種別は reply または draft、チャネル種別は必須です。',
    });
  }

  if (!japaneseText && !partnerText && !translatedText) {
    return res.status(400).json({
      message: '返信本文または下書き本文を入力してください。',
    });
  }

  const signatureResult = await resolveSignature(prisma, currentUser, signatureId);
  if (signatureResult.error) {
    return res.status(400).json({
      message: signatureResult.error,
    });
  }

  const signature = signatureResult.signature;
  const signatureSnapshot = signature
    ? [signature.japaneseText, signature.partnerText].filter(Boolean).join('\n\n')
    : null;

  const message = await prisma.message.create({
    data: {
      projectId: projectResult.project.id,
      messageType,
      channelType,
      subject,
      createdByUserId: currentUser.id,
      sourceText,
      sourceLanguage,
      translatedText: translatedText || partnerText,
      translatedLanguage,
      japaneseText,
      partnerText,
      languagePair,
      signatureId: signature?.id || null,
      signatureSnapshot,
    },
  });

  return res.status(201).json({
    message: toPublicMessage(message),
  });
});

router.patch('/:messageId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const messageResult = await findAccessibleMessage(prisma, currentUser, req.params.messageId);
  if (messageResult.error) {
    return res.status(messageResult.error.includes('不正') ? 400 : 404).json({
      message: messageResult.error,
    });
  }

  if (!REPLY_TYPES.has(messageResult.message.messageType)) {
    return res.status(400).json({
      message: '受信メッセージは更新できません。',
    });
  }

  const signatureResult = await resolveSignature(prisma, currentUser, req.body?.signatureId);
  if (signatureResult.error) {
    return res.status(400).json({
      message: signatureResult.error,
    });
  }

  const signature = signatureResult.signature;
  const updated = await prisma.$transaction(async (tx) => {
    await createMessageHistory(tx, messageResult.message, currentUser.id);

    return tx.message.update({
      where: {
        id: messageResult.messageId,
      },
      data: {
        subject: req.body?.subject ?? messageResult.message.subject,
        sourceText: req.body?.sourceText ?? messageResult.message.sourceText,
        sourceLanguage: req.body?.sourceLanguage ?? messageResult.message.sourceLanguage,
        translatedText: req.body?.translatedText ?? req.body?.partnerText ?? messageResult.message.translatedText,
        translatedLanguage: req.body?.translatedLanguage ?? messageResult.message.translatedLanguage,
        japaneseText: req.body?.japaneseText ?? messageResult.message.japaneseText,
        partnerText: req.body?.partnerText ?? messageResult.message.partnerText,
        languagePair: req.body?.languagePair ?? messageResult.message.languagePair,
        signatureId:
          req.body && Object.prototype.hasOwnProperty.call(req.body, 'signatureId')
            ? signature?.id || null
            : messageResult.message.signatureId,
        signatureSnapshot:
          req.body && Object.prototype.hasOwnProperty.call(req.body, 'signatureId')
            ? signature
              ? [signature.japaneseText, signature.partnerText].filter(Boolean).join('\n\n')
              : null
            : messageResult.message.signatureSnapshot,
        messageType:
          req.body?.messageType && REPLY_TYPES.has(req.body.messageType)
            ? req.body.messageType
            : messageResult.message.messageType,
      },
    });
  });

  return res.json({
    message: toPublicMessage(updated),
  });
});

router.delete('/:messageId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const messageResult = await findAccessibleMessage(prisma, currentUser, req.params.messageId);
  if (messageResult.error) {
    return res.status(messageResult.error.includes('不正') ? 400 : 404).json({
      message: messageResult.error,
    });
  }

  await prisma.$transaction(async (tx) => {
    await createMessageHistory(tx, messageResult.message, currentUser.id);
    await tx.message.update({
      where: {
        id: messageResult.messageId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  });

  return res.json({
    ok: true,
  });
});

router.post('/:messageId/move-project', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const messageResult = await findAccessibleMessage(prisma, currentUser, req.params.messageId);
  if (messageResult.error) {
    return res.status(messageResult.error.includes('不正') ? 400 : 404).json({
      message: messageResult.error,
    });
  }

  const targetProjectResult = await findAccessibleProject(prisma, currentUser, req.body?.projectId);
  if (targetProjectResult.error) {
    return res.status(targetProjectResult.error.includes('不正') ? 400 : 404).json({
      message: targetProjectResult.error,
    });
  }

  if (messageResult.message.projectId.toString() === targetProjectResult.project.id.toString()) {
    return res.json({
      message: toPublicMessage(messageResult.message),
    });
  }

  const sourceProject = await prisma.project.findUnique({
    where: {
      id: messageResult.message.projectId,
    },
  });

  if (!sourceProject || sourceProject.companyId !== targetProjectResult.project.companyId) {
    return res.status(400).json({
      message: '同一会社内の案件にだけ移動できます。',
    });
  }

  const moved = await prisma.$transaction(async (tx) => {
    await createMessageHistory(tx, messageResult.message, currentUser.id);
    return tx.message.update({
      where: {
        id: messageResult.messageId,
      },
      data: {
        projectId: targetProjectResult.project.id,
      },
    });
  });

  return res.json({
    message: toPublicMessage(moved),
  });
});

module.exports = router;
