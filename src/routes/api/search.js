const express = require('express');
const {
  buildCompanyAccessWhere,
  buildMessageAccessWhere,
  buildProjectAccessWhere,
} = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const {
  toPublicCompany,
  toPublicMessage,
  toPublicProject,
} = require('../../utils/serialize');

const router = express.Router();

function normalizeSearchTerm(value) {
  return typeof value === 'string' ? value.trim() : '';
}

router.get('/companies', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const q = normalizeSearchTerm(req.query.q);
  if (!q) {
    return res.status(400).json({ message: '検索語は必須です。' });
  }

  const pagination = getPaginationParams(req.query);
  const where = {
    ...buildCompanyAccessWhere(currentUser),
    name: {
      contains: q,
      mode: 'insensitive',
    },
  };

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    companies: companies.map(toPublicCompany),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.get('/projects', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const q = normalizeSearchTerm(req.query.q);
  if (!q) {
    return res.status(400).json({ message: '検索語は必須です。' });
  }

  const pagination = getPaginationParams(req.query);
  const where = {
    ...buildProjectAccessWhere(currentUser),
    name: {
      contains: q,
      mode: 'insensitive',
    },
  };

  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: {
        company: true,
        userProjects: {
          where: { deletedAt: null },
          include: { user: { include: { company: true } } },
        },
      },
      orderBy: [{ isUnclassified: 'desc' }, { name: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    projects: projects.map(toPublicProject),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.get('/messages', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const q = normalizeSearchTerm(req.query.q);
  if (!q) {
    return res.status(400).json({ message: '検索語は必須です。' });
  }

  const pagination = getPaginationParams(req.query);
  const where = {
    ...buildMessageAccessWhere(currentUser),
    OR: [
      { sourceText: { contains: q, mode: 'insensitive' } },
      { translatedText: { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
      { sourceSenderName: { contains: q, mode: 'insensitive' } },
      { sourceSenderAddressOrAccount: { contains: q, mode: 'insensitive' } },
    ],
  };

  const [total, messages] = await Promise.all([
    prisma.message.count({ where }),
    prisma.message.findMany({
      where,
      orderBy: [{ sourceSentAt: 'desc' }, { createdAt: 'desc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    messages: messages.map(toPublicMessage),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

module.exports = router;
