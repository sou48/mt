const { PrismaClient } = require('@prisma/client');
const { env } = require('../config/env');
const { mockPrisma } = require('./mock-prisma');

let prisma = null;
let resilientPrisma = null;
let healthCache = {
  checkedAt: 0,
  ok: false,
  mode: 'unknown',
  message: '',
};

function isRecoverableDatabaseError(error) {
  return (
    error?.name === 'PrismaClientInitializationError' ||
    error?.code === 'P1001' ||
    error?.code === 'P1002'
  );
}

function createResilientDelegate(target, fallback, label) {
  if (!target || typeof target !== 'object' || !fallback) {
    return target;
  }

  return new Proxy(target, {
    get(delegateTarget, prop, receiver) {
      const value = Reflect.get(delegateTarget, prop, receiver);
      const fallbackValue = fallback[prop];

      if (typeof value !== 'function') {
        return value;
      }

      return async (...args) => {
        try {
          return await value.apply(delegateTarget, args);
        } catch (error) {
          if (!env.allowMockDb || !isRecoverableDatabaseError(error) || typeof fallbackValue !== 'function') {
            throw error;
          }

          console.warn(`[prisma] ${label}.${String(prop)} でDB接続に失敗したため mock DB にフォールバックします。`);
          return fallbackValue.apply(fallback, args);
        }
      };
    },
  });
}

function createResilientPrismaClient(client) {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === '__isMock') {
        return false;
      }

      const value = Reflect.get(target, prop, receiver);
      const fallbackValue = mockPrisma[prop];

      if (typeof value === 'function') {
        return async (...args) => {
          try {
            return await value.apply(target, args);
          } catch (error) {
            if (!env.allowMockDb || !isRecoverableDatabaseError(error) || typeof fallbackValue !== 'function') {
              throw error;
            }

            console.warn(`[prisma] ${String(prop)} でDB接続に失敗したため mock DB にフォールバックします。`);
            return fallbackValue.apply(mockPrisma, args);
          }
        };
      }

      if (value && typeof value === 'object' && fallbackValue && typeof fallbackValue === 'object') {
        return createResilientDelegate(value, fallbackValue, String(prop));
      }

      return value;
    },
  });
}

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

  if (!env.allowMockDb) {
    return prisma;
  }

  if (!resilientPrisma) {
    resilientPrisma = createResilientPrismaClient(prisma);
  }

  return resilientPrisma;
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
