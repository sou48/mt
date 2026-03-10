# MultiTranslate - 多言語翻訳チャットシステム

LINE風UIを持つ多言語翻訳チャットシステムです。外国語のメールやメッセージをAIで翻訳・返信支援します。

## アクセスURL

```
http://localhost:3001/
```

> ポート3000は別システム（Next.js）が使用中のため、このシステムはポート3001を使用します。

## 開発環境での起動

### Docker（推奨）

```bash
# ビルドして起動
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

# 停止
docker compose -f docker-compose.yml -f docker-compose.local.yml down

# ログ確認
docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f

# 再ビルドして起動
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
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

## リスク管理ゲート

AI生成コードの脆弱性混入、ハルシネーション由来の危険実装、機密情報漏洩、プロンプトインジェクション耐性不足を早期に検出するため、共通 runner ベースの `risk-gate` を用意しています。

### 目的

- コミット / push 前に最低限の安全確認を自動で通す
- ローカルと GitHub Actions で同じチェックを使う
- 他プロジェクトへも `tools/risk-gate/` と `.risk-gate.conf` を移植して再利用できる構成にする

### 実行方法

```bash
# 変更差分ベースで実行
npm run risk:gate

# リポジトリ全体を対象に実行
npm run risk:gate:all

# Git hook を有効化
npm run hooks:install
```

## Traefik を使った本番構成

本番では `mt.trialworks.jp` を Traefik が受け、`mt` 専用コンテナへ振り分けます。Traefik は Docker provider ではなく file provider を使い、`shared_proxy_net` 上の各コンテナへルーティングします。

### VPS ディレクトリ構成

```text
/opt/
├── infra-proxy/
│   ├── docker-compose.yml
│   ├── .env
│   └── letsencrypt/
└── mt/
    ├── docker-compose.yml
    ├── docker-compose.prod.yml
    ├── .env
    └── ...
```

### Docker Compose の分割

- `docker-compose.yml`
  - `mt-web`, `mt-db`, `mt_internal_net`, `mt_pgdata`
- `docker-compose.local.yml`
  - ローカル開発用ポート公開
- `docker-compose.prod.yml`
  - `shared_proxy_net` 参加を追加する本番用オーバーレイ

### 初回セットアップ

```bash
# Traefik 共通入口を構築
npm run deploy:infra-proxy:conoha

# MT 本体を本番構成でデプロイ
npm run deploy:conoha
```

Traefik の動的ルーティング定義は [deploy/infra-proxy/dynamic/routes.yml](/home/takeshi/multi-translate/deploy/infra-proxy/dynamic/routes.yml) で管理します。

### 状態確認

```bash
npm run deploy:conoha:status
```

### 環境変数で上書き可能な項目

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`
- `DEPLOY_REMOTE_DIR`
- `DEPLOY_REPO_URL`
- `DEPLOY_SSH_KEY`
- `DEPLOY_SYNC_MODE`

### 典型フロー

```bash
# 1. AIでコード生成 / 修正

# 2. 差分確認
git diff

# 3. リスク管理ゲート実行
npm run risk:gate

# 4. 問題なければコミット
git add .
git commit -m "..."

# 5. push 前に pre-push hook が再度ゲートを実行
git push
```

### 判定

- `FAIL`: コミット / push を止めるべき問題
- `WARN`: 手動レビュー必須。必要なら修正して再実行
- `PASS`: 自動チェック上は問題なし

### 現在のチェック内容

- シークレット検出
- `eval` / `new Function` のような危険パターン検出
- `innerHTML` などの要レビュー箇所の警告
- LLM連携やサーバー入口など高リスクファイル変更時の警告
- Node / クライアント JavaScript の構文チェック
- `npm audit` の任意実行

プロジェクト固有ルールは [.risk-gate.conf](/home/takeshi/multi-translate/.risk-gate.conf) に寄せています。

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
├── assets/             # favicon等
├── deploy/             # VPS配置用ファイル
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
├── docker-compose.local.yml
├── docker-compose.prod.yml
├── nginx.conf
├── .risk-gate.conf     # リスク管理ゲート設定
├── .githooks/          # Git hook
├── .github/workflows/  # CI
├── tools/risk-gate/    # 共通 runner
└── メモ_仕様書.txt
```
