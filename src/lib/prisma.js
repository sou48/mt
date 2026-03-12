const { PrismaClient } = require('@prisma/client');
const { env } = require('../config/env');

let prisma = null;

function getPrismaClient() {
  if (!env.databaseUrl) {
    return null;
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

async function checkDatabaseHealth() {
  const client = getPrismaClient();

  if (!client) {
    return {
      ok: false,
      status: 'unconfigured',
    };
  }

  try {
    await client.$queryRaw`SELECT 1`;

    return {
      ok: true,
      status: 'ok',
    };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: error.message,
    };
  }
}

module.exports = {
  getPrismaClient,
  checkDatabaseHealth,
};
