const crypto = require('crypto');
const { env } = require('../config/env');

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getPasswordResetExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + env.passwordResetTokenExpiresMinutes);
  return expiresAt;
}

function buildPasswordResetUrl(token) {
  const url = new URL('/reset-password', env.appBaseUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

module.exports = {
  generatePasswordResetToken,
  hashPasswordResetToken,
  getPasswordResetExpiryDate,
  buildPasswordResetUrl,
};
