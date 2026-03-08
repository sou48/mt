# ================================
# MultiTranslate - Dockerfile
# nginx:alpine で静的ファイルをサーブ
# ================================
FROM nginx:alpine

# nginx設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# アプリファイルを /mt サブパスにコピー
COPY index.html   /usr/share/nginx/html/
COPY styles/      /usr/share/nginx/html/styles/
COPY js/          /usr/share/nginx/html/js/

# ポート80を公開
EXPOSE 80

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1
