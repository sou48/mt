const bcrypt = require('bcrypt');
const { getPrismaClient } = require('../src/lib/prisma');

async function main() {
  const prisma = getPrismaClient();

  if (!prisma) {
    throw new Error('DATABASE_URL が設定されていません。');
  }

  const companyName = process.env.ADMIN_BOOTSTRAP_COMPANY_NAME || 'MT管理会社';
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@example.com';
  const displayName = process.env.ADMIN_BOOTSTRAP_DISPLAY_NAME || '初期管理者';
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'change-me-now';

  const passwordHash = await bcrypt.hash(password, 10);

  let company = await prisma.company.findFirst({
    where: {
      name: companyName,
      deletedAt: null,
    },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
      },
    });
  }

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      companyId: company.id,
      displayName,
      role: 'admin',
      passwordHash,
      deletedAt: null,
    },
    create: {
      companyId: company.id,
      email,
      displayName,
      role: 'admin',
      passwordHash,
    },
  });

  console.log(
    JSON.stringify(
      {
        companyId: company.id.toString(),
        userId: user.id.toString(),
        email: user.email,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrismaClient();
    if (prisma) {
      await prisma.$disconnect();
    }
  });
