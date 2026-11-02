FROM node:22-bookworm-slim AS tested
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY server ./server
COPY assets ./assets
COPY functions/lib ./functions/lib
COPY functions/package.json ./functions/package.json
COPY test ./test
RUN npm run check && npm test

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=10000 NODE_OPTIONS=--max-old-space-size=256
WORKDIR /app
COPY --from=tested --chown=node:node /app /app
COPY --chown=node:node *.html *.jpg *.jpeg *.png ./
COPY --chown=node:node images ./images
COPY --chown=node:node pdfs ./pdfs
COPY --chown=node:node sections ./sections
USER node
EXPOSE 10000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:10000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
