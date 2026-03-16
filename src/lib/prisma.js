const { PrismaClient } = require('@prisma/client');
const { env } = require('../config/env');
const { mockPrisma } = require('./mock-prisma');

let prisma = null;
let healthCache = {
  checkedAt: 0,
  ok: false,
  mode: 'unknown',
  message: '',
};

async function detectDatabaseMode() {
  if (!env.databaseUrl) {
    return {
      ok: false,
      mode: 'unconfigured',
      message: 'DATABASE_URL が未設定です。',
    };
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, mode: 'database', message: '' };
  } catch (error) {
    if (env.allowMockDb) {
      return {
        ok: true,
        mode: 'mock',
        message: error.message,
      };
    }
    return {
      ok: false,
      mode: 'error',
      message: error.message,
    };
  }
}

async function getHealthState(force = false) {
  const isFresh = Date.now() - healthCache.checkedAt < 3000;
  if (!force && isFresh) {
    return healthCache;
  }

  healthCache = {
    checkedAt: Date.now(),
    ...(await detectDatabaseMode()),
  };
  return healthCache;
}

function getPrismaClient() {
  if (!env.databaseUrl) {
    return env.allowMockDb ? mockPrisma : null;
  }

  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

async function checkDatabaseHealth() {
  const state = await getHealthState(true);
  if (state.mode === 'database') {
    return {
      ok: true,
      status: 'ok',
    };
  }

  if (state.mode === 'mock') {
    return {
      ok: true,
      status: 'fallback',
      message: 'ALLOW_MOCK_DB=true のためメモリストアで動作中です。',
    };
  }

  if (state.mode === 'unconfigured') {
    return {
      ok: false,
      status: 'unconfigured',
    };
  }

  return {
    ok: false,
    status: 'error',
    message: state.message,
  };
}

module.exports = {
  checkDatabaseHealth,
  getPrismaClient,
};
