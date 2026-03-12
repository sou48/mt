const express = require('express');
const authRouter = require('./auth');
const healthRouter = require('./health');

const router = express.Router();

router.use('/auth', authRouter);
router.use('/health', healthRouter);

module.exports = router;
