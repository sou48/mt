const express = require('express');
const bcrypt = require('bcrypt');
const { getPrismaClient } = require('../../lib/prisma');
const { env } = require('../../config/env');
const {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  getPasswordResetExpiryDate,
  hashPasswordResetToken,
} = require('../../lib/password-reset');
const { toPublicUser } = require('../../utils/serialize');

const router = express.Router();
const PASSWORD_MIN_LENGTH = 8;
const TEST_LOGIN_COMPANY_NAME = process.env.TEST_LOGIN_COMPANY_NAME || 'MTテスト会社';
const TEST_LOGIN_PROJECT_NAME = process.env.TEST_LOGIN_PROJECT_NAME || '動作検証案件';
const TEST_LOGIN_EMAIL = process.env.TEST_LOGIN_EMAIL || 'tester@example.com';
const TEST_LOGIN_DISPLAY_NAME = process.env.TEST_LOGIN_DISPLAY_NAME || '動作確認ユーザー';
const TEST_LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD || 'test-login-only';

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

function finalizeLogin(req, res, user) {
  req.session.userId = user.id.toString();
  req.session.userRole = user.role;

  req.session.save((error) => {
    if (error) {
      console.error('Session save failed:', error);
      return res.status(500).json({
        message: 'ログイン状態の保存に失敗しました。時間を置いて再度お試しください。',
      });
    }

    return res.json({
      user: toPublicUser(user),
    });
  });
}

async function ensureTestLoginUser(prisma) {
  let company = await prisma.company.findFirst({
    where: {
      name: TEST_LOGIN_COMPANY_NAME,
      deletedAt: null,
    },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: TEST_LOGIN_COMPANY_NAME,
      },
    });
  }

  let user = await prisma.user.findFirst({
    where: {
      email: TEST_LOGIN_EMAIL,
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: TEST_LOGIN_EMAIL,
        displayName: TEST_LOGIN_DISPLAY_NAME,
        role: 'admin',
        passwordHash: await bcrypt.hash(TEST_LOGIN_PASSWORD, 10),
      },
      include: {
        company: true,
      },
    });
  }

  let project = await prisma.project.findFirst({
    where: {
      companyId: company.id,
      name: TEST_LOGIN_PROJECT_NAME,
      deletedAt: null,
    },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        companyId: company.id,
        name: TEST_LOGIN_PROJECT_NAME,
        createdByUserId: user.id,
        userProjects: {
          create: {
            userId: user.id,
          },
        },
      },
    });
  } else {
    const assignment = await prisma.userProject.findFirst({
      where: {
        userId: user.id,
        projectId: project.id,
        deletedAt: null,
      },
    });

    if (!assignment) {
      await prisma.userProject.create({
        data: {
          userId: user.id,
          projectId: project.id,
        },
      });
    }
  }

  const signature = await prisma.signature.findFirst({
    where: {
      userId: user.id,
      name: 'テスト署名',
      deletedAt: null,
    },
  });

  if (!signature) {
    await prisma.signature.create({
      data: {
        userId: user.id,
        name: 'テスト署名',
        japaneseText: `${TEST_LOGIN_DISPLAY_NAME}\nMultiTranslate`,
        partnerText: `${TEST_LOGIN_DISPLAY_NAME}\nMultiTranslate`,
        isDefault: true,
      },
    });
  }

  return prisma.user.findFirst({
    where: {
      id: user.id,
      deletedAt: null,
    },
    include: {
      company: true,
    },
  });
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

  return finalizeLogin(req, res, user);
});

router.post('/test-login', async (req, res) => {
  if (env.nodeEnv === 'production') {
    return res.status(404).json({
      message: 'この機能は利用できません。',
    });
  }

  const prisma = getConfiguredPrisma(res);
  if (!prisma) {
    return;
  }

  const user = await ensureTestLoginUser(prisma);
  if (!user) {
    return res.status(500).json({
      message: 'テストユーザーの準備に失敗しました。',
    });
  }

  return finalizeLogin(req, res, user);
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
