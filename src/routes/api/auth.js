const express = require('express');
const bcrypt = require('bcrypt');
const { getPrismaClient } = require('../../lib/prisma');
const {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  getPasswordResetExpiryDate,
  hashPasswordResetToken,
} = require('../../lib/password-reset');
const { toPublicUser } = require('../../utils/serialize');

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;

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

function validatePassword(password) {
  return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH;
}

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({
      message: 'メールアドレスとパスワードは必須です。',
    });
  }

  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
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

router.post('/password-reset/request', async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({
      message: 'メールアドレスは必須です。',
    });
  }

  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });

  if (!user) {
    return res.json({
      ok: true,
      message:
        '該当するユーザーが存在する場合は、パスワード再設定手順を案内します。',
    });
  }

  const plainToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(plainToken);
  const expiresAt = getPasswordResetExpiryDate();

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const resetUrl = buildPasswordResetUrl(plainToken);
  const response = {
    ok: true,
    message:
      '該当するユーザーが存在する場合は、パスワード再設定手順を案内します。',
  };

  if (process.env.NODE_ENV !== 'production') {
    response.preview = {
      token: plainToken,
      resetUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  return res.json(response);
});

router.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({
      message: 'トークンと新しいパスワードは必須です。',
    });
  }

  if (!validatePassword(password)) {
    return res.status(400).json({
      message: `パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください。`,
    });
  }

  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: hashPasswordResetToken(token),
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });

  if (!resetToken || resetToken.user.deletedAt) {
    return res.status(400).json({
      message: 'トークンが無効か、有効期限が切れています。',
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: resetToken.userId,
      },
      data: {
        passwordHash,
      },
    }),
    prisma.passwordResetToken.update({
      where: {
        id: resetToken.id,
      },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetToken.userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    }),
  ]);

  return res.json({
    ok: true,
    message: 'パスワードを更新しました。',
  });
});

router.get('/me', async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.status(401).json({
      message: '未ログインです。',
    });
  }

  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
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
