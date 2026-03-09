const express = require('express');
const path = require('path');
const app = express();
const port = 3001;

// /mt サブパスで静的ファイルを配信
app.use('/mt', express.static(path.join(__dirname, './')));

// ルートアクセス時は /mt/ へリダイレクト
app.get('/', (req, res) => {
    res.redirect('/mt/');
});

// ヘルスチェック用
app.get('/health', (req, res) => {
    res.send('OK');
});

app.listen(port, () => {
    console.log(`-----------------------------------------------`);
    console.log(` MultiTranslate is running at:`);
    console.log(` > Local: http://localhost:${port}/mt/`);
    console.log(`-----------------------------------------------`);
});
