const express = require('express');
const bcrypt = require('bcrypt');
const {
  buildPaginationMeta,
  getConfiguredPrisma,
  getPaginationParams,
  parseBigIntValue,
  requireCurrentUser,
} = require('../../lib/api-helpers');
const { isAdmin } = require('../../lib/auth');
const { toPublicUser } = require('../../utils/serialize');

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;

function validatePassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH;
}

async function requireAdminUser(req, res) {
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) {
    return null;
  }

  if (!isAdmin(currentUser)) {
    res.status(403).json({
      message: '管理者権限が必要です。',
    });
    return null;
  }

  return currentUser;
}

router.get('/admin/users', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireAdminUser(req, res);
  if (!currentUser) return;

  const pagination = getPaginationParams(req.query);
  const companyId = req.query.companyId ? parseBigIntValue(req.query.companyId) : null;
  if (req.query.companyId && !companyId) {
    return res.status(400).json({ message: '会社 ID が不正です。' });
  }

  const where = {
    deletedAt: null,
    ...(companyId ? { companyId } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: {
        company: true,
      },
      orderBy: [{ companyId: 'asc' }, { email: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
    }),
  ]);

  return res.json({
    users: users.map(toPublicUser),
    pagination: buildPaginationMeta(total, pagination.page, pagination.pageSize),
  });
});

router.post('/admin/users', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireAdminUser(req, res);
  if (!currentUser) return;

  const companyId = parseBigIntValue(req.body?.companyId);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const role = req.body?.role === 'admin' ? 'admin' : 'user';
  const password = req.body?.password;

  if (!companyId || !email || !displayName || !validatePassword(password)) {
    return res.status(400).json({
      message: `会社 ID、メールアドレス、表示名、${PASSWORD_MIN_LENGTH} 文字以上のパスワードは必須です。`,
    });
  }

  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      deletedAt: null,
    },
  });
  if (!company) {
    return res.status(404).json({ message: '会社が見つかりません。' });
  }

  const duplicate = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });
  if (duplicate) {
    return res.status(409).json({ message: '同じメールアドレスのユーザーが既に存在します。' });
  }

  const user = await prisma.user.create({
    data: {
      companyId,
      email,
      displayName,
      role,
      passwordHash: await bcrypt.hash(password, 10),
    },
    include: {
      company: true,
    },
  });

  return res.status(201).json({
    user: toPublicUser(user),
  });
});

router.patch('/admin/users/:userId', async (req, res) => {
  const prisma = getConfiguredPrisma(res);
  if (!prisma) return;
  const currentUser = await requireAdminUser(req, res);
  if (!currentUser) return;

  const userId = parseBigIntValue(req.params.userId);
  if (!userId) {
    return res.status(400).json({ message: 'ユーザー ID が不正です。' });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });
  if (!user) {
    return res.status(404).json({ message: 'ユーザーが見つかりません。' });
  }

  const companyId =
    req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId')
      ? parseBigIntValue(req.body.companyId)
      : user.companyId;
  if (!companyId) {
    return res.status(400).json({ message: '会社 ID が不正です。' });
  }

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId')) {
    const company = await prisma.company.findFirst({
      where: {
        id: companyId,
        deletedAt: null,
      },
    });
    if (!company) {
      return res.status(404).json({ message: '会社が見つかりません。' });
    }
  }

  const email =
    typeof req.body?.email === 'string' && req.body.email.trim()
      ? req.body.email.trim().toLowerCase()
      : user.email;
  const displayName =
    typeof req.body?.displayName === 'string' && req.body.displayName.trim()
      ? req.body.displayName.trim()
      : user.displayName;
  const role = req.body?.role === 'admin' ? 'admin' : req.body?.role === 'user' ? 'user' : user.role;

  if (email !== user.email) {
    const duplicate = await prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
        id: {
          not: userId,
        },
      },
    });
    if (duplicate) {
      return res.status(409).json({ message: '同じメールアドレスのユーザーが既に存在します。' });
    }
  }

  const data = {
    companyId,
    email,
    displayName,
    role,
  };

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'password')) {
    if (!validatePassword(req.body.password)) {
      return res.status(400).json({
        message: `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください。`,
      });
    }
    data.passwordHash = await bcrypt.hash(req.body.password, 10);
  }

  if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'active')) {
    data.deletedAt = req.body.active === false ? new Date() : null;
  }

  const updated = await prisma.user.update({
    where: {
      id: userId,
    },
    data,
    include: {
      company: true,
    },
  });

  return res.json({
    user: toPublicUser(updated),
  });
});

module.exports = router;
