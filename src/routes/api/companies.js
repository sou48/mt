const express = require('express');
const { buildCompanyAccessWhere, getCurrentUser } = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { ensureUnclassifiedProject } = require('../../lib/project-rules');
const { collectSimilarNameWarnings } = require('../../lib/similarity');
const { toPublicCompany } = require('../../utils/serialize');

const router = express.Router();

function normalizeCompanyName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function parseCompanyId(rawCompanyId) {
  try {
    return BigInt(rawCompanyId);
  } catch (_error) {
    return null;
  }
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

  const pagination = getPaginationParams(req.query);
  const where = buildCompanyAccessWhere(currentUser);
  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    companies: companies.map(toPublicCompany),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.post('/', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const name = normalizeCompanyName(req.body?.name);
  if (!name) {
    return res.status(400).json({
      message: '会社名は必須です。',
    });
  }

  const duplicate = await prisma.company.findFirst({
    where: {
      name,
      deletedAt: null,
    },
  });

  if (duplicate) {
    return res.status(409).json({
      message: '同名の会社が既に存在します。',
    });
  }

  const similarCompanies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      name: {
        contains: name,
        mode: 'insensitive',
      },
    },
    select: {
      name: true,
    },
    take: 5,
  });
  const warnings = collectSimilarNameWarnings({
    type: 'company',
    currentName: name,
    candidates: similarCompanies,
  });

  const company = await prisma.$transaction(async (tx) => {
    const createdCompany = await tx.company.create({
      data: {
        name,
      },
    });

    await ensureUnclassifiedProject(tx, {
      companyId: createdCompany.id,
      createdByUserId: currentUser.id,
    });

    return createdCompany;
  });

  return res.status(201).json({
    company: toPublicCompany(company),
    warnings,
  });
});

router.get('/:companyId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const companyId = parseCompanyId(req.params.companyId);
  if (!companyId) {
    return res.status(400).json({
      message: '会社 ID が不正です。',
    });
  }

  const company = await prisma.company.findFirst({
    where: {
      ...buildCompanyAccessWhere(currentUser),
      id: companyId,
    },
  });

  if (!company) {
    return res.status(404).json({
      message: '会社が見つかりません。',
    });
  }

  return res.json({
    company: toPublicCompany(company),
  });
});

router.patch('/:companyId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const companyId = parseCompanyId(req.params.companyId);
  if (!companyId) {
    return res.status(400).json({
      message: '会社 ID が不正です。',
    });
  }

  const company = await prisma.company.findFirst({
    where: {
      ...buildCompanyAccessWhere(currentUser),
      id: companyId,
    },
  });

  if (!company) {
    return res.status(404).json({
      message: '会社が見つかりません。',
    });
  }

  const name = normalizeCompanyName(req.body?.name);
  if (!name) {
    return res.status(400).json({
      message: '会社名は必須です。',
    });
  }

  const duplicate = await prisma.company.findFirst({
    where: {
      name,
      deletedAt: null,
      id: {
        not: companyId,
      },
    },
  });

  if (duplicate) {
    return res.status(409).json({
      message: '同名の会社が既に存在します。',
    });
  }

  const similarCompanies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      id: {
        not: companyId,
      },
    },
    select: {
      name: true,
    },
    take: 20,
  });
  const warnings = collectSimilarNameWarnings({
    type: 'company',
    currentName: name,
    candidates: similarCompanies,
  });

  const updated = await prisma.company.update({
    where: {
      id: companyId,
    },
    data: {
      name,
    },
  });

  return res.json({
    company: toPublicCompany(updated),
    warnings,
  });
});

module.exports = router;
