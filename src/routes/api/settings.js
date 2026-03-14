const express = require('express');
const { getAiSettingsFromSession, saveAiSettingsToSession } = require('../../lib/ai-service');
const { requireCurrentUser } = require('../../lib/api-helpers');

const router = express.Router();

function maskSettings(settings) {
  return {
    aiProvider: settings.aiProvider,
    openaiKey: settings.openaiKey ? 'configured' : '',
    geminiKey: settings.geminiKey ? 'configured' : '',
    claudeKey: settings.claudeKey ? 'configured' : '',
    userName: settings.userName || '',
    defaultTone: settings.defaultTone || 'auto',
    projectPreferences: settings.projectPreferences || {},
  };
}

router.get('/settings', async (req, res) => {
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  return res.json({
    settings: maskSettings(getAiSettingsFromSession(req)),
  });
});

router.patch('/settings', async (req, res) => {
  const currentUser = await requireCurrentUser(req, res);
  if (!currentUser) return;

  const nextSettings = saveAiSettingsToSession(req, {
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
    projectPreferences:
      req.body && Object.prototype.hasOwnProperty.call(req.body, 'projectPreferences')
        ? req.body.projectPreferences || {}
        : getAiSettingsFromSession(req).projectPreferences,
  });

  return res.json({
    settings: maskSettings(nextSettings),
  });
});

module.exports = router;
