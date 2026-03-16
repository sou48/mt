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
npm run docker:local:up

# 停止
npm run docker:local:down

# ログ確認
npm run docker:local:logs

# 再ビルドして起動
npm run docker:local:build
```

この WSL では Docker Desktop の共有ソケットを使う前提です。通常の `docker` コマンドがそのまま使えない場合でも、上記 npm script と以下のラッパーで実行できます。

```bash
./tools/docker/docker.sh version
./tools/docker/docker-compose.sh -f docker-compose.yml -f docker-compose.local.yml ps
```

### ローカル（Node.js 直接起動）

Node.js がインストールされていれば以下で起動可能：

```bash
cp .env.example .env
npm install
npm run db:generate
npm run dev
```

ローカル起動でも PostgreSQL への接続が必須です。既定の接続先はテスト用 DB `mt_test` です。

## 技術スタック

- **フロントエンド**: HTML / CSS / JavaScript（バニラ）
- **アプリサーバー**: Node.js / Express
- **公開入口**: Traefik（本番）
- **AIプロバイダー**: OpenAI / Google Gemini / Anthropic Claude（API連携）
- **ORM**: Prisma
- **データ保存**: PostgreSQL
- **セッション**: `express-session`（現状は `MemoryStore`）
- **添付保存**: `local://` 抽象化経由のローカル保存、将来 S3 互換ストレージへ移行可能

## バックエンド設計ドキュメント

- [バックエンド仕様](/home/takeshi/multi-translate/docs/バックエンド仕様.md)
- [API_JSON仕様](/home/takeshi/multi-translate/docs/API_JSON仕様.md)
- [API仕様管理方針](/home/takeshi/multi-translate/docs/API仕様管理方針.md)
- [管理者画面_UI要件](/home/takeshi/multi-translate/docs/管理者画面_UI要件.md)
- [監査ログ方針](/home/takeshi/multi-translate/docs/監査ログ方針.md)
- [バックアップ運用設計](/home/takeshi/multi-translate/docs/バックアップ運用設計.md)
- [S3互換ストレージ移行方針](/home/takeshi/multi-translate/docs/S3互換ストレージ移行方針.md)
- [ログ監視と障害時確認手順](/home/takeshi/multi-translate/docs/ログ監視と障害時確認手順.md)
- [実送信連携再評価](/home/takeshi/multi-translate/docs/実送信連携再評価.md)
- [マイグレーション方針](/home/takeshi/multi-translate/docs/マイグレーション方針.md)
- [テーブル定義確定案](/home/takeshi/multi-translate/docs/テーブル定義確定案.md)
- [技術選定](/home/takeshi/multi-translate/docs/技術選定.md)
- [ExecPlan_初期バックエンド実装](/home/takeshi/multi-translate/docs/ExecPlan_初期バックエンド実装.md)
- [タスク管理](/home/takeshi/multi-translate/docs/タスク管理.md)

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

本番では `mt.trialworks.jp` を Traefik が受け、`mt` 専用コンテナへ振り分けます。Traefik は Docker provider ではなく file provider を使い、`shared_proxy_net` 上の各コンテナへルーティングします。`https` は Let’s Encrypt で証明書を取得し、`http` アクセスは `https` へ恒久リダイレクトします。

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
- AI 返信支援の安全制御とプロンプトインジェクション対策
- 翻訳トーン変更（ビジネス正式 / 標準 / フレンドリー）
- 翻訳辞書機能（会社共通 + 案件別）
- 署名テンプレート管理

## バックエンド開発の初期コマンド

```bash
cp .env.example .env
npm run db:generate
npm run db:migrate:dev -- --name init
npm run db:seed:admin
```

> `db:migrate:dev` は PostgreSQL 起動後に実行します。

認証 API にはパスワードリセットも含みます。開発環境の `POST /api/auth/password-reset/request` は、メール実送信の代わりに `preview.resetUrl` とトークンを返します。

履歴参照 API:

- `GET /api/messages/:messageId/histories`
- `GET /api/signatures/:signatureId/histories`
- `GET /api/dictionaries/system/:entryId/histories`
- `GET /api/companies/:companyId/dictionaries/:entryId/histories`

初期管理者の投入値は `.env` の以下で変更できます。

```bash
ADMIN_BOOTSTRAP_COMPANY_NAME=MT管理会社
ADMIN_BOOTSTRAP_EMAIL=admin@example.com
ADMIN_BOOTSTRAP_DISPLAY_NAME=初期管理者
ADMIN_BOOTSTRAP_PASSWORD=change-me-now
SESSION_COOKIE_SECURE=false
APP_BASE_URL=http://localhost:3001
PASSWORD_RESET_TOKEN_EXPIRES_MINUTES=30
```

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
