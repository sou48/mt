const express = require('express');
const bcrypt = require('bcrypt');
const { getPrismaClient } = require('../../lib/prisma');
const { toPublicUser } = require('../../utils/serialize');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'メールアドレスとパスワードは必須です。',
    });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return res.status(503).json({
      message: 'データベースが未設定です。',
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      message: 'メールアドレスまたはパスワードが正しくありません。',
    });
  }

  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) {
    return res.status(401).json({
      message: 'メールアドレスまたはパスワードが正しくありません。',
    });
  }

  req.session.userId = user.id.toString();
  req.session.userRole = user.role;

  return res.json({
    user: toPublicUser(user),
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('mt.sid');
    res.json({ ok: true });
  });
});

router.get('/me', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      message: '未ログインです。',
    });
  }

  const prisma = getPrismaClient();
  if (!prisma) {
    return res.status(503).json({
      message: 'データベースが未設定です。',
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: BigInt(userId),
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      message: 'ユーザーが見つかりません。',
    });
  }

  return res.json({
    user: toPublicUser(user),
  });
});

module.exports = router;
