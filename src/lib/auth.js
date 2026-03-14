const { getPrismaClient } = require('./prisma');

async function getCurrentUser(req) {
  const userId = req.session?.userId;

  if (!userId) {
    return null;
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      id: BigInt(userId),
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });
}

function isAdmin(user) {
  return user?.role === 'admin';
}

function buildCompanyAccessWhere(user) {
  if (isAdmin(user)) {
    return {
      deletedAt: null,
    };
  }

  return {
    deletedAt: null,
    projects: {
      some: {
        deletedAt: null,
        userProjects: {
          some: {
            userId: user.id,
            deletedAt: null,
          },
        },
      },
    },
  };
}

function buildProjectAccessWhere(user) {
  if (isAdmin(user)) {
    return {
      deletedAt: null,
    };
  }

  return {
    deletedAt: null,
    userProjects: {
      some: {
        userId: user.id,
        deletedAt: null,
      },
    },
  };
}

function buildMessageAccessWhere(user) {
  return {
    deletedAt: null,
    project: buildProjectAccessWhere(user),
  };
}

function buildCompanyDictionaryAccessWhere(user, companyId) {
  if (isAdmin(user) || user.companyId === companyId) {
    return {
      deletedAt: null,
      scopeType: 'company',
      companyId,
    };
  }

  return null;
}

module.exports = {
  buildCompanyAccessWhere,
  buildCompanyDictionaryAccessWhere,
  buildMessageAccessWhere,
  buildProjectAccessWhere,
  getCurrentUser,
  isAdmin,
};
