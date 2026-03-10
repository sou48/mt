# ================================
# MultiTranslate - Dockerfile
# nginx:alpine で静的ファイルをサーブ
# ================================
FROM nginx:alpine

# nginx設定をコピー
COPY nginx.conf /etc/nginx/conf.d/default.conf

# アプリファイルをルート配下へコピー
COPY index.html   /usr/share/nginx/html/
COPY assets/      /usr/share/nginx/html/assets/
COPY styles/      /usr/share/nginx/html/styles/
COPY js/          /usr/share/nginx/html/js/

# ポート80を公開
EXPOSE 80

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
