const express = require('express');
const path = require('path');
const app = express();
const port = 3001;
const staticDir = path.join(__dirname);

app.use('/assets', express.static(path.join(staticDir, 'assets')));
app.use('/styles', express.static(path.join(staticDir, 'styles')));
app.use('/js', express.static(path.join(staticDir, 'js')));

app.get('/', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
});

// ヘルスチェック用
app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(port, () => {
    console.log(`-----------------------------------------------`);
    console.log(` MultiTranslate is running at:`);
    console.log(` > Local: http://localhost:${port}/`);
    console.log(`-----------------------------------------------`);
});
