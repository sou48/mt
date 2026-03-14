const express = require('express');
const {
  AiInputError,
  detectLanguage,
  generateDraft,
  getAiSettingsFromSession,
  translate,
} = require('../../lib/ai-service');
const { requireCurrentUser } = require('../../lib/api-helpers');

const router = express.Router();

function handleAiError(res, error) {
  if (error instanceof AiInputError) {
    return res.status(400).json({ message: error.message });
  }

  console.error('AI API error:', error);
  return res.status(502).json({ message: 'AI 処理に失敗しました。設定または入力内容を確認してください。' });
}

router.post('/ai/detect-language', async (req, res) => {
  try {
    const currentUser = await requireCurrentUser(req, res);
    if (!currentUser) return;

    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'テキストは必須です。' });
    }

    const detectedLang = await detectLanguage(text, getAiSettingsFromSession(req));
    return res.json({ detectedLang });
  } catch (error) {
    return handleAiError(res, error);
  }
});

router.post('/ai/translate', async (req, res) => {
  try {
    const currentUser = await requireCurrentUser(req, res);
    if (!currentUser) return;

    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    const targetLang = req.body?.targetLang || 'ja';
    const sourceLang = req.body?.sourceLang || 'auto';
    const tone = req.body?.tone || 'auto';
    const direction = req.body?.direction || 'receive';

    if (!text) {
      return res.status(400).json({ message: '翻訳対象テキストは必須です。' });
    }

    const result = await translate(
      {
        text,
        targetLang,
        sourceLang,
        tone,
        context: Array.isArray(req.body?.context) ? req.body.context : [],
        dictionary: Array.isArray(req.body?.dictionary) ? req.body.dictionary : [],
        direction,
      },
      getAiSettingsFromSession(req)
    );

    return res.json(result);
  } catch (error) {
    return handleAiError(res, error);
  }
});

router.post('/ai/draft', async (req, res) => {
  try {
    const currentUser = await requireCurrentUser(req, res);
    if (!currentUser) return;

    const result = await generateDraft(
      {
        instruction: typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '',
        messageHistory: Array.isArray(req.body?.messageHistory) ? req.body.messageHistory : [],
        targetLang: req.body?.targetLang || 'en',
        tone: req.body?.tone || 'auto',
      },
      getAiSettingsFromSession(req)
    );

    return res.json(result);
  } catch (error) {
    return handleAiError(res, error);
  }
});

module.exports = router;
