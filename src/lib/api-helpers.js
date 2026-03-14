const { getCurrentUser } = require('./auth');
const { getPrismaClient } = require('./prisma');

function getConfiguredPrisma(res) {
  const prisma = getPrismaClient();

  if (!prisma) {
    res.status(503).json({
      message: 'データベースが未設定です。',
    });
    return null;
  }

  return prisma;
}

async function requireCurrentUser(req, res) {
  const user = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({
      message: '未ログインです。',
    });
    return null;
  }

  return user;
}

function parseBigIntValue(rawValue) {
  try {
    return BigInt(rawValue);
  } catch (_error) {
    return null;
  }
}

function getPaginationParams(query) {
  const page = Math.max(Number(query.page || 1) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize || 20) || 20, 1), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

function buildPaginationMeta(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

module.exports = {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
};
