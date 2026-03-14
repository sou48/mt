const express = require('express');
const path = require('path');
const { deleteAttachmentFile, resolveAttachmentPath, saveAttachment } = require('../../lib/attachments');
const { buildMessageAccessWhere, getCurrentUser } = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { toPublicAttachment } = require('../../utils/serialize');

const router = express.Router();

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

router.post('/messages/:messageId/attachments', async (req, res) => {
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

  const { originalName, mimeType = 'application/octet-stream', contentBase64 } = req.body || {};
  if (!originalName || !contentBase64) {
    return res.status(400).json({
      message: 'ファイル名と Base64 データは必須です。',
    });
  }

  const saved = await saveAttachment({ originalName, contentBase64 });
  const attachment = await prisma.attachment.create({
    data: {
      messageId: messageResult.messageId,
      originalName,
      storedPath: saved.storedPath,
      mimeType,
      fileSize: saved.fileSize,
      uploadedByUserId: currentUser.id,
    },
  });

  return res.status(201).json({
    attachment: toPublicAttachment(attachment),
  });
});

router.get('/messages/:messageId/attachments', async (req, res) => {
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
  const where = {
    messageId: messageResult.messageId,
    deletedAt: null,
  };
  const [total, attachments] = await Promise.all([
    prisma.attachment.count({ where }),
    prisma.attachment.findMany({
      where,
      orderBy: {
        createdAt: 'asc',
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    attachments: attachments.map(toPublicAttachment),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.get('/attachments/:attachmentId/download', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const attachmentId = parseBigIntValue(req.params.attachmentId);
  if (!attachmentId) {
    return res.status(400).json({
      message: '添付 ID が不正です。',
    });
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      deletedAt: null,
      message: buildMessageAccessWhere(currentUser),
    },
  });

  if (!attachment) {
    return res.status(404).json({
      message: '添付ファイルが見つかりません。',
    });
  }

  res.setHeader('content-type', attachment.mimeType);
  res.setHeader(
    'content-disposition',
    `attachment; filename=\"${encodeURIComponent(path.basename(attachment.originalName))}\"`
  );
  return res.sendFile(resolveAttachmentPath(attachment.storedPath));
});

router.delete('/attachments/:attachmentId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const attachmentId = parseBigIntValue(req.params.attachmentId);
  if (!attachmentId) {
    return res.status(400).json({
      message: '添付 ID が不正です。',
    });
  }

  const attachment = await prisma.attachment.findFirst({
    where: {
      id: attachmentId,
      deletedAt: null,
      message: buildMessageAccessWhere(currentUser),
    },
  });

  if (!attachment) {
    return res.status(404).json({
      message: '添付ファイルが見つかりません。',
    });
  }

  await prisma.attachment.update({
    where: {
      id: attachmentId,
    },
    data: {
      deletedAt: new Date(),
    },
  });
  await deleteAttachmentFile(attachment.storedPath);

  return res.json({
    ok: true,
  });
});

module.exports = router;
