const express = require('express');
const { checkDatabaseHealth } = require('../../lib/prisma');

const router = express.Router();

router.get('/', async (_req, res) => {
  const db = await checkDatabaseHealth();
  const statusCode = db.ok ? 200 : 503;

  res.status(statusCode).json({
    status: db.ok ? 'ok' : 'degraded',
    app: 'ok',
    db,
  });
});

router.get('/db', async (_req, res) => {
  const db = await checkDatabaseHealth();
  const statusCode = db.ok ? 200 : 503;

  res.status(statusCode).json(db);
});

module.exports = router;
