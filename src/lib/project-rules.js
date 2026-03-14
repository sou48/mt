const UNCLASSIFIED_PROJECT_NAME = '未分類';

async function ensureUnclassifiedProject(prisma, { companyId, createdByUserId }) {
  const existing = await prisma.project.findFirst({
    where: {
      companyId,
      isUnclassified: true,
      deletedAt: null,
    },
  });

  if (existing) {
    return existing;
  }

  return prisma.project.create({
    data: {
      companyId,
      name: UNCLASSIFIED_PROJECT_NAME,
      isUnclassified: true,
      createdByUserId: createdByUserId || null,
      userProjects: createdByUserId
        ? {
            create: {
              userId: createdByUserId,
            },
          }
        : undefined,
    },
  });
}

module.exports = {
  ensureUnclassifiedProject,
  UNCLASSIFIED_PROJECT_NAME,
};
