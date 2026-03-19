const express = require('express');
const { getAiSettingsFromSession, getAiSettingsFromUser, normalizeAiSettings, saveAiSettingsToSession } = require('../../lib/ai-service');
const { requireCurrentUser } = require('../../lib/api-helpers');
const { getPrismaClient } = require('../../lib/prisma');

const router = express.Router();

function maskSettings(settings) {
  return {
    aiProvider: settings.aiProvider,
    openaiKey: settings.openaiKey ? 'configured' : '',
    geminiKey: settings.geminiKey ? 'configured' : '',
    claudeKey: settings.claudeKey ? 'configured' : '',
    userName: settings.userName || '',
    defaultTone: settings.defaultTone || 'auto',
    themeMode: settings.themeMode || 'light',
    projectPreferences: settings.projectPreferences || {},
  };
}

router.get('/settings', async (req, res) => {
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const persistedSettings = getAiSettingsFromUser(currentUser);
  saveAiSettingsToSession(req, persistedSettings);

  return res.json({
    settings: maskSettings(persistedSettings),
  });
});

router.patch('/settings', async (req, res) => {
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const nextSettings = normalizeAiSettings({
    aiProvider: req.body?.aiProvider || getAiSettingsFromSession(req).aiProvider,
    openaiKey:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'openaiKey')
        ? req.body.openaiKey || ''
        : getAiSettingsFromSession(req).openaiKey,
    geminiKey:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'geminiKey')
        ? req.body.geminiKey || ''
        : getAiSettingsFromSession(req).geminiKey,
    claudeKey:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'claudeKey')
        ? req.body.claudeKey || ''
        : getAiSettingsFromSession(req).claudeKey,
    userName:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'userName')
        ? req.body.userName || ''
        : getAiSettingsFromSession(req).userName,
    defaultTone:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'defaultTone')
        ? req.body.defaultTone || 'auto'
        : getAiSettingsFromSession(req).defaultTone,
    themeMode:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'themeMode')
        ? req.body.themeMode || 'light'
        : getAiSettingsFromSession(req).themeMode,
    projectPreferences:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'projectPreferences')
        ? req.body.projectPreferences || {}
        : getAiSettingsFromSession(req).projectPreferences,
  });

  const prisma = getPrismaClient();
  if (!prisma) {
    return res.status(503).json({
      message: 'データベースが未設定です。',
    });
  }

  await prisma.user.update({
    where: {
      id: currentUser.id,
    },
    data: {
      aiSettingsJson: nextSettings,
    },
  });

  saveAiSettingsToSession(req, nextSettings);

  return res.json({
    settings: maskSettings(nextSettings),
  });
});

module.exports = router;
