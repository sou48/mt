const express = require('express');
const session = require('express-session');
const path = require('path');
const { env } = require('./config/env');
const apiRouter = require('./routes/api');

function createApp() {
  const app = express();
  const staticDir = process.cwd();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      name: 'mt.sid',
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: env.sessionCookieSecure,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    })
  );

  app.use('/assets', express.static(path.join(staticDir, 'assets')));
  app.use('/styles', express.static(path.join(staticDir, 'styles')));
  app.use('/js', express.static(path.join(staticDir, 'js')));

  app.use('/api', apiRouter);

  app.get('/health', (_req, res) => {
    res.type('text/plain').send('OK');
  });

  app.get('/', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  return app;
}

module.exports = { createApp };
