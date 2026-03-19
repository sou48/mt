FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY server.js ./
COPY scripts ./scripts
COPY src ./src
COPY index.html ./
COPY assets ./assets
COPY styles ./styles
COPY js ./js

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "start"]
