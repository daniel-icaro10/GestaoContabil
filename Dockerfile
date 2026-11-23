# Imagem de produção (VPS). Build do frontend (Vite) + API Express rodando com tsx.
# Uso: docker compose -f docker-compose.vps.yml --env-file .env.vps up -d --build   (passo a passo no README)

FROM node:20.18.1-alpine3.20 AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --include=dev
COPY web ./
RUN npm run build

FROM node:20.18.1-alpine3.20 AS app
ENV NODE_ENV=production PORT=3333 TZ=America/Sao_Paulo DATA_DIR=/data
RUN apk add --no-cache tzdata
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# tsx está nas dependências de produção: o servidor roda direto do TypeScript
RUN npm ci --omit=dev && npm cache clean --force
COPY server/src ./src
COPY server/scripts ./scripts
COPY server/tsconfig.json ./
# A API serve o frontend compilado de ../web/dist
COPY --from=web /app/web/dist /app/web/dist
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3333/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "src/index.ts"]
