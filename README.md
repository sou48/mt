# MultiTranslate - 多言語翻訳チャットシステム

LINE風UIを持つ多言語翻訳チャットシステムです。外国語のメールやメッセージをAIで翻訳・返信支援します。

## アクセスURL

```
http://localhost:3001/mt/
```

> ポート3000は別システム（Next.js）が使用中のため、このシステムはポート3001を使用します。

## 開発環境での起動

### Docker（推奨）

```bash
# ビルドして起動
docker compose up -d

# 停止
docker compose down

# ログ確認
docker compose logs -f

# 再ビルドして起動
docker compose up -d --build
```

### ローカル（nginx直接）

nginxがインストールされていれば以下で起動可能：

```bash
nginx -c $(pwd)/nginx.conf -p $(pwd)/ -g "daemon off;"
```

## 技術スタック

- **フロントエンド**: HTML / CSS / JavaScript（バニラ）
- **Webサーバー**: Nginx (Docker)
- **AIプロバイダー**: OpenAI / Google Gemini / Anthropic Claude（API連携）
- **データ保存**: localStorage（ブラウザ）

## 主要機能

- LINE風チャットUI（受信：左、送信：右）
- 会社 → 案件スレッド の階層管理
- 多言語対応（英語、韓国語、中国語など12言語）
- AI翻訳（OpenAI GPT / Gemini / Claude 切替可能）
- 翻訳トーン変更（ビジネス正式 / 標準 / フレンドリー）
- 翻訳辞書機能（会社共通 + 案件別）
- 署名テンプレート管理

## APIキー設定

アプリ内の「設定（⚙）→ APIキー」タブから設定：
- OpenAI: `sk-...`
- Google Gemini: `AIza...`
- Anthropic Claude: `sk-ant-...`

未設定時はモック翻訳で動作します。

## ディレクトリ構成

```
multi-translate/
├── index.html          # メイン画面
├── styles/
│   └── main.css        # デザインシステム
├── js/
│   ├── app.js          # アプリコア
│   ├── ai-gateway.js   # AI抽象化レイヤー
│   ├── translator.js   # 翻訳ロジック
│   ├── chat.js         # チャットUI
│   ├── sidebar.js      # サイドバー
│   ├── modals.js       # モーダル
│   ├── storage.js      # ローカルストレージ
│   └── settings.js     # 設定管理
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
└── メモ_仕様書.txt
```
