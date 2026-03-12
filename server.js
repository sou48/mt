const { createApp } = require('./src/app');
const { env } = require('./src/config/env');

const app = createApp();

app.listen(env.port, () => {
  console.log('-----------------------------------------------');
  console.log(' MultiTranslate is running at:');
  console.log(` > Local: http://localhost:${env.port}/`);
  console.log(` > API:   http://localhost:${env.port}/api/health`);
  console.log('-----------------------------------------------');
});
