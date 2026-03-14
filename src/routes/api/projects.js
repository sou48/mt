const express = require('express');
const { buildCompanyAccessWhere, buildProjectAccessWhere } = require('../../lib/auth');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { collectSimilarNameWarnings } = require('../../lib/similarity');
const { toPublicProject } = require('../../utils/serialize');

const router = express.Router();

function normalizeProjectName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

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
    include: {
      company: true,
      userProjects: {
        where: {
          deletedAt: null,
        },
        include: {
          user: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    return { error: '案件が見つかりません。' };
  }

  return { project, projectId };
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

  const companyId = req.query.companyId ? parseBigIntValue(req.query.companyId) : null;
  if (req.query.companyId && !companyId) {
    return res.status(400).json({
      message: '会社 ID が不正です。',
    });
  }

  const pagination = getPaginationParams(req.query);
  const where = {
    ...buildProjectAccessWhere(currentUser),
    ...(companyId ? { companyId } : {}),
  };
  const [total, projects] = await Promise.all([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: {
        company: true,
        userProjects: {
          where: {
            deletedAt: null,
          },
          include: {
            user: {
              include: {
                company: true,
              },
            },
          },
        },
      },
      orderBy: [
        {
          isUnclassified: 'desc',
        },
        {
          name: 'asc',
        },
      ],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    projects: projects.map(toPublicProject),
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

  const companyId = parseBigIntValue(req.body?.companyId);
  const name = normalizeProjectName(req.body?.name);

  if (!companyId) {
    return res.status(400).json({
      message: '会社 ID は必須です。',
    });
  }

  if (!name) {
    return res.status(400).json({
      message: '案件名は必須です。',
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

  const duplicate = await prisma.project.findFirst({
    where: {
      companyId,
      name,
      deletedAt: null,
    },
  });

  if (duplicate) {
    return res.status(409).json({
      message: '同一会社内に同名の案件が既に存在します。',
    });
  }

  const similarProjects = await prisma.project.findMany({
    where: {
      companyId,
      deletedAt: null,
    },
    select: {
      name: true,
    },
    take: 20,
  });
  const warnings = collectSimilarNameWarnings({
    type: 'project',
    currentName: name,
    candidates: similarProjects,
  });

  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      isUnclassified: false,
      createdByUserId: currentUser.id,
      userProjects: {
        create: {
          userId: currentUser.id,
        },
      },
    },
    include: {
      company: true,
      userProjects: {
        where: {
          deletedAt: null,
        },
        include: {
          user: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  return res.status(201).json({
    project: toPublicProject(project),
    warnings,
  });
});

router.get('/:projectId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const { error, project } = await findAccessibleProject(prisma, currentUser, req.params.projectId);
  if (error) {
    return res.status(error.includes('不正') ? 400 : 404).json({ message: error });
  }

  return res.json({
    project: toPublicProject(project),
  });
});

router.patch('/:projectId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const result = await findAccessibleProject(prisma, currentUser, req.params.projectId);
  if (result.error) {
    return res.status(result.error.includes('不正') ? 400 : 404).json({ message: result.error });
  }

  const { project, projectId } = result;
  if (project.isUnclassified) {
    return res.status(400).json({
      message: '未分類仮案件は更新できません。',
    });
  }

  const name = normalizeProjectName(req.body?.name);
  if (!name) {
    return res.status(400).json({
      message: '案件名は必須です。',
    });
  }

  const duplicate = await prisma.project.findFirst({
    where: {
      companyId: project.companyId,
      name,
      deletedAt: null,
      id: {
        not: projectId,
      },
    },
  });

  if (duplicate) {
    return res.status(409).json({
      message: '同一会社内に同名の案件が既に存在します。',
    });
  }

  const similarProjects = await prisma.project.findMany({
    where: {
      companyId: project.companyId,
      deletedAt: null,
      id: {
        not: projectId,
      },
    },
    select: {
      name: true,
    },
    take: 20,
  });
  const warnings = collectSimilarNameWarnings({
    type: 'project',
    currentName: name,
    candidates: similarProjects,
  });

  const updated = await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      name,
    },
    include: {
      company: true,
      userProjects: {
        where: {
          deletedAt: null,
        },
        include: {
          user: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  return res.json({
    project: toPublicProject(updated),
    warnings,
  });
});

router.post('/:projectId/assign-users', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const result = await findAccessibleProject(prisma, currentUser, req.params.projectId);
  if (result.error) {
    return res.status(result.error.includes('不正') ? 400 : 404).json({ message: result.error });
  }

  const { projectId } = result;
  const userIds = Array.isArray(req.body?.userIds)
    ? req.body.userIds.map(parseBigIntValue).filter(Boolean)
    : null;

  if (!userIds || userIds.length === 0) {
    return res.status(400).json({
      message: '割り当て対象のユーザー ID を 1 件以上指定してください。',
    });
  }

  const uniqueUserIds = [...new Set(userIds.map((userId) => userId.toString()))].map((userId) =>
    BigInt(userId)
  );

  const users = await prisma.user.findMany({
    where: {
      id: {
        in: uniqueUserIds,
      },
      companyId: result.project.companyId,
      deletedAt: null,
    },
  });

  if (users.length !== uniqueUserIds.length) {
    return res.status(400).json({
      message: '存在しないユーザーが含まれています。',
    });
  }

  const existingAssignments = await prisma.userProject.findMany({
    where: {
      projectId,
    },
  });

  const now = new Date();
  const existingByUserId = new Map(
    existingAssignments.map((assignment) => [assignment.userId.toString(), assignment])
  );

  const operations = [];

  for (const userId of uniqueUserIds) {
    const existing = existingByUserId.get(userId.toString());

    if (existing) {
      operations.push(
        prisma.userProject.update({
          where: {
            id: existing.id,
          },
          data: {
            deletedAt: null,
          },
        })
      );
      existingByUserId.delete(userId.toString());
      continue;
    }

    operations.push(
      prisma.userProject.create({
        data: {
          projectId,
          userId,
        },
      })
    );
  }

  for (const assignment of existingByUserId.values()) {
    if (!assignment.deletedAt) {
      operations.push(
        prisma.userProject.update({
          where: {
            id: assignment.id,
          },
          data: {
            deletedAt: now,
          },
        })
      );
    }
  }

  await prisma.$transaction(operations);

  const updated = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      company: true,
      userProjects: {
        where: {
          deletedAt: null,
        },
        include: {
          user: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  return res.json({
    project: toPublicProject(updated),
  });
});

router.post('/:projectId/reclassify-messages', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return;
  }

  const result = await findAccessibleProject(prisma, currentUser, req.params.projectId);
  if (result.error) {
    return res.status(result.error.includes('不正') ? 400 : 404).json({ message: result.error });
  }

  const { project, projectId } = result;
  const messageIds = Array.isArray(req.body?.messageIds)
    ? req.body.messageIds.map(parseBigIntValue).filter(Boolean)
    : null;

  if (!messageIds || messageIds.length === 0) {
    return res.status(400).json({
      message: '再分類対象のメッセージ ID を 1 件以上指定してください。',
    });
  }

  const messages = await prisma.message.findMany({
    where: {
      id: {
        in: messageIds,
      },
      deletedAt: null,
    },
    include: {
      project: true,
    },
  });

  if (messages.length !== messageIds.length) {
    return res.status(400).json({
      message: '存在しないメッセージが含まれています。',
    });
  }

  const invalidMessage = messages.find((message) => message.project.companyId !== project.companyId);
  if (invalidMessage) {
    return res.status(400).json({
      message: '同一会社内のメッセージだけ再分類できます。',
    });
  }

  const updateResult = await prisma.message.updateMany({
    where: {
      id: {
        in: messageIds,
      },
      deletedAt: null,
    },
    data: {
      projectId,
    },
  });

  return res.json({
    ok: true,
    movedCount: updateResult.count,
  });
});

module.exports = router;
