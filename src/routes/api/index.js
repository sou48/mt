const express = require('express');
const adminUsersRouter = require('./admin-users');
const aiRouter = require('./ai');
const attachmentsRouter = require('./attachments');
const authRouter = require('./auth');
const companiesRouter = require('./companies');
const dictionariesRouter = require('./dictionaries');
const healthRouter = require('./health');
const messagesRouter = require('./messages');
const projectsRouter = require('./projects');
const searchRouter = require('./search');
const settingsRouter = require('./settings');
const signaturesRouter = require('./signatures');

const router = express.Router();

router.use('/', adminUsersRouter);
router.use('/', aiRouter);
router.use('/', attachmentsRouter);
router.use('/auth', authRouter);
router.use('/companies', companiesRouter);
router.use('/', dictionariesRouter);
router.use('/health', healthRouter);
router.use('/messages', messagesRouter);
router.use('/projects', projectsRouter);
router.use('/search', searchRouter);
router.use('/', settingsRouter);
router.use('/signatures', signaturesRouter);

module.exports = router;
