const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || '',
  allowMockDb: process.env.ALLOW_MOCK_DB === 'true',
  sessionSecret: process.env.SESSION_SECRET || 'change-me',
  sessionCookieSecure: process.env.SESSION_COOKIE_SECURE === 'true',
  appBaseUrl: process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
  passwordResetTokenExpiresMinutes: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRES_MINUTES || 30),
  attachmentStorageDir:
    process.env.ATTACHMENT_STORAGE_DIR || path.join(process.cwd(), 'storage', 'attachments'),
};

module.exports = { env };
